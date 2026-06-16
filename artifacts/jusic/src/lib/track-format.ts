import type { MsHit } from '@/lib/meilisearch';
import { newClientId } from '@/lib/ids';

/** Optional duration when catalog exposes it (seconds). */
export function getTrackDurationSeconds(hit: MsHit & { duration?: number; duration_sec?: number }): number | null {
  const raw = hit.duration ?? hit.duration_sec;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  return null;
}

export function formatTrackDuration(hit: MsHit): string {
  const sec = getTrackDurationSeconds(hit as MsHit & { duration?: number; duration_sec?: number });
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function getTrackVibeLabel(hit: MsHit): string | null {
  const genre = hit.genre?.trim();
  if (genre) return genre.length > 14 ? `${genre.slice(0, 12)}…` : genre;
  const tag = hit.tags?.find((t) => t.trim().length > 0);
  return tag ? (tag.length > 14 ? `${tag.slice(0, 12)}…` : tag) : null;
}

/** Stable React / DnD key — playlist rows use `_id`; catalog hits use catalog `id`. */
export function trackRowKey(hit: MsHit): string {
  if (hit._id) return hit._id;
  if (hit.id) return hit.id;
  const artist = hit.artist?.trim() ?? '';
  const title = hit.song_name?.trim() ?? '';
  return `track-${artist}|${title}`.toLocaleLowerCase();
}

/** Ensure every playlist row has a unique instance id (survives draft reload). */
export function ensureTrackInstanceId(song: MsHit): MsHit {
  return song._id ? song : { ...song, _id: newClientId() };
}

export function tracksAreSame(a: MsHit | null | undefined, b: MsHit | null | undefined): boolean {
  if (!a || !b) return false;
  return trackRowKey(a) === trackRowKey(b);
}
