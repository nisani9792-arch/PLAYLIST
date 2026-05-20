import { Router } from "express";
import { buildTopicQueries, parseVibeFromPrompt } from "@workspace/curator";
import { searchTopicBatch } from "../lib/meilisearch-service";
import {
  isExactSongArtistMatch,
  isExactSongTitleMatch,
  isPlaceholderExportArtist,
  LOMDAAT_EXPORT_THRESHOLD,
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

function pickResolveHit(
  query: { song_name?: string; artist?: string },
  hits: MeiliHit[] | undefined,
  minScore: number,
  exportMode = false,
): { hit: MeiliHit; score: number } | null {
  if (!hits?.length) return null;
  const song = String(query.song_name ?? "").trim();
  const artist = String(query.artist ?? "").trim();
  if (!song && !artist) return null;

  let best: MeiliHit | undefined;
  let bestScore = 0;
  for (const hit of hits) {
    const like = msHitLikeFromMeiliRecord(hit);
    let score = matchConfidence(song, artist, like);

    const songExact = song && isExactSongTitleMatch(song, like.song_name);
    const pairExact =
      song &&
      artist &&
      isExactSongArtistMatch(
        { song_name: song, artist },
        { song_name: like.song_name, artist: like.artist },
      );
    if (pairExact) score = 1;
    else if (songExact && (!artist || isPlaceholderExportArtist(artist))) {
      score = Math.max(score, 0.92);
    } else if (songExact) {
      score = Math.max(score, matchConfidence(song, artist, like));
    }

    if (exportMode && song && artist && !isPlaceholderExportArtist(artist)) {
      const artistScore = matchConfidence("", artist, like);
      if (!pairExact && artistScore < 0.42 && !songExact) continue;
    }

    if (score > bestScore) {
      bestScore = score;
      best = hit;
    }
  }
  if (!best || bestScore < minScore) return null;
  return { hit: best, score: bestScore };
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
  const { songs, export: exportMode } = req.body as {
    songs?: Array<{
      id?: string;
      song_name?: string;
      artist?: string;
      album?: string;
    }>;
    export?: boolean;
  };

  const minScore = exportMode ? LOMDAAT_EXPORT_THRESHOLD : REVIEW_THRESHOLD;

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
        const songName = String(song.song_name ?? "").trim();
        const artistName = String(song.artist ?? "").trim();

        const accept = (hit: MeiliHit): { hit: MeiliHit; score: number } | null => {
          const picked = pickResolveHit(song, [hit], minScore, exportMode);
          return picked;
        };

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
            const uidMatch = firstUid ? accept(firstUid) : null;
            if (uidMatch && exportMode) return uidMatch;
            if (uidMatch) return uidMatch;
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
        const searchQs = [...queries];
        if (songName && isPlaceholderExportArtist(artistName)) {
          searchQs.unshift(songName);
        }
        const fallbackQ = `${songName} ${artistName}`.trim();
        if (fallbackQ && !searchQs.includes(fallbackQ)) {
          searchQs.push(fallbackQ);
        }
        const uniqueQs = [...new Set(searchQs.filter((q) => q.trim().length >= 2))];
        if (!uniqueQs.length) return null;

        let best: { hit: MeiliHit; score: number } | null = null;
        for (const q of uniqueQs) {
          const byText = await runMeiliSearchWithFilterFallback(
            baseUrl,
            index,
            apiKey,
            {
              q,
              limit: exportMode ? 24 : 12,
              filter: ['type = "SONG"'],
            },
            { songsOnly: true },
            exportMode ? 24 : 12,
          );
          const picked = pickResolveHit(song, byText.hits, minScore, exportMode);
          if (picked && (!best || picked.score > best.score)) {
            best = picked;
          }
        }
        return best;
      },
    );
    res.json({
      hits: resolved.map((r) => r?.hit ?? null),
      results: resolved.map((r, i) => {
        if (r) return { hit: r.hit, confidence: r.score };
        const song = songs[i];
        const songName = String(song?.song_name ?? "").trim();
        const artistName = String(song?.artist ?? "").trim();
        if (!songName && !artistName) {
          return { hit: null, failedReason: "empty" as const };
        }
        return { hit: null, failedReason: "no_match" as const };
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: `Resolve search proxy error: ${msg}` });
  }
});

router.post("/topic", async (req, res) => {
  const { topic, vibe: vibeInput, limit: rawLimit = 40, excludeIds, genre } = req.body as {
    topic?: string;
    vibe?: string;
    limit?: number;
    excludeIds?: string[];
    genre?: string;
  };

  if (!topic?.trim()) {
    res.status(400).json({ error: "Missing topic" });
    return;
  }

  const limit = Math.min(Math.max(1, Math.floor(Number(rawLimit)) || 40), MAX_LIMIT);
  const vibe = parseVibeFromPrompt(vibeInput ? `${topic} ${vibeInput}` : topic);
  const queries = buildTopicQueries(topic, vibe);
  const hits = await searchTopicBatch(queries, Math.ceil(limit / queries.length) + 5, genre);

  const exclude = new Set((excludeIds ?? []).map((id) => String(id).toLowerCase()));
  const filtered = hits.filter((h) => !exclude.has(String(h.id).toLowerCase())).slice(0, limit);

  res.json({
    hits: filtered,
    totalAvailable: hits.length,
    facets: { genre: vibe.genreHints, mood: vibe.mood },
  });
});

export default router;
