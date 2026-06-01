import {
  matchConfidence,
  normalizeHebrew,
  type MsHitLike,
} from "@workspace/playlist-validation";
import type { VibeAnalysis } from "./vibe-analysis";
import { expandTopicFacets, type TopicFacets } from "./topic-facets";
import { CURATOR_MIN_CANDIDATE_SCORE, HOLIDAY_TITLE_PATTERNS } from "./mood-filters";

export type TopicMatchInput = {
  topic: string;
  vibe?: VibeAnalysis;
  facets?: TopicFacets;
};

const MOOD_UPBEAT = /שמח|חגיג|ריקוד|דלוק|סימחה|עליז|קצבי|מסיבה|party|dance|מקפיץ/i;
const MOOD_SAD = /עצוב|בכי|אבל|יגון|כאב/i;
const MOOD_QUIET = /שקט|נוגה|מרגש|תפילה|אמונה|השראה|אקוסט|acoustic|ballad|ניגון/i;
const SPOKEN_WORD = /פרש(?:ה|ת)|haftorah|הפטרה|נאום|שיח|שיעור|dvar|drash|spoken|מדרש/i;
const CHOIR_MARKERS = /מקהל|choir|choral|Boston|Alexander|אלכסander/i;

function norm(s: string): string {
  return normalizeHebrew(s);
}

function tagOverlapScore(
  hit: MsHitLike,
  facetTags: string[],
): number {
  if (!facetTags.length) return 0;
  const hitTags = (hit.tags ?? []).map(norm).filter(Boolean);
  const blob = norm(
    [hit.song_name, hit.artist, hit.album, hit.genre, ...hitTags].join(" "),
  );
  if (!blob) return 0;

  let hits = 0;
  for (const tag of facetTags) {
    const t = norm(tag);
    if (!t || t.length < 2) continue;
    if (hitTags.some((ht) => ht === t || ht.includes(t) || t.includes(ht))) {
      hits += 1;
      continue;
    }
    if (blob.includes(t)) hits += 1;
  }
  return hits / facetTags.length;
}

function genreMatchScore(hit: MsHitLike, genreHints: string[]): number {
  const g = norm(hit.genre ?? "");
  if (!g || !genreHints.length) return 0;
  for (const hint of genreHints) {
    const h = norm(hint);
    if (!h) continue;
    if (g === h || g.includes(h) || h.includes(g)) return 1;
  }
  return 0;
}

function moodFitScore(hit: MsHitLike, vibe: VibeAnalysis): number {
  const text = norm(
    [hit.song_name, hit.artist, hit.genre, ...(hit.tags ?? [])].join(" "),
  );
  if (!text) return 0.5;

  if (vibe.avoidUpbeat && MOOD_UPBEAT.test(text)) return 0.15;
  if (vibe.avoidSad && MOOD_SAD.test(text)) return 0.15;

  if (vibe.energy === "high" || vibe.mood === "energetic") {
    if (SPOKEN_WORD.test(text)) return 0.05;
    if (CHOIR_MARKERS.test(text)) return 0.12;
    if (MOOD_QUIET.test(text) && !MOOD_UPBEAT.test(text)) return 0.2;
    if (MOOD_UPBEAT.test(text)) return 0.95;
    if (genreMatchScore(hit, vibe.genreHints) >= 0.8) return 0.85;
    return 0.45;
  }

  switch (vibe.mood) {
    case "quiet":
    case "emotional":
      return MOOD_QUIET.test(text) ? 0.9 : MOOD_UPBEAT.test(text) ? 0.25 : 0.55;
    case "celebratory":
      return MOOD_UPBEAT.test(text) ? 0.92 : MOOD_SAD.test(text) ? 0.2 : 0.5;
    default:
      return 0.55;
  }
}

function contextPhraseScore(hit: MsHitLike, phrases: string[]): number {
  if (!phrases.length) return 0;
  let best = 0;
  for (const phrase of phrases) {
    const p = norm(phrase);
    if (!p) continue;
    const conf = matchConfidence(p, "", hit);
    if (conf > best) best = conf;
  }
  return best;
}

function rejectPenalty(hit: MsHitLike, patterns: RegExp[]): number {
  const title = hit.song_name.trim();
  const blob = `${hit.song_name} ${hit.artist} ${(hit.tags ?? []).join(" ")}`;
  for (const re of patterns) {
    if (re.test(title) || re.test(blob)) return 0.08;
  }
  return 1;
}

