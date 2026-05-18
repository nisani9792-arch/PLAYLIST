import { Router } from "express";
import {
  matchConfidence,
  msHitLikeFromMeiliRecord,
  REVIEW_THRESHOLD,
  stagingSearchVariants,
} from "@workspace/playlist-validation";
import {
  getMeilisearchConfig,
  isMeilisearchConfigured,
} from "../lib/meilisearch-config";
import {
  buildSearchCacheKey,
  getSearchCache,
  setSearchCache,
} from "../lib/search-cache";
import { logger } from "../lib/logger";

const router = Router();

const MAX_LIMIT = 100;
const MAX_GENRE_LEN = 96;
const MAX_RESOLVE_ITEMS = 400;
const RESOLVE_CONCURRENCY = 12;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]!);
    }
  }

  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

type MeiliHit = Record<string, unknown>;
type MeiliSearchResponse = {
  hits?: MeiliHit[];
  [key: string]: unknown;
};

class MeiliSearchError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`Meilisearch error: ${status} ${body.slice(0, 180)}`);
    this.name = "MeiliSearchError";
  }
}

function escapeFilterValue(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function parseEnvFilterList(): string[] | undefined {
  const raw = process.env.MEILISEARCH_SEARCH_FILTERS?.trim();
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  } catch {
    return undefined;
  }
}

function songTypeFilterClause(): string {
  const custom = process.env.MEILISEARCH_SONG_FILTER?.trim();
  if (custom) return custom;
  return 'type = "SONG"';
}

function buildMeilisearchFilters(body: {
  songsOnly?: boolean;
  genre?: string;
}): string[] | undefined {
  const envFilters = parseEnvFilterList();
  const filters: string[] = envFilters ? [...envFilters] : [];

  if (body.songsOnly !== false && !envFilters?.length) {
    filters.push(songTypeFilterClause());
  }

  const rawGenre = body.genre?.trim();
  if (rawGenre) {
    const cut = rawGenre.slice(0, MAX_GENRE_LEN);
    filters.push(`genres = "${escapeFilterValue(cut)}"`);
  }
  return filters.length ? filters : undefined;
}

function buildMeiliHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  return headers;
}

async function runMeiliSearch(
  baseUrl: string,
  index: string,
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<MeiliSearchResponse> {
  const response = await fetch(`${baseUrl}/indexes/${index}/search`, {
    method: "POST",
    headers: buildMeiliHeaders(apiKey),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new MeiliSearchError(response.status, text);
  }
  return (await response.json()) as MeiliSearchResponse;
}

function isRecoverableFilterError(err: unknown): err is MeiliSearchError {
  if (!(err instanceof MeiliSearchError)) return false;
  if (err.status !== 400 && err.status !== 422) return false;
  return /filter|filterable|invalid_search_filter|invalid_filter/i.test(
    `${err.message}\n${err.body}`,
  );
}

function omitFilter(payload: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...payload };
  delete rest.filter;
  return rest;
}

function stringValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}

function hitLooksLikeSong(hit: MeiliHit): boolean {
  const types = stringValues(hit.type).map((v) => v.toUpperCase());
  if (types.length) return types.includes("SONG");

  // Older indexes may not expose `type`, but still return song-shaped records.
  return Boolean(
    hit.song_name || hit.name_he || hit.name_en || hit.title || hit.name,
  );
}

function pickBestResolveHit(
  query: { song_name?: string; artist?: string },
  hits: MeiliHit[] | undefined,
): MeiliHit | undefined {
  if (!hits?.length) return undefined;
  const song = String(query.song_name ?? "").trim();
  const artist = String(query.artist ?? "").trim();
  if (!song && !artist) return hits[0];

  let best: MeiliHit | undefined;
  let bestScore = 0;
  for (const hit of hits) {
    const score = matchConfidence(
      song,
      artist,
      msHitLikeFromMeiliRecord(hit),
    );
    if (score > bestScore) {
      bestScore = score;
      best = hit;
    }
  }
  if (best && bestScore >= REVIEW_THRESHOLD) return best;
  return hits[0];
}

function hitMatchesGenre(hit: MeiliHit, genre: string | undefined): boolean {
  const target = genre?.trim().toLocaleLowerCase();
  if (!target) return true;

  const genres = [
    ...stringValues(hit.genres),
    ...stringValues(hit.genre),
  ].map((v) => v.toLocaleLowerCase());

  // If the index does not expose genre fields, keep the hit instead of making
  // the fallback search look broken.
  if (!genres.length) return true;
  return genres.includes(target);
}

function applyLocalFilters(
  hits: MeiliHit[] | undefined,
  filters: { songsOnly?: boolean; genre?: string },
  limit: number,
): MeiliHit[] {
  return (hits ?? [])
    .filter((hit) => filters.songsOnly === false || hitLooksLikeSong(hit))
    .filter((hit) => hitMatchesGenre(hit, filters.genre))
    .slice(0, limit);
}

async function runMeiliSearchWithFilterFallback(
  baseUrl: string,
  index: string,
  apiKey: string,
  payload: Record<string, unknown>,
  filters: { songsOnly?: boolean; genre?: string },
  limit: number,
  fallbackPayload: Record<string, unknown> = omitFilter(payload),
): Promise<MeiliSearchResponse & { _filterFallback?: true }> {
  try {
    return await runMeiliSearch(baseUrl, index, apiKey, payload);
  } catch (err) {
    if (!payload.filter || !isRecoverableFilterError(err)) throw err;

    logger.warn(
      { err: { status: err.status, message: err.message } },
      "Meilisearch filter failed; retrying without server-side filters",
    );

    const fallbackData = await runMeiliSearch(
      baseUrl,
      index,
      apiKey,
      fallbackPayload,
    );
    return {
      ...fallbackData,
      hits: applyLocalFilters(fallbackData.hits, filters, limit),
      _filterFallback: true,
    };
  }
}

