import {
  odooImportArtistFromHit,
  odooImportSongNameFromHit,
} from '@workspace/playlist-validation';
import type { SearchFilterOptions } from './search-filters';
import { SONGS_ONLY_FILTERS } from './search-filters';
import { getCachedSearch, setCachedSearch } from './search-cache';

export interface MsHit {
  id: string;
  song_name: string;
  artist: string;
  genre: string;
  album: string;
  audio_url: string;
  tags: string[];
  /** Album cover when available from catalog. */
  cover_url?: string;
  /** Stable key for drag-and-drop lists (client-only). */
  _id?: string;
  /** Meilisearch ranking score when returned by the API. */
  _rankingScore?: number;
}

export type SearchResponse = {
  hits: MsHit[];
  warning?: string;
};

export type OdooResolveResult = {
  raw: Record<string, unknown>;
  confidence: number;
  song_name: string;
  artist: string;
  /** Similar catalog hits when strict resolve failed (export mode). */
  alternatives?: MsHit[];
} | null;

function stableHitId(hit: Record<string, unknown>): string {
  const uid = String(hit.uid ?? hit.id ?? '').trim();
  if (uid) return uid;
  const name = String(hit.song_name ?? hit.name_he ?? hit.name ?? hit.title ?? '');
  const artist = String(hit.artist ?? hit.artist_name ?? '');
  const key = `${artist}|${name}`.toLocaleLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return `local-${Math.abs(hash)}`;
}

function normalizeHit(hit: Record<string, unknown>): MsHit {
  const artists = odooImportArtistFromHit(hit);
  const genres = Array.isArray(hit.genres)
    ? hit.genres[0] || ''
    : String(hit.genre || '');
  const tags = Array.isArray(hit.tags) ? hit.tags : [];
  const ranking =
    typeof hit._rankingScore === 'number' ? hit._rankingScore : undefined;

  return {
    id: stableHitId(hit),
    song_name: odooImportSongNameFromHit(hit) || 'Unknown',
    artist: artists || 'Unknown',
    genre: String(genres || ''),
    album: String(hit.album || ''),
    audio_url: String(hit.audio_url || hit.stream_url || hit.preview_url || ''),
    cover_url: String(
      hit.cover_url || hit.album_art || hit.image_url || hit.thumbnail || '',
    ) || undefined,
    tags: tags as string[],
    _rankingScore: ranking,
  };
}

export async function meilisearchSearch(
  query: string,
  limit = 20,
  filters: SearchFilterOptions = SONGS_ONLY_FILTERS,
): Promise<SearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) return { hits: [] };

  const cached = getCachedSearch(trimmed, limit, filters);
  if (cached) return cached;

  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: trimmed,
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

  const response = { hits, warning };
  setCachedSearch(trimmed, limit, filters, response);
  return response;
}

/** Strict catalog resolve for Lomdaat/Odoo export (high-confidence matches only). */
export async function resolveSongsForOdoo(
  songs: MsHit[],
): Promise<OdooResolveResult[]> {
  if (!songs.length) return [];

  const res = await fetch('/api/search/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      export: true,
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

  const data = (await res.json()) as {
    results?: Array<{
      hit: Record<string, unknown> | null;
      confidence?: number;
      alternatives?: Record<string, unknown>[];
    } | null>;
    hits?: Array<Record<string, unknown> | null>;
  };

  const results = data.results;
  if (results?.length) {
    return results.map((r) => {
      if (r?.hit && typeof r.hit === "object") {
        return {
          raw: r.hit,
          confidence: r.confidence ?? 1,
          song_name: odooImportSongNameFromHit(r.hit),
          artist: odooImportArtistFromHit(r.hit),
        };
      }
      const alts = (r?.alternatives ?? [])
        .filter((h): h is Record<string, unknown> => Boolean(h && typeof h === "object"))
        .map((h) => normalizeHit(h));
      if (alts.length) {
        return {
          raw: {},
          confidence: 0,
          song_name: "",
          artist: "",
          alternatives: alts,
        };
      }
      return null;
    });
  }

  return (data.hits || []).map((h) =>
    h && typeof h === "object"
      ? {
          raw: h,
          confidence: 1,
          song_name: odooImportSongNameFromHit(h),
          artist: odooImportArtistFromHit(h),
        }
      : null,
  );
}
