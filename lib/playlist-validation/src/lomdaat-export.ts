/** Hebrew vs Latin heuristics for Lomdaat / Odoo playlist CSV fields. */

export function countHebrewLetters(text: string): number {
  return (text.match(/[\u0590-\u05FF]/g) ?? []).length;
}

export function countLatinLetters(text: string): number {
  return (text.match(/[a-zA-Z]/g) ?? []).length;
}

/** True when the string is mostly Latin letters (e.g. English artist name). */
export function isPrimarilyLatin(text: string): boolean {
  const he = countHebrewLetters(text);
  const en = countLatinLetters(text);
  if (en === 0) return false;
  if (he === 0) return true;
  return en > he;
}

/** Strip trailing metadata noise sometimes present in catalog strings. */
export function trimLomdaatField(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip track-number prefixes (e.g. "01-שיר") — Lomdaat template has no track index. */
export function trimLomdaatSongName(value: string): string {
  return trimLomdaatField(value).replace(/^\d{1,3}[-.)]\s*/, "");
}

/**
 * When a catalog field mixes Hebrew and Latin (e.g. "מידד טסה / Meded Tasa"),
 * return the Hebrew-only portion for Lomdaat export.
 */
export function preferHebrewOnlyText(text: string): string {
  const trimmed = trimLomdaatField(text);
  if (!trimmed) return "";

  const heCount = countHebrewLetters(trimmed);
  const enCount = countLatinLetters(trimmed);
  if (heCount === 0) return trimmed;
  if (enCount === 0) return trimmed;

  const segments = trimmed
    .split(/\s*[/|–—\-]\s*|\s*\(\s*|\s*\)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length > 1) {
    const hebrewSegments = segments.filter(
      (s) => countHebrewLetters(s) > 0 && !isPrimarilyLatin(s),
    );
    if (hebrewSegments.length) {
      return trimLomdaatField(hebrewSegments.join(" "));
    }
  }

  return trimLomdaatField(trimmed.replace(/[a-zA-Z]+/g, " "));
}

/** Lomdaat / Jusic Audio import — must match player template exactly. */
export const LOMDAAT_PLAYLIST_HEADERS =
  "imported_playlist_name,imported_song_name,imported_artist_name";

export const LOMDAAT_PLAYLIST_FILENAME = "lomdaat_music.playlist.csv";

export type LomdaatPlaylistRow = {
  song_name: string;
  artist: string;
};

/** RFC 4180-style field: quote when value contains comma, quote, or line break. */
export function escapeCsvField(value: string): string {
  const v = trimLomdaatField(value);
  if (/[",\r\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function formatLomdaatCsvRow(
  playlistName: string,
  songName: string,
  artistName: string,
): string {
  return [
    escapeCsvField(playlistName),
    escapeCsvField(trimLomdaatSongName(songName)),
    escapeCsvField(artistName),
  ].join(",");
}

/**
 * Build Lomdaat / Jusic Audio playlist CSV (UTF-8 text, CRLF after every line).
 */
export function buildLomdaatPlaylistCsv(
  playlistName: string,
  rows: LomdaatPlaylistRow[],
): string {
  const safePlaylist = trimLomdaatField(playlistName);
  const dataLines = rows
    .filter(
      (row) =>
        trimLomdaatSongName(row.song_name) &&
        trimLomdaatField(row.artist),
    )
    .map((row) =>
      formatLomdaatCsvRow(safePlaylist, row.song_name, row.artist),
    );

  if (!dataLines.length) {
    return LOMDAAT_PLAYLIST_HEADERS;
  }

  // Match Lomdaat/Odoo reference CSV: CRLF between lines, NO trailing CRLF or blank row.
  return [LOMDAAT_PLAYLIST_HEADERS, ...dataLines].join("\r\n");
}
