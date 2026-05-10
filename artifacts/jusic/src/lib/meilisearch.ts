import type { SearchFilterOptions } from './search-filters';
import { DEFAULT_SEARCH_FILTERS } from './search-filters';

export interface MsHit {
  id: string;
  song_name: string;
  artist: string;
  genre: string;
  album: string;
  audio_url: string;
  tags: string[];
  /** Stable key for drag-and-drop lists (client-only). */
  _id?: string;
  /** Meilisearch ranking score when returned by the API. */
  _rankingScore?: number;
}

function normalizeHit(hit: Record<string, unknown>): MsHit {
  const artists = Array.isArray(hit.artists)
    ? hit.artists.join(', ')
    : String(hit.artist || hit.artist_name || '');
  const genres = Array.isArray(hit.genres)
    ? hit.genres[0] || ''
    : String(hit.genre || '');
  const tags = Array.isArray(hit.tags) ? hit.tags : [];
  const ranking =
    typeof hit._rankingScore === 'number' ? hit._rankingScore : undefined;

  return {
    id: String(hit.uid ?? hit.id ?? Math.random()),
    song_name: String(
      hit.name_he || hit.name_en || hit.song_name || hit.name || hit.title || 'Unknown',
    ),
    artist: artists || 'Unknown',
    genre: String(genres || ''),
    album: String(hit.album || ''),
    audio_url: String(hit.audio_url || hit.stream_url || hit.preview_url || ''),
    tags: tags as string[],
    _rankingScore: ranking,
  };
}

export async function meilisearchSearch(
  query: string,
  limit = 20,
  filters: SearchFilterOptions = DEFAULT_SEARCH_FILTERS,
): Promise<MsHit[]> {
  if (!query.trim()) return [];

  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: query,
      limit,
      songsOnly: filters.songsOnly,
      genre: filters.genre,
    }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const errBody = (await res.json()) as { error?: string };
      detail = errBody.error ? String(errBody.error) : '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Search error: ${res.status}`);
  }

  const data = (await res.json()) as { hits?: Record<string, unknown>[] };
  const hits = (data.hits || []).map((h) => normalizeHit(h));
  return hits;
}

export async function resolveSongsForOdoo(songs: MsHit[]): Promise<Array<MsHit | null>> {
  if (!songs.length) return [];

  const res = await fetch('/api/search/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      songs: songs.map((s) => ({
        id: s.id,
        song_name: s.song_name,
        artist: s.artist,
        album: s.album,
      })),
    }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const errBody = (await res.json()) as { error?: string };
      detail = errBody.error ? String(errBody.error) : '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Resolve error: ${res.status}`);
  }

  const data = (await res.json()) as { hits?: Array<Record<string, unknown> | null> };
  return (data.hits || []).map((h) => (h ? normalizeHit(h) : null));
}
