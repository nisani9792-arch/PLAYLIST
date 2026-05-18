import {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import type { SearchFilterOptions } from '@/lib/search-filters';
import { SONGS_ONLY_FILTERS } from '@/lib/search-filters';

type SearchFiltersContextValue = {
  filters: SearchFilterOptions;
  genreInput: string;
  setGenre: (v: string) => void;
};

const SearchFiltersContext = createContext<SearchFiltersContextValue | null>(
  null,
);

export function SearchFiltersProvider({ children }: { children: React.ReactNode }) {
  const setGenre = useCallback((_v: string) => {
    /* genre filter removed from UI */
  }, []);

  const value = useMemo(
    () => ({
      filters: SONGS_ONLY_FILTERS,
      genreInput: '',
      setGenre,
    }),
    [setGenre],
  );

  return (
    <SearchFiltersContext.Provider value={value}>
      {children}
    </SearchFiltersContext.Provider>
  );
}

export function useSearchFilters(): SearchFiltersContextValue {
  const ctx = useContext(SearchFiltersContext);
  if (!ctx) {
    throw new Error('useSearchFilters must be used within SearchFiltersProvider');
  }
  return ctx;
}
