/** Hebrew-aware normalization for matching and dedupe keys. */
export function normalizeHebrew(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u0591-\u05c7]/g, "")
    .replace(/[׳"`'']/g, "")
    .replace(/[^\u0590-\u05ffa-z0-9\s]/g, " ")
    .replace(/[ך]/g, "כ")
    .replace(/[ם]/g, "מ")
    .replace(/[ן]/g, "נ")
    .replace(/[ף]/g, "פ")
    .replace(/[ץ]/g, "צ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeParashaToken(value: string): string {
  return normalizeHebrew(value)
    .replace(/^(פרשת|פרשה|הפטרת|הפטרה|פטרת|פטרה)\s+/i, "")
    .trim();
}
