import type { SearchResponse } from './meilisearch';
import type { SearchFilterOptions } from './search-filters';

const MAX_CACHE_ENTRIES = 128;
const CACHE_TTL_MS = 1000 * 60 * 5;

type CacheEntry = {
  result: SearchResponse;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

function buildCacheKey(query: string, limit: number, filters: SearchFilterOptions): string {
  const genre = filters.genre?.toLocaleLowerCase() ?? '';
  return `${query.trim().toLocaleLowerCase()}|${limit}|${genre}`;
}

export function getCachedSearch(
  query: string,
  limit: number,
  filters: SearchFilterOptions,
): SearchResponse | null {
  const key = buildCacheKey(query, limit, filters);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

export function setCachedSearch(
  query: string,
  limit: number,
  filters: SearchFilterOptions,
  result: SearchResponse,
): void {
  const key = buildCacheKey(query, limit, filters);
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function clearSearchCache(): void {
  cache.clear();
}
