export type MoodEnrichInput = {
  mood: "quiet" | "energetic" | "mixed" | "celebratory" | "emotional";
  tact: string;
  keywords: string[];
  genreHints: string[];
  moodHint: string;
  avoidUpbeat?: boolean;
  avoidSad?: boolean;
  reason?: string;
  season?: "summer" | "winter" | "spring" | "autumn" | null;
  energy?: "low" | "medium" | "high";
  excludeTags?: string[];
  excludeGenres?: string[];
  excludeHolidays?: boolean;
};

export type SeasonHint = "summer" | "winter" | "spring" | "autumn" | null;
export type EnergyLevel = "low" | "medium" | "high";

/** Holiday tokens — used for negative filtering when a season/mood is requested. */
export const HOLIDAY_TAG_TERMS = [
  "חנוכה",
  "נר חנוכה",
  "סביבון",
  "מכבי",
  "פורים",
  "מגילה",
  "מגילת",
  "המן",
  "אשתר",
  "פסח",
  "מצה",
  "מרור",
  "אפיקומן",
  "שבועות",
  "לג בעומר",
  "ראש השנה",
  "יום כיפור",
  "כיפור",
  "סוכות",
] as const;

export const HOLIDAY_TITLE_PATTERNS: RegExp[] = [
  /חנוכה|נר(?:ות)?\s*ח(?:נ)?/i,
  /פורים|מגיל(?:ת)?\s*א?ס?ת/i,
  /פסח|מצ(?:ה|ות)|מרור|אפיקומן/i,
  /שבועות|מתן\s*תורה/i,
  /ל["']?ג\s*בעומר/i,
  /ראש\s*ה?שנה|שופ(?:ר|ר)|כיפור|יום\s*כיפור/i,
  /סוכ(?:ה|ות)/i,
];

/** Genres/tags to deprioritize when high energy is requested. */
export const LOW_ENERGY_GENRE_TERMS = [
  "מקהל",
  "מקהלה",
  "choir",
  "choral",
  "Boston",
  "Alexander",
  "אלכסander",
  "נאום",
  "שיח",
  "שיעור",
  "פרשה",
  "פרשת",
  "הפטרה",
  "haftorah",
  "dvar",
  "drash",
  "spoken",
  "אקוסט",
  "acoustic",
  "ballad",
  "ניגון",
  "שקט",
  "נוגה",
] as const;

export const UPBEAT_GENRE_HINTS = [
  "מזרחי",
  "פופ",
  "דנס",
  "dance",
  "electronic",
  "אלקטרוני",
  "היפ",
  "hip",
  "קלאב",
  "club",
  "rock",
  "רוק",
] as const;

const UPBEAT_PROMPT =
  /מקפיץ|עדכני|אנרגט|קצב(?:י)?|דלוק|ריקוד|מסיבה|party|dance|fresh|happ/i;
const SUMMER_PROMPT =
  /קיץ|summer|חופש(?:ה)?|שמש|חם|יולי|אוגוסט|june|july|aug/i;
const QUIET_PROMPT =
  /גשם|חורף|שקט|רגש|אבל|זיכרון|בדידות|נוגה|מרגש|slow|ballad/i;
const HOLIDAY_REQUEST =
  /חנוכה|פורים|פסח|שבועות|סוכות|ראש\s*ה?שנה|כיפור|ל["']?ג\s*בעומר/i;

export function detectSeason(topic: string): SeasonHint {
  if (SUMMER_PROMPT.test(topic)) return "summer";
  if (/חורף|winter|גשם/.test(topic)) return "winter";
  if (/אביב|spring/.test(topic)) return "spring";
  if (/סתיו|autumn|fall/.test(topic)) return "autumn";
  return null;
}

export function detectEnergyLevel(topic: string): EnergyLevel {
  if (UPBEAT_PROMPT.test(topic) && !QUIET_PROMPT.test(topic)) return "high";
  if (QUIET_PROMPT.test(topic) && !UPBEAT_PROMPT.test(topic)) return "low";
  return "medium";
}

export function shouldExcludeHolidays(topic: string, season: SeasonHint): boolean {
  if (HOLIDAY_REQUEST.test(topic)) return false;
  if (season === "summer") return true;
  if (UPBEAT_PROMPT.test(topic) && !HOLIDAY_REQUEST.test(topic)) return true;
  return false;
}

export function enrichVibeFromTopic(topic: string, base: MoodEnrichInput): MoodEnrichInput {
  const season = detectSeason(topic);
  const energy = detectEnergyLevel(topic);
  const excludeHolidays = shouldExcludeHolidays(topic, season);

  const excludeTags: string[] = [...(base.excludeTags ?? [])];
  const excludeGenres: string[] = [...(base.excludeGenres ?? [])];
  let mood = base.mood;
  let tact = base.tact;
  let moodHint = base.moodHint;
  let avoidUpbeat = base.avoidUpbeat;
  let avoidSad = base.avoidSad;
  let genreHints = [...base.genreHints];
  let keywords = [...base.keywords];
  let reason = base.reason;

  if (energy === "high") {
    mood = "energetic";
    tact = "upbeat-high-energy";
    moodHint = moodHint || "אנרגטי, קצבי, ריקודי";
    avoidSad = true;
    avoidUpbeat = false;
    for (const g of UPBEAT_GENRE_HINTS) {
      if (!genreHints.includes(g)) genreHints.push(g);
    }
    for (const g of LOW_ENERGY_GENRE_TERMS) {
      if (!excludeGenres.includes(g)) excludeGenres.push(g);
    }
    reason =
      reason ??
      "בקשת אנרגיה גבוהה — מועדף פופ/מזרחי/דנס; סינון מקהלות, נאומים ופרשה";
  }

  if (season === "summer") {
    mood = energy === "low" ? base.mood : "energetic";
    tact = "summer-season";
    moodHint = moodHint || "קיץ עדכני — שמח וקליל";
    for (const t of ["קיץ", "שמש", "חופש", "ריקוד"]) {
      if (!keywords.includes(t)) keywords.push(t);
    }
    reason = reason ?? "קיץ — לא לכלול שירי חגי חורף/אביב (חנוכה, פורים, פסח)";
  }

  if (excludeHolidays) {
    for (const t of HOLIDAY_TAG_TERMS) {
      if (!excludeTags.includes(t)) excludeTags.push(t);
    }
  }

  return {
    ...base,
    mood,
    tact,
    moodHint,
    keywords,
    avoidUpbeat,
    avoidSad,
    genreHints: [...new Set(genreHints)].slice(0, 8),
    excludeTags: [...new Set(excludeTags)],
    excludeGenres: [...new Set(excludeGenres)],
    energy,
    season,
    excludeHolidays,
    reason,
  };
}

export function buildRankConstraintBlock(vibe: MoodEnrichInput, topic: string): string {
  const lines: string[] = ["## כללי vibe / סינון (חובה)"];

  if (vibe.season === "summer") {
    lines.push(
      "- עונה: **קיץ** — אסור שירי חנוכה, פורים, פסח, סוכות, ראש השנה אלא אם נדרש במפורש.",
    );
  }
  if (vibe.energy === "high" || vibe.mood === "energetic" || vibe.mood === "celebratory") {
    lines.push(
      "- אנרגיה: **גבוהה/מקפיץ** — העדף פופ, מזרחי, דנס, אלקטרוני, רוק קליל.",
      "- אסור: מקהלות (Boston/Alexander וכו'), ניגונים איטיים, אקוסטי שקט, נאום/פרשה/שיח.",
      "- אל תתייג מזרחי מקפיץ כ'רוק' אלא אם זה באמת רוק.",
    );
  }
  if (vibe.avoidUpbeat) {
    lines.push("- סינון: הימנע משירים רועשים/ריקודיים מדי.");
  }
  if (vibe.avoidSad) {
    lines.push("- סינון: הימנע משירים עצובים/אבל.");
  }
  if (vibe.excludeTags?.length) {
    lines.push(`- תגיות/נושאים אסורים: ${vibe.excludeTags.slice(0, 12).join(", ")}`);
  }
  if (vibe.excludeGenres?.length) {
    lines.push(`- סוגים להימנע: ${vibe.excludeGenres.slice(0, 10).join(", ")}`);
  }
  if (vibe.genreHints?.length) {
    lines.push(`- ז'אנרים מועדפים: ${vibe.genreHints.join(", ")}`);
  }
  lines.push(`- נושא המשתמש: "${topic}"`);
  return lines.join("\n");
}

/** Minimum topic-fit score to enter the candidate pool for playlist build. */
export const CURATOR_MIN_CANDIDATE_SCORE = 0.36;
