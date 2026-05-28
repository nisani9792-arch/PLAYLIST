import type { MsHit } from '@/lib/meilisearch';

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

export function trackRowKey(hit: MsHit): string {
  return hit._id || hit.id;
}
