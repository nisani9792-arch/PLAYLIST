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

/** Lomdaat / Jusic Audio import — must match player template exactly. */
export const LOMDAAT_PLAYLIST_HEADERS =
  "imported_playlist_name,imported_song_name,imported_artist_name";

export const LOMDAAT_PLAYLIST_FILENAME = "lomdaat_music.playlist.csv";

export type LomdaatPlaylistRow = {
  song_name: string;
  artist: string;
};

export function buildLomdaatPlaylistCsv(
  playlistName: string,
  rows: LomdaatPlaylistRow[],
): string {
  const safePlaylist = trimLomdaatField(playlistName);
  const lines = [
    LOMDAAT_PLAYLIST_HEADERS,
    ...rows.map((row) =>
      [
        safePlaylist,
        trimLomdaatField(row.song_name),
        trimLomdaatField(row.artist),
      ].join(","),
    ),
  ];
  return lines.join("\r\n");
}
