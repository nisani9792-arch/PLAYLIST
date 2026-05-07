/** Options sent to POST /api/search — kept in sync with api-server routes/search.ts */
export type SearchFilterOptions = {
  /** When true (default), applies Meilisearch filter type = SONG */
  songsOnly: boolean;
  /** Optional exact genre filter if your index exposes `genres` */
  genre?: string;
};

export const DEFAULT_SEARCH_FILTERS: SearchFilterOptions = {
  songsOnly: true,
  genre: undefined,
};

const STORAGE_KEY = 'jusic_search_filters';

export function loadStoredSearchFilters(): SearchFilterOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SEARCH_FILTERS };
    const parsed = JSON.parse(raw) as Partial<SearchFilterOptions>;
    const g = typeof parsed.genre === 'string' ? parsed.genre.trim() : '';
    return {
      songsOnly: parsed.songsOnly !== false,
      genre: g || undefined,
    };
  } catch {
    return { ...DEFAULT_SEARCH_FILTERS };
  }
}

export function persistSearchFilters(filters: SearchFilterOptions): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        songsOnly: filters.songsOnly,
        genre: filters.genre?.trim() || '',
      }),
    );
  } catch {
    /* ignore */
  }
}
