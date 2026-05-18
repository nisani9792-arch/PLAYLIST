import { countHebrewLetters, countLatinLetters } from "./lomdaat-export";
import { normalizeHebrew } from "./normalize";

const ARTIST_NAME_MARKERS = /(?:\s|^)(בן|בת|הרב|ר'|רבי|נ"י)(?:\s|$)/;
const SONG_MARKERS =
  /[()0-9@]|ווקאלי|סינגל|\bעם\s|feat\.?|remix|גרסה|אקוסטי/i;

const FILE_EXT_RE =
  /\.(wma|mp3|wav|m4a|flac|aac|ogg|wmv|mp4|avi|mkv)\b/gi;

const NOISE_SUFFIX_RE =
  /\s*[-–—]\s*(סינגל|single|אקוסטי|remix|גרסה\s*חדשה)\s*$/i;

const EMAIL_RE = /\S+@\S+\.\S+/gi;

const CREATED_BY_RE =
  /\b(?:created\s+by|נוצר\s+ע["״']?י)\b[\s\S]*$/i;

const CATALOG_HEADER_RE =
  /\b(?:the\s+complete|song\s+list|playlist|london\s+20\d{2})\b/i;

/** Lines that are PDF/catalog headers, not songs. */
export function isPlaylistNoiseLine(line: string): boolean {
  const cleaned = line.replace(EMAIL_RE, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return true;
  if (cleaned.length > 160) return true;
  if (EMAIL_RE.test(line)) return true;
  if (CATALOG_HEADER_RE.test(cleaned)) return true;
  if (CREATED_BY_RE.test(line)) return true;

  const he = countHebrewLetters(cleaned);
  const en = countLatinLetters(cleaned);
  if (en > 35 && en > he * 1.5) return true;

  const hasSongSep = /\s[-–—:]\s/.test(cleaned);
  if (!hasSongSep && en > 12 && he < 8) return true;

  return false;
}

/** Pasted PDF artist header without a song — skip search. */
export function isArtistOnlyPlaylistLine(line: string): boolean {
  const cleaned = sanitizePlaylistLine(line);
  if (!cleaned || isPlaylistNoiseLine(cleaned)) return true;

  const sep = cleaned.match(/\s([-–—:])\s/);
  if (sep) {
    const [left = "", right = ""] = cleaned.split(sep[0], 2).map((s) => s.trim());
    if (left && !right) return true;
    return false;
  }

  if (SONG_MARKERS.test(cleaned)) return false;

  const words = cleaned.split(/\s+/).filter((w) => w.length >= 2);
  if (words.length < 2 || words.length > 5) return false;
  if (!words.every((w) => /^[\u0590-\u05FF]/.test(w))) return false;

  return ARTIST_NAME_MARKERS.test(cleaned);
}

function extractHebrewArtistSongChunk(line: string): string | null {
  const matches = [
    ...line.matchAll(
      /([\u0590-\u05FF][\u0590-\u05FF\s'".]{0,70}?)\s*[-–—]\s*([\u0590-\u05FF][\u0590-\u05FF\s'".]{0,90}?)(?=\s{2,}|[,.]|$)/g,
    ),
  ];
  if (!matches.length) return null;
  const last = matches[matches.length - 1];
  if (!last?.[1] || !last[2]) return null;
  return `${last[1].trim()} - ${last[2].trim()}`;
}

/** Strip local file extensions and trailing noise from pasted lines. */
export function sanitizePlaylistLine(raw: string): string {
  let line = raw
    .replace(EMAIL_RE, " ")
    .replace(CREATED_BY_RE, "")
    .replace(FILE_EXT_RE, "")
    .replace(NOISE_SUFFIX_RE, "")
    .replace(/\s+/g, " ")
    .trim();

  if (line.length > 120) {
    const chunk = extractHebrewArtistSongChunk(line);
    if (chunk) line = chunk;
  }

  return line
    .replace(/^[\s\-–—:]+/, "")
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
    if (!line || isPlaylistNoiseLine(line) || isArtistOnlyPlaylistLine(line)) {
      continue;
    }
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

/** Pasted lines are often "title – artist"; PSH uses "artist – title". */
export function parseLineBothWays(line: string): Array<{ artist: string; song: string }> {
  const one = parseArtistSongLine(line);
  if (!one.artist) return [one];
  return [
    one,
    { artist: one.song, song: one.artist },
  ];
}