function exclusionPenalty(hit: MsHitLike, facets: TopicFacets): number {
  const blob = norm(
    [hit.song_name, hit.artist, hit.album, hit.genre, ...(hit.tags ?? [])].join(" "),
  );
  if (!blob) return 1;

  for (const term of facets.excludeTagTerms) {
    const t = norm(term);
    if (t.length >= 2 && blob.includes(t)) return 0.06;
  }

  for (const genre of facets.excludeGenres) {
    const g = norm(genre);
    if (!g) continue;
    const hitGenre = norm(hit.genre ?? "");
    if (hitGenre.includes(g) || blob.includes(g)) return 0.1;
  }

  if (facets.excludeTagTerms.length || facets.rejectTitlePatterns.length) {
    for (const re of HOLIDAY_TITLE_PATTERNS) {
      if (re.test(hit.song_name) || re.test(blob)) return 0.05;
    }
  }

  return 1;
}

/**
 * Scores how well a catalog song fits a playlist topic (tags, genre, mood, context — not title-only tokens).
 */
export function scoreHitForTopic(
  hit: MsHitLike,
  input: TopicMatchInput | string,
): number {
  const topic = typeof input === "string" ? input : input.topic;
  const vibe =
    typeof input === "string" ? undefined : input.vibe;
  const facets =
    typeof input === "string"
      ? expandTopicFacets(topic)
      : (input.facets ?? expandTopicFacets(topic, input.vibe));

  const base = hit._rankingScore ?? 0.5;
  const tagScore = tagOverlapScore(hit, [
    ...facets.tagHints,
    ...facets.searchQueries.slice(0, 8),
  ]);
  const genreScore = genreMatchScore(hit, facets.genreHints);
  const phraseScore = contextPhraseScore(hit, facets.contextPhrases);
  const moodScore = vibe ? moodFitScore(hit, vibe) : 0.5;
  const titlePenalty = rejectPenalty(hit, facets.rejectTitlePatterns);
  const excludePenalty = exclusionPenalty(hit, facets);

  const semantic =
    (tagScore * 0.36 +
      genreScore * 0.22 +
      phraseScore * 0.22 +
      moodScore * 0.2) *
    titlePenalty *
    excludePenalty;

  return Math.min(1, base * 0.12 + semantic * 0.88);
}

/** Drop weak candidates before Gemini rank / playlist assembly. */
export function filterTopicCandidates<T extends MsHitLike>(
  hits: T[],
  topic: string,
  vibe?: VibeAnalysis,
  minScore = CURATOR_MIN_CANDIDATE_SCORE,
): T[] {
  const facets = expandTopicFacets(topic, vibe);
  return hits.filter((hit) => {
    const score = scoreHitForTopic(hit, { topic, vibe, facets });
    hit._rankingScore = score;
    return score >= minScore;
  });
}

/** Minimum topic-fit score to auto-approve staging when a playlist topic is active. */
export const TOPIC_STAGING_MIN_SCORE = 0.42;

export function mergeVibeWithResearch(
  base: VibeAnalysis,
  research: {
    keywords?: string[];
    tagHints?: string[];
    genreHints?: string[];
    mood?: VibeAnalysis["mood"];
    moodHint?: string;
    contextPhrases?: string[];
    avoidUpbeat?: boolean;
    avoidSad?: boolean;
    excludeTags?: string[];
    excludeGenres?: string[];
    season?: VibeAnalysis["season"];
    energy?: VibeAnalysis["energy"];
    excludeHolidays?: boolean;
    reason?: string;
  },
): VibeAnalysis {
  return {
    ...base,
    mood: research.mood ?? base.mood,
    keywords: [...new Set([...base.keywords, ...(research.keywords ?? [])])].slice(
      0,
      12,
    ),
    genreHints: [
      ...new Set([...base.genreHints, ...(research.genreHints ?? [])]),
    ].slice(0, 8),
    moodHint: research.moodHint?.trim() || base.moodHint,
    avoidUpbeat: research.avoidUpbeat ?? base.avoidUpbeat,
    avoidSad: research.avoidSad ?? base.avoidSad,
    excludeTags: [
      ...new Set([...(base.excludeTags ?? []), ...(research.excludeTags ?? [])]),
    ],
    excludeGenres: [
      ...new Set([...(base.excludeGenres ?? []), ...(research.excludeGenres ?? [])]),
    ],
    season: research.season ?? base.season,
    energy: research.energy ?? base.energy,
    excludeHolidays: research.excludeHolidays ?? base.excludeHolidays,
    reason: research.reason?.trim() || base.reason,
  };
}
