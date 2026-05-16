import { normalizeHebrew } from "./normalize";

const FILE_EXT_RE =
  /\.(wma|mp3|wav|m4a|flac|aac|ogg|wmv|mp4|avi|mkv)\b/gi;

const NOISE_SUFFIX_RE =
  /\s*[-–—]\s*(סינגל|single|אקוסטי|remix|גרסה\s*חדשה)\s*$/i;

/** Strip local file extensions and trailing noise from pasted lines. */
export function sanitizePlaylistLine(raw: string): string {
  return raw
    .replace(FILE_EXT_RE, "")
    .replace(NOISE_SUFFIX_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function playlistLineKey(line: string): string {
  return normalizeHebrew(sanitizePlaylistLine(line));
}

/** Dedupe sanitized lines while preserving first occurrence order. */
export function dedupePlaylistLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const line = sanitizePlaylistLine(raw);
    if (!line) continue;
    const key = playlistLineKey(line);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

export function parseArtistSongLine(line: string): {
  artist: string;
  song: string;
  whole: string;
} {
  const cleaned = sanitizePlaylistLine(line).replace(/^[\d.)\-\s]+/, "");
  const sep = cleaned.match(/\s[-–—:]\s/);
  if (!sep) return { artist: "", song: cleaned, whole: cleaned };
  const [left = "", right = ""] = cleaned.split(sep[0], 2);
  if (!left.trim() || !right.trim()) {
    return { artist: "", song: cleaned, whole: cleaned };
  }
  return { artist: left.trim(), song: right.trim(), whole: cleaned };
}
