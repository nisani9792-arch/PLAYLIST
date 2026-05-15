import type { SearchFilterOptions } from './search-filters';
import { SONGS_ONLY_FILTERS } from './search-filters';
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

export type SearchResponse = {
  hits: MsHit[];
  warning?: string;
};

function stableHitId(hit: Record<string, unknown>): string {
  const uid = String(hit.uid ?? hit.id ?? "").trim();
  if (uid) return uid;
  const name = String(hit.song_name ?? hit.name_he ?? hit.name ?? hit.title ?? "");
  const artist = String(hit.artist ?? hit.artist_name ?? "");
  const key = `${artist}|${name}`.toLocaleLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return `local-${Math.abs(hash)}`;
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
    id: stableHitId(hit),
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
  filters: SearchFilterOptions = SONGS_ONLY_FILTERS,
): Promise<SearchResponse> {
  if (!query.trim()) return { hits: [] };

  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: query,
      limit,
      songsOnly: true,
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

  const data = (await res.json()) as {
    hits?: Record<string, unknown>[];
    _warning?: string;
  };
  const hits = (data.hits || []).map((h) => normalizeHit(h));
  const warning =
    typeof data._warning === 'string' && data._warning.trim()
      ? data._warning.trim()
      : undefined;

  return { hits, warning };
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
