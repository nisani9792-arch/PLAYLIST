import type { VibeAnalysis } from "./vibe-analysis";

export type TopicFacets = {
  /** Normalized topic label */
  primaryPhrase: string;
  /** Phrases that describe the event/mood (for catalog scoring) */
  contextPhrases: string[];
  /** Expected Meilisearch / tag vocabulary */
  tagHints: string[];
  genreHints: string[];
  /** Extra search strings (tags, themes) */
  searchQueries: string[];
  /** Title patterns that look relevant but are wrong for this topic */
  rejectTitlePatterns: RegExp[];
};

type ScenarioRule = {
  test: RegExp;
  contextPhrases: string[];
  tagHints: string[];
  genreHints?: string[];
  searchQueries?: string[];
  rejectTitlePatterns?: RegExp[];
};

const SCENARIO_RULES: ScenarioRule[] = [
  {
    test: /לפני\s*ה?חופה|חופה|כניסה\s*לחופה|ריקודי\s*חתונה/i,
    contextPhrases: ["לפני החופה", "כניסת החתן", "ריקודי חתונה", "שמחת חתן וכלה"],
    tagHints: ["חופה", "חתונה", "חתן", "כלה", "שמחה", "ריקוד", "סימחה"],
    genreHints: ["חסידי", "מזרחי"],
    searchQueries: ["שירי חופה", "ריקודי חתונה", "כניסת החתן"],
    rejectTitlePatterns: [/^לפני\s+(השם|נעבור|שבת)/i, /^לפני$/i],
  },
  {
    test: /חתונה|לפני\s*חתונה|יום\s*החתונה/i,
    contextPhrases: ["שמחת חתן", "חתונה", "ריקודים"],
    tagHints: ["חתונה", "שמחה", "ריקוד", "סימחה"],
    genreHints: ["חסידי", "מזרחי"],
    searchQueries: ["שירי חתונה", "שמחת חתן"],
  },
  {
    test: /שבת|הכנה\s*לשבת|קבלת\s*שבת/i,
    contextPhrases: ["קבלת שבת", "שירי שבת", "הכנה לשבת"],
    tagHints: ["שבת", "קבלת שבת", "קודש", "שלווה"],
    genreHints: ["חסידי", "ישיבתי"],
    searchQueries: ["שירי שבת", "קבלת שבת"],
  },
  {
    test: /אמונה|השראה|ביטחון|תפילה/i,
    contextPhrases: ["אמונה והשראה", "שירי אמונה"],
    tagHints: ["אמונה", "השראה", "תפילה", "ביטחון"],
    genreHints: ["ישיבתי", "חסידי"],
    searchQueries: ["שירי אמונה", "השראה"],
  },
  {
    test: /גשם|חורף|שקט|זיכרון/i,
    contextPhrases: ["שקט רגש", "ימי חורף"],
    tagHints: ["שקט", "רגש", "נוגה"],
    genreHints: ["ישיבתי"],
    searchQueries: ["שירי רגש שקט"],
  },
];

export function expandTopicFacets(
  topic: string,
  vibe?: VibeAnalysis,
): TopicFacets {
  const trimmed = topic.trim();
  let contextPhrases: string[] = [trimmed];
  let tagHints: string[] = [];
  let genreHints: string[] = vibe?.genreHints?.slice() ?? [];
  let searchQueries: string[] = [trimmed];
  let rejectTitlePatterns: RegExp[] = [];

  for (const rule of SCENARIO_RULES) {
    if (!rule.test.test(trimmed)) continue;
    contextPhrases = [...contextPhrases, ...rule.contextPhrases];
    tagHints = [...tagHints, ...rule.tagHints];
    if (rule.genreHints?.length) {
      genreHints = [...genreHints, ...rule.genreHints];
    }
    if (rule.searchQueries?.length) {
      searchQueries = [...searchQueries, ...rule.searchQueries];
    }
    if (rule.rejectTitlePatterns?.length) {
      rejectTitlePatterns = [...rejectTitlePatterns, ...rule.rejectTitlePatterns];
    }
    break;
  }

  if (vibe?.moodHint) searchQueries.push(`${trimmed} ${vibe.moodHint}`.trim());
  for (const kw of vibe?.keywords?.slice(0, 6) ?? []) {
    if (kw.length >= 2) {
      tagHints.push(kw);
      searchQueries.push(kw);
    }
  }
  for (const g of vibe?.genreHints ?? []) {
    genreHints.push(g);
    searchQueries.push(`${g} ${trimmed}`.trim());
  }

  const dedupe = (arr: string[]) => {
    const seen = new Set<string>();
    return arr
      .map((s) => s.trim())
      .filter((s) => {
        if (s.length < 2) return false;
        const key = s.toLocaleLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  return {
    primaryPhrase: trimmed,
    contextPhrases: dedupe(contextPhrases),
    tagHints: dedupe(tagHints),
    genreHints: dedupe(genreHints),
    searchQueries: dedupe(searchQueries).slice(0, 14),
    rejectTitlePatterns,
  };
}
