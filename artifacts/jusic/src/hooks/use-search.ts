import { useQuery } from '@tanstack/react-query';
import { meilisearchSearch, type MsHit } from '../lib/meilisearch';
import type { SearchFilterOptions } from '../lib/search-filters';
import { SONGS_ONLY_FILTERS } from '../lib/search-filters';
import { useDebounce } from './use-debounce';

const SEARCH_STALE_TIME = 1000 * 60 * 5;

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
  const debouncedQuery = useDebounce(query, 300);
  const trimmed = debouncedQuery.trim();
  const enabled = trimmed.length >= 2;
  const genreKey = filters.genre?.toLocaleLowerCase() ?? '';

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['search', trimmed.toLocaleLowerCase(), limit, genreKey],
    queryFn: async () => meilisearchSearch(trimmed, limit, filters),
    enabled,
    staleTime: SEARCH_STALE_TIME,
    placeholderData: (prev) => prev,
    retry: 1,
  });

  return {
    results: enabled ? (data?.hits ?? []) : [],
    warning: data?.warning,
    isFetching,
    isError,
    error: isError && error instanceof Error ? error : null,
    debouncedQuery: trimmed,
    enabled,
  };
}
