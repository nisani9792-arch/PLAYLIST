import { LRUCache } from "lru-cache";

/** Maximum number of unique (query, limit) pairs kept in memory. */
const MAX_ENTRIES = Number(process.env.SEARCH_CACHE_MAX ?? "200");

/** Time-to-live in ms. Defaults to 5 minutes — matches the client-side staleTime. */
const TTL_MS = Number(process.env.SEARCH_CACHE_TTL_MS ?? String(1000 * 60 * 5));

interface CachedSearchResult {
  hits: unknown[];
}

const cache = new LRUCache<string, CachedSearchResult>({
  max: MAX_ENTRIES,
  ttl: TTL_MS,
});

export function buildSearchCacheKey(q: string, limit: number, index: string): string {
  return `${index}::${q.trim().toLowerCase()}::${limit}`;
}

export function getSearchCache(key: string): CachedSearchResult | undefined {
  return cache.get(key);
}

export function setSearchCache(key: string, value: CachedSearchResult): void {
  cache.set(key, value);
}

export function getSearchCacheStats() {
  return {
    size: cache.size,
    max: MAX_ENTRIES,
    ttlMs: TTL_MS,
  };
}
