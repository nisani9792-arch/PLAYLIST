import type { PshSongRow } from "./psh-types";
import { normalizeHebrew } from "./normalize";

const LITURGICAL_TITLE_RE =
  /^(בלעדיך לא אבוא|יברכך|ישימך|יעלה|עננו|עשה עשה|לאורו נלך|ביום ההוא|ואהבת לרעך כמוך|אחד יחיד ומיוחד|ושמו)/i;

function looksLikeSongTitle(s: string): boolean {
  const n = normalizeHebrew(s);
  if (!n || n.length < 2) return false;
  if (LITURGICAL_TITLE_RE.test(s.trim())) return true;
  if (/^(bench|single|סינגל|דודוד)$/i.test(s.trim())) return false;
  if (/^\d+$/.test(n)) return false;
  // Multi-word Hebrew without typical performer-only patterns
  if (/\b(לא אבוא|לרעך|ביום|יחיד)\b/i.test(s)) return true;
  return n.split(" ").length <= 6 && !/^(פרחי|בני|הישיבות)$/i.test(s);
}

function peelTitlePrefix(
  titleField: string,
  composer: string,
): { songTitle: string; artist: string } | null {
  const t = titleField.trim();
  for (const prefix of [
    "יברכך",
    "ישימך",
    "ושמו",
    "ברכת כהנים",
  ] as const) {
    if (!t.startsWith(prefix)) continue;
    const rest = t.slice(prefix.length).trim();
    if (rest) return { songTitle: prefix, artist: rest };
    if (composer) return { songTitle: prefix, artist: composer };
  }
  return null;
}

/**
 * Repair common PSH.pdf column swaps (artist/title/album inverted).
 * Uses composer field as ground truth when available.
 */
export function repairPshRow(row: PshSongRow): PshSongRow {
  let { title, artist, album, composer } = row;
  const comp = composer?.trim() ?? "";

  if (/^bench$/i.test(title.trim()) && album?.trim()) {
    return { ...row, title: album.trim(), album: title.trim() };
  }

  if (comp && artist && looksLikeSongTitle(artist) && !looksLikeSongTitle(comp)) {
    const peeled = peelTitlePrefix(title, comp);
    return {
      ...row,
      title: artist,
      artist: peeled?.artist || comp,
    };
  }

  if (looksLikeSongTitle(artist) && /^יברכך/i.test(title)) {
    const performer = title.replace(/^יברכך\s*/i, "").trim() || comp;
    return { ...row, title: artist, artist: performer || comp };
  }

  if (/^דודוד$/i.test(artist) && comp) {
    const peeled = peelTitlePrefix(title, comp);
    return {
      ...row,
      title: peeled?.songTitle ?? "יברכך",
      artist: peeled?.artist ?? comp,
    };
  }

  if (looksLikeSongTitle(artist) && title.includes(" ")) {
    const peeled = peelTitlePrefix(title, comp);
    if (peeled?.artist) {
      return { ...row, title: artist, artist: peeled.artist };
    }
  }

  if (
    looksLikeSongTitle(artist) &&
    !looksLikeSongTitle(title) &&
    title.length > 2 &&
    !title.startsWith(artist)
  ) {
    return { ...row, title: artist, artist: title };
  }

  return { ...row, title: title.trim(), artist: artist.trim(), album: album.trim() };
}

export function repairPshCatalog(rows: PshSongRow[]): PshSongRow[] {
  return rows.map(repairPshRow);
}
