/** Options sent to POST /api/search — kept in sync with api-server routes/search.ts */
export type SearchFilterOptions = {
  /** Always true — only songs are searchable in BUILD PLAY */
  songsOnly: true;
  /** Optional exact genre filter if your index exposes `genres` */
  genre?: string;
};

export const SONGS_ONLY_FILTERS: SearchFilterOptions = {
  songsOnly: true,
  genre: undefined,
};

const STORAGE_KEY = 'buildplay_search_genre';

export function loadStoredGenre(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return typeof raw === 'string' ? raw.trim() : '';
  } catch {
    return '';
  }
}

export function persistGenre(genre: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, genre.trim());
  } catch {
    /* ignore */
  }
}

export function toSearchFilters(genreInput: string): SearchFilterOptions {
  const genre = genreInput.trim() || undefined;
  return genre ? { songsOnly: true, genre } : SONGS_ONLY_FILTERS;
}
