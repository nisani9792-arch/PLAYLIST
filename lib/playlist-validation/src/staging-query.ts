import {
  isArtistOnlyPlaylistLine,
  parseArtistSongLine,
  sanitizePlaylistLine,
} from "./sanitize";

/** Meilisearch query: song-first; never artist-only. */
export function buildStagingSearchQuery(
  line: string,
  psh?: { artist?: string; title?: string } | null,
): string | null {
  if (psh?.title?.trim()) {
    const song = psh.title.trim();
    const artist = psh.artist?.trim() ?? "";
    return artist ? `${song} ${artist}` : song;
  }

  const cleaned = sanitizePlaylistLine(line);
  if (!cleaned || isArtistOnlyPlaylistLine(cleaned)) return null;

  const { artist, song } = parseArtistSongLine(cleaned);
  if (artist && song) return `${song} ${artist}`.trim();
  return song.trim() || cleaned;
}

/** Compact label for staging UI (avoids multi-line PDF noise). */
export function formatStagingDisplayLabel(line: string): string {
  const cleaned = sanitizePlaylistLine(line);
  const { artist, song } = parseArtistSongLine(cleaned);
  if (artist && song) return `${artist} – ${song}`;
  if (cleaned.length > 88) return `${cleaned.slice(0, 86)}…`;
  return cleaned;
}

/** Search variants for staging (song-weighted, no artist-only). */
export function stagingSearchVariants(line: string): string[] {
  const primary = buildStagingSearchQuery(line);
  if (!primary) return [];

  const { song } = parseArtistSongLine(sanitizePlaylistLine(line));
  const variants = [primary];
  if (song.trim() && song.trim() !== primary) variants.push(song.trim());

  const seen = new Set<string>();
  return variants
    .map((v) => v.trim())
    .filter((v) => {
      if (v.length < 2) return false;
      const key = v.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 2);
}
