/** Canonical parasha names as they appear in PSH.pdf (column פרשה). */
export const PSH_PARASHA_NAMES = [
  "בראשית",
  "נח",
  "לך לך",
  "וירא",
  "חיי שרה",
  "תולדות",
  "ויצא",
  "וישלח",
  "וישב",
  "מקץ",
  "ויגש",
  "ויחי",
  "שמות",
  "וארא",
  "בא",
  "בשלח",
  "יתרו",
  "משפטים",
  "תרומה",
  "תצוה",
  "כי תשא",
  "ויקהל",
  "פקודי",
  "ויקרא",
  "צו",
  "שמיני",
  "תזריע",
  "מצורע",
  "אחרי מות",
  "קדושים",
  "אמור",
  "בהר",
  "בחוקותי",
  "במדבר",
  "נשא",
  "בהעלותך",
  "שלח",
  "קרח",
  "חקת",
  "בלק",
  "פנחס",
  "מטות",
  "מסעי",
  "דברים",
  "ואתחנן",
  "עקב",
  "ראה",
  "שופטים",
  "כי תצא",
  "כי תבוא",
  "נצבים",
  "וילך",
  "האזינו",
  "וזאת הברכה",
] as const;

const ALIASES: Record<string, string> = {
  "פרשת שמות": "שמות",
  "פרשה שמות": "שמות",
  "parashat shemot": "שמות",
  "shemot": "שמות",
  "פרשת בראשית": "בראשית",
  "פרשת נח": "נח",
  "פרשת לך לך": "לך לך",
  "פרשת וירא": "וירא",
  "פרשת חיי שרה": "חיי שרה",
  "פרשת תולדות": "תולדות",
  "פרשת ויצא": "ויצא",
  "פרשת וישלח": "וישלח",
  "פרשת וישב": "וישב",
  "פרשת מקץ": "מקץ",
  "פרשת ויגש": "ויגש",
  "פרשת ויחי": "ויחי",
};

export function normalizeParashaToken(value: string): string {
  return value
    .trim()
    .replace(/^פרשת\s+/i, "")
    .replace(/^פרשה\s+/i, "")
    .replace(/^פטרת\s+/i, "")
    .replace(/^הפטרת\s+/i, "")
    .replace(/^פטרה\s+/i, "")
    .replace(/^הפטרה\s+/i, "")
    .replace(/\s+/g, " ");
}

export function resolveParashaNameFromPrompt(prompt: string): string | null {
  const raw = prompt.trim();
  if (!raw) return null;

  const lower = raw.toLocaleLowerCase();
  for (const [alias, canonical] of Object.entries(ALIASES)) {
    if (lower.includes(alias.toLocaleLowerCase())) return canonical;
  }

  const normalizedPrompt = normalizeParashaToken(raw);
  for (const name of PSH_PARASHA_NAMES) {
    if (
      normalizedPrompt.includes(name) ||
      raw.includes(name) ||
      raw.includes(`פרשת ${name}`) ||
      raw.includes(`פרשה ${name}`)
    ) {
      return name;
    }
  }

  if (/פרש|פטרה|הפטרה|parash/i.test(raw)) {
    const tokens = normalizedPrompt.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      const hit = PSH_PARASHA_NAMES.find(
        (n) => n === token || n.startsWith(token) || token.startsWith(n),
      );
      if (hit) return hit;
    }
  }

  return null;
}

export function promptLooksParashaRelated(prompt: string): boolean {
  return resolveParashaNameFromPrompt(prompt) !== null;
}
