import type { VibeAnalysis, VibeMood } from "./vibe-analysis";

/** Structured “playlist research” from Gemini (popular playlists / themes). */
export type PlaylistResearch = {
  keywords: string[];
  tagHints: string[];
  genreHints: string[];
  mood: VibeMood;
  moodHint: string;
  contextPhrases: string[];
  searchQueries: string[];
  exampleThemes: string[];
  avoidUpbeat?: boolean;
  avoidSad?: boolean;
  excludeTags?: string[];
  excludeGenres?: string[];
  excludeHolidays?: boolean;
  energy?: "low" | "medium" | "high";
  season?: VibeAnalysis["season"];
  reason?: string;
};

export function buildPlaylistResearchPrompt(topic: string): string {
  return `אתה מומחה לפלייליסטים של מוזיקה חרדית/ישראלית (ספוטיפיי, יוטיוב, DJ לחתונות ואירועים).

נושא הפלייליסט: "${topic}"

## כללים קשיחים (Negative Prompting)
1. **עונה**: אם הנושא הוא קיץ — excludeHolidays=true. אסור להציע שירי חנוכה, פורים, פסח, סוכות, ראש השנה.
2. **אנרגיה**: אם הנושא "מקפיץ"/"עדכני"/"ריקוד" — mood=energetic, energy=high.
   excludeGenres: מקהלה, choir, Boston, Alexander, נאום, פרשה, spoken, acoustic איטי.
   genreHints: מזרחי, פופ, דנס, אלקטרוני — לא "רוק" למזרחי מקפיץ.
3. **אל תמציא שמות שירים** — רק תגיות, ז'אנרים ושאילתות חיפוש למאגר.

חקר איך בונים פלייליסטים אמיתיים לנושא — לפי תגיות, ז'אנר ואווירה, לא מילה אחת בשם שיר.

החזר JSON בלבד:
{
  "keywords": ["..."],
  "tagHints": ["תגיות טיפוסיות במאגר"],
  "genreHints": ["מזרחי","פופ","דנס"],
  "mood": "quiet|energetic|mixed|celebratory|emotional",
  "moodHint": "תיאור קצר",
  "contextPhrases": ["ביטויים שמתאימים לשירים בנושא"],
  "searchQueries": ["שאילתות חיפוש בעברית למאגר שירים"],
  "exampleThemes": ["נושאי משנה לפלייליסטים דומים"],
  "avoidUpbeat": false,
  "avoidSad": false,
  "excludeHolidays": false,
  "excludeTags": ["חנוכה","פורים","פסח"],
  "excludeGenres": ["מקהלה","נאום"],
  "energy": "low|medium|high",
  "season": "summer|winter|null",
  "reason": "משפט אחד למפעיל"
}

דוגמה: "פלייליסט קיץ מקפיץ" → mood=energetic, season=summer, excludeHolidays=true, searchQueries: "מזרחי קיץ ריקוד", לא שירי חנוכה.`;
}

const MOODS: VibeMood[] = [
  "quiet",
  "energetic",
  "mixed",
  "celebratory",
  "emotional",
];

export function parsePlaylistResearchJson(
  text: string,
  fallbackTopic: string,
): PlaylistResearch | null {
  try {
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "");
    const parsed = JSON.parse(cleaned) as Partial<PlaylistResearch>;
    const mood = MOODS.includes(parsed.mood as VibeMood)
      ? (parsed.mood as VibeMood)
      : "mixed";
    const keywords = Array.isArray(parsed.keywords)
      ? parsed.keywords.map(String).filter((k) => k.trim().length >= 2)
      : [];
    const tagHints = Array.isArray(parsed.tagHints)
      ? parsed.tagHints.map(String).filter(Boolean)
      : [];
    const genreHints = Array.isArray(parsed.genreHints)
      ? parsed.genreHints.map(String).filter(Boolean)
      : [];
    const contextPhrases = Array.isArray(parsed.contextPhrases)
      ? parsed.contextPhrases.map(String).filter(Boolean)
      : [];
    const searchQueries = Array.isArray(parsed.searchQueries)
      ? parsed.searchQueries.map(String).filter(Boolean)
      : [];
    const exampleThemes = Array.isArray(parsed.exampleThemes)
      ? parsed.exampleThemes.map(String).filter(Boolean)
      : [];
    const excludeTags = Array.isArray(parsed.excludeTags)
      ? parsed.excludeTags.map(String).filter(Boolean)
      : [];
    const excludeGenres = Array.isArray(parsed.excludeGenres)
      ? parsed.excludeGenres.map(String).filter(Boolean)
      : [];

    if (
      !keywords.length &&
      !tagHints.length &&
      !searchQueries.length &&
      !contextPhrases.length
    ) {
      return null;
    }

    return {
      keywords: keywords.length ? keywords : [fallbackTopic],
      tagHints,
      genreHints,
      mood,
      moodHint: String(parsed.moodHint ?? "").trim() || fallbackTopic,
      contextPhrases: contextPhrases.length
        ? contextPhrases
        : [fallbackTopic],
      searchQueries: searchQueries.length
        ? searchQueries
        : [fallbackTopic, ...tagHints].filter(Boolean),
      exampleThemes,
      avoidUpbeat: Boolean(parsed.avoidUpbeat),
      avoidSad: Boolean(parsed.avoidSad),
      excludeTags,
      excludeGenres,
      excludeHolidays: Boolean(parsed.excludeHolidays),
      energy: parsed.energy,
      season:
        parsed.season === null || (parsed.season as unknown) === "null"
          ? null
          : parsed.season,
      reason: parsed.reason ? String(parsed.reason) : undefined,
    };
  } catch {
    return null;
  }
}

export function researchToVibePatch(research: PlaylistResearch): {
  keywords?: string[];
  tagHints?: string[];
  genreHints?: string[];
  mood?: VibeMood;
  moodHint?: string;
  avoidUpbeat?: boolean;
  avoidSad?: boolean;
  excludeTags?: string[];
  excludeGenres?: string[];
  excludeHolidays?: boolean;
  energy?: "low" | "medium" | "high";
  season?: VibeAnalysis["season"];
  reason?: string;
} {
  return {
    keywords: research.keywords,
    tagHints: research.tagHints,
    genreHints: research.genreHints,
    mood: research.mood,
    moodHint: research.moodHint,
    avoidUpbeat: research.avoidUpbeat,
    avoidSad: research.avoidSad,
    excludeTags: research.excludeTags,
    excludeGenres: research.excludeGenres,
    excludeHolidays: research.excludeHolidays,
    energy: research.energy,
    season: research.season,
    reason: research.reason,
  };
}
