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
  reason?: string;
};

export function buildPlaylistResearchPrompt(topic: string): string {
  return `אתה מומחה לפלייליסטים של מוזיקה חרדית/ישראלית (ספוטיפיי, יוטיוב, הופעות, DJ לחתונות ואירועים).

נושא הפלייליסט: "${topic}"

חקר איך בונים פלייליסטים אמיתיים לנושא הזה — לא לפי מילה אחת בשם שיר, אלא לפי:
- תגיות ונושא (חופה, חתונה, שבת, אמונה…)
- ז'אנר (חסידי, מזרחי, ישיבתי…)
- אווירה (שמח, שקט, מרגש)

החזר JSON בלבד:
{
  "keywords": ["..."],
  "tagHints": ["תגיות טיפוסיות במאגר"],
  "genreHints": ["חסידי","מזרחי"],
  "mood": "quiet|energetic|mixed|celebratory|emotional",
  "moodHint": "תיאור קצר",
  "contextPhrases": ["ביטויים שמתאימים לשירים בנושא"],
  "searchQueries": ["שאילתות חיפוש בעברית למאגר שירים"],
  "exampleThemes": ["נושאי משנה לפלייליסטים דומים"],
  "avoidUpbeat": false,
  "avoidSad": false,
  "reason": "משפט אחד למפעיל"
}

דוגמה: נושא "לפני החופה" — תגיות חופה/חתונה, לא שירים שרק מתחילים ב"לפני".`;
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
    reason: research.reason,
  };
}
