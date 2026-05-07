import { useQuery } from "@tanstack/react-query";
import { meilisearchSearch, type MsHit } from "../lib/meilisearch";
import { useDebounce } from "./use-debounce";

const SEARCH_STALE_TIME = 1000 * 60 * 5; // 5 min — matches API LRU TTL

export function useSearch(query: string, limit = 20) {
  const debouncedQuery = useDebounce(query, 350);
  const enabled = debouncedQuery.trim().length >= 2;

  const { data, isFetching, isError } = useQuery<MsHit[]>({
    queryKey: ["search", debouncedQuery.trim().toLowerCase(), limit],
    queryFn: () => meilisearchSearch(debouncedQuery, limit),
    enabled,
    staleTime: SEARCH_STALE_TIME,
    // Keep showing the previous page's results while the next page loads
    placeholderData: (prev) => prev,
  });

  return {
    results: enabled ? (data ?? []) : [],
    isFetching,
    isError,
    debouncedQuery,
  };
}
