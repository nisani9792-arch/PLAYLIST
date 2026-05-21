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
};

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
    return {
      mood: "celebratory",
      tact: chupa ? "chupa-wedding" : "avoid-sad",
      keywords: chupa ? [...keywords, "חופה", "חתונה", "כלה", "חתן"] : keywords,
      genreHints: ["חסידי", "מזרחי"],
      moodHint: chupa ? "לפני החופה — שמחה וריקוד" : "שמח חגיגי",
      avoidSad: true,
      reason: chupa
        ? "חופה — התאמה לפי תגיות חתונה/חופה, לא מילת 'לפני' בשם שיר"
        : "אירוע שמח — סינון שירים עצובים מדי",
    };
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
    return {
      mood: "emotional",
      tact: "faith-inspiring",
      keywords,
      genreHints: ["ישיבתי", "חסידי"],
      moodHint: "אמונה והשראה",
    };
  }

  return {
    mood: "mixed",
    tact: "balanced",
    keywords,
    genreHints: ["חסידי", "ישיבתי", "מזרחי"],
    moodHint: "מגוון",
  };
}

export function buildVibeAnalysisPrompt(topic: string): string {
  return `נתח את הנושא הבא לפני בניית פלייליסט מוזיקה חרדית.
החזר JSON בלבד:
{"mood":"quiet|energetic|mixed|celebratory|emotional","tact":"...","keywords":["..."],"genreHints":["..."],"moodHint":"...","avoidUpbeat":false,"avoidSad":false,"reason":"..."}

נושא: "${topic}"`;
}

export function parseVibeJson(text: string, fallbackTopic: string): VibeAnalysis {
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    const parsed = JSON.parse(cleaned) as Partial<VibeAnalysis>;
    if (parsed.mood && parsed.keywords) {
      return {
        mood: parsed.mood as VibeMood,
        tact: String(parsed.tact ?? "balanced"),
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String) : [],
        genreHints: Array.isArray(parsed.genreHints) ? parsed.genreHints.map(String) : [],
        moodHint: String(parsed.moodHint ?? ""),
        avoidUpbeat: Boolean(parsed.avoidUpbeat),
        avoidSad: Boolean(parsed.avoidSad),
        reason: parsed.reason ? String(parsed.reason) : undefined,
      };
    }
  } catch {
    // fallback
  }
  return parseVibeFromPrompt(fallbackTopic);
}
