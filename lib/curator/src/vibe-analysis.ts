import {
  enrichVibeFromTopic,
  buildRankConstraintBlock,
  HOLIDAY_TITLE_PATTERNS,
} from "./mood-filters";

export type VibeMood = "quiet" | "energetic" | "mixed" | "celebratory" | "emotional";

export type VibeAnalysis = {
  mood: VibeMood;
  tact: string;
  keywords: string[];
  genreHints: string[];
  moodHint: string;
  avoidUpbeat?: boolean;
  avoidSad?: boolean;
  reason?: string;
  /** Detected season for negative holiday filtering. */
  season?: "summer" | "winter" | "spring" | "autumn" | null;
  energy?: "low" | "medium" | "high";
  /** Tag/title terms that must not appear unless explicitly requested. */
  excludeTags?: string[];
  /** Genre labels to deprioritize or block. */
  excludeGenres?: string[];
  /** When true, holiday tracks are excluded from candidate pool. */
  excludeHolidays?: boolean;
};

export { buildRankConstraintBlock };

export function parseVibeFromPrompt(prompt: string): VibeAnalysis {
  const lower = prompt.toLowerCase();
  const keywords = prompt
    .split(/[\s,،]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
    .slice(0, 8);

  const winterQuiet =
    /גשם|חורף|שקט|רגש|אבל|זיכרון|בדידות/.test(prompt) &&
    !/ריקוד|מסיבה|שמח|חגיג/.test(prompt);
  const chupa =
    /לפני\s*ה?חופה|כניסה\s*לחופה|ריקודי\s*חופה|חופה/i.test(prompt) &&
    !/לפני\s*ה?שם|לפני\s*נעבור/i.test(prompt);
  const wedding =
    chupa ||
    /חתונה|שמח|ריקוד|חגיג|simcha|סימcha/i.test(prompt) ||
    /לפני חתונה|יום החתונה/.test(prompt);
  const parasha = /פרשה|פרשת|psh/i.test(prompt);
  const faith = /אמונה|תפילה|השגחה|ביטחון/.test(prompt);

  if (winterQuiet) {
    return {
      mood: "quiet",
      tact: "avoid-upbeat",
      keywords,
      genreHints: ["ישיבתי", "חסידי"],
      moodHint: "שקט רגש",
      avoidUpbeat: true,
      reason: "נושא שקט/חורף — סינון שירים רועשים מדי",
    };
  }

  if (wedding) {
    return enrichVibeFromTopic(prompt, {
      mood: "celebratory",
      tact: chupa ? "chupa-wedding" : "avoid-sad",
      keywords: chupa ? [...keywords, "חופה", "חתונה", "כלה", "חתן"] : keywords,
      genreHints: ["חסידי", "מזרחי"],
      moodHint: chupa ? "לפני החופה — שמחה וריקוד" : "שמח חגיגי",
      avoidSad: true,
      energy: "high",
      reason: chupa
        ? "חופה — התאמה לפי תגיות חתונה/חופה, לא מילת 'לפני' בשם שיר"
        : "אירוע שמח — סינון שירים עצובים מדי",
    });
  }

  if (parasha) {
    return {
      mood: "mixed",
      tact: "parasha-context",
      keywords,
      genreHints: ["חסידי", "ישיבתי", "חזנות"],
      moodHint: "פרשת שבוע",
      reason: "פרשה — עדיפות PSH",
    };
  }

  if (faith) {
    return enrichVibeFromTopic(prompt, {
      mood: "emotional",
      tact: "faith-inspiring",
      keywords,
      genreHints: ["ישיבתי", "חסידי"],
      moodHint: "אמונה והשראה",
    });
  }

  return enrichVibeFromTopic(prompt, {
    mood: "mixed",
    tact: "balanced",
    keywords,
    genreHints: ["חסידי", "ישיבתי", "מזרחי"],
    moodHint: "מגוון",
  });
}

export function buildVibeAnalysisPrompt(topic: string): string {
  return `נתח את הנושא הבא לפני בניית פלייליסט מוזיקה חרדית/ישראלית.

## כללים קשיחים
1. **עונה**: אם המשתמש מבקש קיץ — excludeHolidays=true ו-excludeTags חייבים לכלול חנוכה, פורים, פסח (אלא אם ביקש חג במפורש).
2. **אנרגיה**: "מקפיץ"/"עדכני"/"ריקוד" = mood=energetic, energy=high, genreHints: מזרחי/פופ/דנס/אלקטרוני.
   excludeGenres: מקהלה, choir, נאום, פרשה, אקוסטי איטי.
3. **אל תנחש שמות שירים** — רק ניתוח vibe לסינון מאגר.

החזר JSON בלבד:
{
  "mood":"quiet|energetic|mixed|celebratory|emotional",
  "tact":"...",
  "keywords":["..."],
  "genreHints":["..."],
  "moodHint":"...",
  "avoidUpbeat":false,
  "avoidSad":false,
  "energy":"low|medium|high",
  "season":"summer|winter|spring|autumn|null",
  "excludeHolidays":false,
  "excludeTags":["..."],
  "excludeGenres":["..."],
  "reason":"..."
}

נושא: "${topic}"`;
}

export function parseVibeJson(text: string, fallbackTopic: string): VibeAnalysis {
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    const parsed = JSON.parse(cleaned) as Partial<VibeAnalysis>;
    if (parsed.mood && parsed.keywords) {
      const partial: VibeAnalysis = {
        mood: parsed.mood as VibeMood,
        tact: String(parsed.tact ?? "balanced"),
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [],
        genreHints: Array.isArray(parsed.genreHints) ? parsed.genreHints.map(String) : [],
        moodHint: String(parsed.moodHint ?? ""),
        avoidUpbeat: Boolean(parsed.avoidUpbeat),
        avoidSad: Boolean(parsed.avoidSad),
        reason: parsed.reason ? String(parsed.reason) : undefined,
        energy: parsed.energy as VibeAnalysis["energy"],
        season: (() => {
          const raw = parsed.season as unknown;
          if (raw === null || raw === "null" || raw === undefined) return null;
          return raw as VibeAnalysis["season"];
        })(),
        excludeTags: Array.isArray(parsed.excludeTags)
          ? parsed.excludeTags.map(String)
          : undefined,
        excludeGenres: Array.isArray(parsed.excludeGenres)
          ? parsed.excludeGenres.map(String)
          : undefined,
        excludeHolidays: Boolean(parsed.excludeHolidays),
      };
      return enrichVibeFromTopic(fallbackTopic, partial);
    }
  } catch {
    // fallback
  }
  return parseVibeFromPrompt(fallbackTopic);
}
