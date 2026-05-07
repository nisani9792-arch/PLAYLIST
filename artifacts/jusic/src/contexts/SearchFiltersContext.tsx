import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { SearchFilterOptions } from '@/lib/search-filters';
import {
  loadStoredSearchFilters,
  persistSearchFilters,
} from '@/lib/search-filters';

type SearchFiltersContextValue = {
  filters: SearchFilterOptions;
  /** Raw genre text in the input (before trim in `filters.genre`) */
  genreInput: string;
  setSongsOnly: (v: boolean) => void;
  setGenre: (v: string) => void;
};

const SearchFiltersContext = createContext<SearchFiltersContextValue | null>(
  null,
);

export function SearchFiltersProvider({ children }: { children: React.ReactNode }) {
  const [songsOnly, setSongsOnlyState] = useState(true);
  const [genre, setGenreState] = useState('');

  useEffect(() => {
    const s = loadStoredSearchFilters();
    setSongsOnlyState(s.songsOnly);
    setGenreState(s.genre ?? '');
  }, []);

  const filters = useMemo(
    (): SearchFilterOptions => ({
      songsOnly,
      genre: genre.trim() || undefined,
    }),
    [songsOnly, genre],
  );

  useEffect(() => {
    persistSearchFilters(filters);
  }, [filters]);

  const setSongsOnly = useCallback((v: boolean) => {
    setSongsOnlyState(v);
  }, []);

  const setGenre = useCallback((v: string) => {
    setGenreState(v);
  }, []);

  const value = useMemo(
    () => ({
      filters,
      genreInput: genre,
      setSongsOnly,
      setGenre,
    }),
    [filters, genre, setSongsOnly, setGenre],
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
