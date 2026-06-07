import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { meilisearchSearch, type MsHit } from '../lib/meilisearch';
import type { SearchFilterOptions } from '../lib/search-filters';
import { SONGS_ONLY_FILTERS } from '../lib/search-filters';
import { useDebounce } from './use-debounce';
import { applyClientSearchFilters } from '@/lib/client-search-filters';
import { useWorkspaceStore } from '@/stores/workspace-store';

const SEARCH_STALE_TIME = 1000 * 60 * 5;
const SEARCH_DEBOUNCE_MS = 450;

export type SearchQueryResult = {
  results: MsHit[];
  warning?: string;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  debouncedQuery: string;
  enabled: boolean;
};

export function useSearch(
  query: string,
  limit = 20,
  filters: SearchFilterOptions = SONGS_ONLY_FILTERS,
): SearchQueryResult {
  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);
  const trimmed = debouncedQuery.trim();
  const enabled = trimmed.length >= 2;
  const genreKey = filters.genre?.toLocaleLowerCase() ?? '';
  const vibeFilter = useWorkspaceStore((s) => s.vibeFilter);
  const hashkafaShield = useWorkspaceStore((s) => s.hashkafaShield);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['search', trimmed.toLocaleLowerCase(), limit, genreKey],
    queryFn: async () => meilisearchSearch(trimmed, limit, filters),
    enabled,
    staleTime: SEARCH_STALE_TIME,
    gcTime: SEARCH_STALE_TIME * 2,
    placeholderData: (prev) => prev,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
  });

  const results = useMemo(() => {
    if (!enabled) return [];
    const hits = data?.hits ?? [];
    if (!vibeFilter && !hashkafaShield) return hits;
    return applyClientSearchFilters(hits, { vibeFilter, hashkafaShield });
  }, [enabled, data?.hits, vibeFilter, hashkafaShield]);

  return {
    results,
    warning: data?.warning,
    isFetching,
    isError,
    error: isError && error instanceof Error ? error : null,
    debouncedQuery: trimmed,
    enabled,
  };
}