// ── Route handler ──────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const {
    q,
    limit: rawLimit = 20,
    songsOnly,
    genre,
  } = req.body as {
    q?: string;
    limit?: number;
    songsOnly?: boolean;
    genre?: string;
  };

  if (!q || typeof q !== "string" || !q.trim()) {
    res.json({ hits: [] });
    return;
  }

  const limit = Math.min(
    Math.max(1, Math.floor(Number(rawLimit)) || 20),
    MAX_LIMIT,
  );

  // ── Primary: Meilisearch ───────────────────────────────────────────────
  if (isMeilisearchConfigured()) {
    const filter = buildMeilisearchFilters({ songsOnly, genre });
    const { baseUrl, apiKey, index } = getMeilisearchConfig();
    const cacheKey = buildSearchCacheKey(q, limit, index, { songsOnly, genre });
    const cached = getSearchCache(cacheKey);
    if (cached) {
      res.json({ hits: cached.hits });
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        q: q.trim(),
        limit,
      };
      if (filter?.length) payload.filter = filter;
      const fallbackPayload = {
        ...omitFilter(payload),
        limit: Math.min(MAX_LIMIT, Math.max(limit * 2, limit)),
      };
      const data = await runMeiliSearchWithFilterFallback(
        baseUrl,
        index,
        apiKey,
        payload,
        { songsOnly, genre },
        limit,
        fallbackPayload,
      );

      const responseBody = data._filterFallback
        ? {
            ...data,
            _warning:
              "חיפוש עם פילטר מלא נכשל או לא החזיר תוצאות — הוצגו תוצאות מסוננות מקומית.",
          }
        : data;
      setSearchCache(cacheKey, { hits: responseBody.hits ?? [] });
      res.json(responseBody);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(502).json({ error: `Search proxy error: ${msg}` });
      return;
    }
  }

  // ── Nothing configured: return empty hits (not 503) ────────────────────
  res.json({
    hits: [],
    _warning: "Search not configured. Set MEILISEARCH_URL/KEY.",
  });
});

router.post("/resolve", async (req, res) => {
  const { songs } = req.body as {
    songs?: Array<{
      id?: string;
      song_name?: string;
      artist?: string;
      album?: string;
    }>;
  };

  if (!Array.isArray(songs)) {
    res.status(400).json({ error: "Expected { songs: [...] }" });
    return;
  }
  if (songs.length > MAX_RESOLVE_ITEMS) {
    res
      .status(400)
      .json({ error: `Too many items (max ${MAX_RESOLVE_ITEMS})` });
    return;
  }
  if (!isMeilisearchConfigured()) {
    res.json({
      hits: songs.map(() => null),
      _warning: "Search not configured. Set MEILISEARCH_URL/KEY.",
    });
    return;
  }

  const { baseUrl, apiKey, index } = getMeilisearchConfig();

  try {
    const resolved = await mapWithConcurrency(
      songs,
      RESOLVE_CONCURRENCY,
      async (song) => {
        const rawId = String(song.id ?? "").trim();
        const safeId = escapeFilterValue(rawId);

        // 1) Strict lookup by uid (database/external id equivalent in index)
        if (safeId) {
          try {
            const byUid = await runMeiliSearch(baseUrl, index, apiKey, {
              q: "",
              limit: 1,
              filter: ['type = "SONG"', `uid = "${safeId}"`],
            });
            const firstUid = Array.isArray(byUid.hits)
              ? byUid.hits[0]
              : undefined;
            if (firstUid) return firstUid;
          } catch (err) {
            if (!isRecoverableFilterError(err)) throw err;
            logger.warn(
              { err: { status: err.status, message: err.message } },
              "Meilisearch uid filter failed; falling back to text resolution",
            );
          }
        }

        // 2) Song-first text lookup (multiple variants for pasted PDF lines).
        const line = [song.artist, song.song_name]
          .filter((p) => String(p ?? "").trim())
          .join(" - ");
        const queries = stagingSearchVariants(line);
        const fallbackQ = `${song.song_name ?? ""} ${song.artist ?? ""}`.trim();
        const searchQs = queries.length ? queries : fallbackQ ? [fallbackQ] : [];
        if (!searchQs.length) return null;

        let bestHit: MeiliHit | undefined;
        let bestScore = 0;
        for (const q of searchQs) {
          const byText = await runMeiliSearchWithFilterFallback(
            baseUrl,
            index,
            apiKey,
            {
              q,
              limit: 12,
              filter: ['type = "SONG"'],
            },
            { songsOnly: true },
            12,
          );
          const picked = pickBestResolveHit(song, byText.hits);
          if (!picked) continue;
          const score = matchConfidence(
            String(song.song_name ?? ""),
            String(song.artist ?? ""),
            msHitLikeFromMeiliRecord(picked),
          );
          if (score > bestScore) {
            bestScore = score;
            bestHit = picked;
          }
        }
        return bestHit ?? null;
      },
    );
    res.json({ hits: resolved });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: `Resolve search proxy error: ${msg}` });
  }
});

export default router;
