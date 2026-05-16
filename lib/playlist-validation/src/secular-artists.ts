import { normalizeHebrew } from "./normalize";

/** Zero-tolerance secular / non-religious performer blocklist (JUSIC baseline). */
export const SECULAR_ARTIST_BLACKLIST: readonly string[] = [
  "שאנן סטריט",
  "שאנן סטרייט",
  "shanan street",
  "omer adam",
  "עומר אדם",
  "netta barzilai",
  "נטע ברזילי",
  "noa kirel",
  "נועה קירל",
  "static",
  "סטטיק",
  "ben el",
  "בן אל",
  "peer tasi",
  "פאר טסי",
  "eden ben zaken",
  "עדן בן זקן",
];

const BLACKLIST_NORMALIZED = SECULAR_ARTIST_BLACKLIST.map((n) =>
  normalizeHebrew(n),
);

const FEATURE_SPLIT_RE =
  /\s+(?:ו|feat\.?|featuring|עם|ft\.?|&)\s+|\s*,\s*/gi;

/** Split performer field into individual credited names. */
export function splitPerformerNames(text: string): string[] {
  return text
    .split(FEATURE_SPLIT_RE)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
}

export function findSecularArtistViolation(text: string): string | null {
  const normalized = normalizeHebrew(text);
  if (!normalized) return null;

  for (const blocked of BLACKLIST_NORMALIZED) {
    if (normalized.includes(blocked)) {
      return blocked;
    }
  }

  for (const name of splitPerformerNames(text)) {
    const n = normalizeHebrew(name);
    for (const blocked of BLACKLIST_NORMALIZED) {
      if (n === blocked || n.includes(blocked)) {
        return blocked;
      }
    }
  }

  return null;
}

/** Songs that must not pass even when primary artist looks kosher (featured secular). */
export const FORBIDDEN_SONG_FEATURES: Readonly<Record<string, readonly string[]>> = {
  "בלעדיך לא אבוא": ["שאנן סטריט", "שאנן סטרייט"],
};

export function findForbiddenFeatureViolation(
  songTitle: string,
  ...extraTexts: Array<string | undefined | null>
): string | null {
  const key = normalizeHebrew(songTitle);
  for (const [title, blockedArtists] of Object.entries(FORBIDDEN_SONG_FEATURES)) {
    if (!key.includes(normalizeHebrew(title))) continue;
    const blob = [songTitle, ...extraTexts].filter(Boolean).join(" ");
    for (const blocked of blockedArtists) {
      if (findSecularArtistViolation(blob)) return blocked;
    }
  }
  return null;
}

export function assertHashkafaClean(...texts: Array<string | undefined | null>): string | null {
  for (const text of texts) {
    if (!text?.trim()) continue;
    const hit = findSecularArtistViolation(text);
    if (hit) return hit;
  }
  return null;
}
