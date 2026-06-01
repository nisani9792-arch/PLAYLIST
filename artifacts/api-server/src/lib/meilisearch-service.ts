import {
  expandTopicFacets,
  parseVibeFromPrompt,
  scoreHitForTopic,
} from "@workspace/curator";
import {
  msHitLikeFromMeiliRecord,
  type MsHitLike,
} from "@workspace/playlist-validation";
import {
  getMeilisearchConfig,
  isMeilisearchConfigured,
} from "./meilisearch-config";
import { buildSearchCacheKey, getSearchCache, setSearchCache } from "./search-cache";

type MeiliHit = Record<string, unknown>;

function songTypeFilterClause(): string {
  const custom = process.env.MEILISEARCH_SONG_FILTER?.trim();
  if (custom) return custom;
  return 'type = "SONG"';
}

function buildMeiliHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

async function runMeiliSearch(
  q: string,
  limit: number,
  genre?: string,
): Promise<MeiliHit[]> {
  if (!isMeilisearchConfigured()) return [];
  const { baseUrl, apiKey, index } = getMeilisearchConfig();
  const cacheKey = buildSearchCacheKey(q, limit, index, { songsOnly: true, genre });
  const cached = getSearchCache(cacheKey);
  if (cached) return cached.hits as MeiliHit[];

  const filters = [songTypeFilterClause()];
  if (genre?.trim()) {
    filters.push(`genres = "${genre.trim().replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  }

  const payload: Record<string, unknown> = { q: q.trim(), limit };
  if (filters.length) payload.filter = filters;

  let response = await fetch(`${baseUrl}/indexes/${index}/search`, {
    method: "POST",
    headers: buildMeiliHeaders(apiKey),
    body: JSON.stringify(payload),
  });

  if (!response.ok && payload.filter) {
    response = await fetch(`${baseUrl}/indexes/${index}/search`, {
      method: "POST",
      headers: buildMeiliHeaders(apiKey),
      body: JSON.stringify({ q: q.trim(), limit }),
    });
  }

  if (!response.ok) return [];
  const data = (await response.json()) as { hits?: MeiliHit[] };
  const hits = data.hits ?? [];
  setSearchCache(cacheKey, { hits });
  return hits;
}

export function meiliHitToMsHitLike(hit: MeiliHit, rankingScore?: number): MsHitLike {
  const like = msHitLikeFromMeiliRecord(hit);
  return {
    ...like,
    _rankingScore: rankingScore ?? (typeof hit._rankingScore === "number" ? hit._rankingScore : 0.5),
  };
}

export async function searchCatalogQuery(
  q: string,
  limit = 30,
  genre?: string,
): Promise<MsHitLike[]> {
  const hits = await runMeiliSearch(q, limit, genre);
  return hits.map((h) =>
    meiliHitToMsHitLike(h, typeof h._rankingScore === "number" ? h._rankingScore : 0.5),
  );
}

export async function searchTopicBatch(
  queries: string[],
  limitPerQuery = 25,
  genre?: string | string[],
): Promise<MsHitLike[]> {
  const merged = new Map<string, MsHitLike>();
  const genres = Array.isArray(genre)
    ? genre.filter(Boolean)
    : genre?.trim()
      ? [genre.trim()]
      : [undefined];

  // Prefer upbeat genre-filtered searches first when multiple genres supplied.
  const orderedGenres = [...genres].sort((a, b) => {
    const upbeat = /מזרחי|פופ|דנס|dance|pop|electronic|club/i;
    const aUp = a && upbeat.test(a) ? 0 : 1;
    const bUp = b && upbeat.test(b) ? 0 : 1;
    return aUp - bUp;
  });

  for (const q of queries) {
    for (const g of orderedGenres) {
      const hits = await searchCatalogQuery(q, limitPerQuery, g);
      for (const hit of hits) {
        const key = `${hit.artist}|${hit.song_name}`.toLowerCase();
        const existing = merged.get(key);
        if (!existing || (hit._rankingScore ?? 0) > (existing._rankingScore ?? 0)) {
          merged.set(key, hit);
        }
      }
    }
  }
  return [...merged.values()];
}

export function scoreHitAgainstTopic(hit: MsHitLike, topic: string): number {
  const vibe = parseVibeFromPrompt(topic);
  const facets = expandTopicFacets(topic, vibe);
  return scoreHitForTopic(hit, { topic, vibe, facets });
}
