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
  loadStoredGenre,
  persistGenre,
  toSearchFilters,
} from '@/lib/search-filters';

type SearchFiltersContextValue = {
  filters: SearchFilterOptions;
  genreInput: string;
  setGenre: (v: string) => void;
};

const SearchFiltersContext = createContext<SearchFiltersContextValue | null>(
  null,
);

export function SearchFiltersProvider({ children }: { children: React.ReactNode }) {
  const [genre, setGenreState] = useState('');

  useEffect(() => {
    setGenreState(loadStoredGenre());
  }, []);

  const filters = useMemo(() => toSearchFilters(genre), [genre]);

  useEffect(() => {
    persistGenre(genre);
  }, [genre]);

  const setGenre = useCallback((v: string) => {
    setGenreState(v);
  }, []);

  const value = useMemo(
    () => ({
      filters,
      genreInput: genre,
      setGenre,
    }),
    [filters, genre, setGenre],
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
