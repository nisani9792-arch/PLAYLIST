import {
  countHebrewLetters,
  preferHebrewOnlyText,
  trimLomdaatField,
  type LomdaatPlaylistRow,
} from "./lomdaat-export";
import type { MsHitLike } from "./ms-hit";
import {
  parseArtistSongLine,
  parseLineBothWays,
  sanitizePlaylistLine,
} from "./sanitize";

const PLACEHOLDER_ARTISTS = new Set([
  "-",
  "–",
  "—",
  "סינגל",
  "שיר",
  "single",
  "unknown",
  "לא ידוע",
]);

const GENRE_LABELS = new Set([
  "פופ",
  "pop",
  "rock",
  "אינדי",
  "indie",
  "קאנטרי",
  "country",
  "האזנה קלה",
  "מוזיקה",
  "כללי",
]);

/** True when artist field is a UI placeholder, genre label, or empty. */
export function isPlaceholderExportArtist(artist: string): boolean {
  const a = trimLomdaatField(artist).toLocaleLowerCase();
  if (!a) return true;
  if (PLACEHOLDER_ARTISTS.has(a)) return true;
  if (GENRE_LABELS.has(a)) return true;
  return false;
}

function splitTrailingArtistFromTitle(title: string): {
  song_name: string;
  artist: string;
} | null {
  const words = trimLomdaatField(title).split(/\s+/).filter(Boolean);
  if (words.length < 3) return null;

  const tryCounts =
    words.length >= 5
      ? [3, 2]
      : words.length === 4
        ? [2]
        : words.length === 3
          ? [2, 1]
          : [2];

  for (const n of tryCounts) {
    if (words.length <= n) continue;
    const artist = words.slice(-n).join(" ");
    const song = words.slice(0, -n).join(" ");
    if (countHebrewLetters(artist) < 3 || countHebrewLetters(song) < 2) continue;
    if (song.split(/\s+/).length < 2 && n > 1) continue;
    if (isPlaceholderExportArtist(artist)) continue;
    return {
      song_name: preferHebrewOnlyText(song),
      artist: preferHebrewOnlyText(artist),
    };
  }
  return null;
}

/** Repair swapped or PDF-pasted song/artist fields before Lomdaat export. */
export function repairMsHitForExport(hit: MsHitLike): LomdaatPlaylistRow {
  let song = preferHebrewOnlyText(hit.song_name);
  let artist = preferHebrewOnlyText(hit.artist);

  const combinedLine = sanitizePlaylistLine(
    [hit.song_name, hit.artist].filter(Boolean).join(" - "),
  );

  if (isPlaceholderExportArtist(artist) || !artist) {
    const fromTitle = splitTrailingArtistFromTitle(song);
    if (fromTitle) {
      song = fromTitle.song_name;
      artist = fromTitle.artist;
    } else {
      for (const parsed of parseLineBothWays(combinedLine)) {
        if (
          parsed.song &&
          parsed.artist &&
          !isPlaceholderExportArtist(parsed.artist) &&
          !isPlaceholderExportArtist(parsed.song)
        ) {
          song = preferHebrewOnlyText(parsed.song);
          artist = preferHebrewOnlyText(parsed.artist);
          break;
        }
      }
    }
  }

  if (isPlaceholderExportArtist(artist)) {
    const parsed = parseArtistSongLine(song);
    if (parsed.artist && parsed.song && !isPlaceholderExportArtist(parsed.artist)) {
      song = preferHebrewOnlyText(parsed.song);
      artist = preferHebrewOnlyText(parsed.artist);
    }
  }

  return {
    song_name: song,
    artist: isPlaceholderExportArtist(artist) ? "" : artist,
  };
}

/** One Lomdaat CSV row: canonical resolve when possible, else repaired playlist fields. */
export function lomdaatRowFromHits(
  playlistHit: MsHitLike,
  resolvedHit: MsHitLike | null | undefined,
): LomdaatPlaylistRow {
  if (resolvedHit) {
    const fromCatalog = repairMsHitForExport(resolvedHit);
    if (fromCatalog.song_name && fromCatalog.artist) return fromCatalog;
  }
  return repairMsHitForExport(playlistHit);
}
