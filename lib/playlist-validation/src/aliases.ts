import { normalizeHebrew } from "./normalize";

/** Common mis-parsed user/Meili titles → PSH liturgical title. */
const TITLE_ALIAS_ENTRIES: ReadonlyArray<{ pattern: RegExp; canonical: string }> = [
  { pattern: /שים\s*שלום/i, canonical: "ישימך" },
  { pattern: /הורה\s*עם\s*דודוד/i, canonical: "יברכך" },
  { pattern: /\bbe\s*free\b/i, canonical: "יעלה" },
];

/** Liturgical titles whose canonical PSH parasha differs from common wrong injections. */
export const CANONICAL_PARASHA_BY_TITLE: Readonly<Record<string, string>> = {
  "בלעדיך לא אבוא": "וישב",
  ישימך: "ויחי",
};

export function applyInputTitleAliases(line: string): string {
  let out = line;
  for (const { pattern, canonical } of TITLE_ALIAS_ENTRIES) {
    if (pattern.test(out)) {
      out = out.replace(pattern, canonical);
    }
  }
  return out;
}

export function canonicalParashaForTitle(title: string): string | null {
  const key = normalizeHebrew(title);
  for (const [lit, parasha] of Object.entries(CANONICAL_PARASHA_BY_TITLE)) {
    if (key.includes(normalizeHebrew(lit))) return parasha;
  }
  return null;
}
