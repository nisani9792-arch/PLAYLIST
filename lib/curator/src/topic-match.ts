import {
  matchConfidence,
  normalizeHebrew,
  type MsHitLike,
} from "@workspace/playlist-validation";
import type { VibeAnalysis } from "./vibe-analysis";
import { expandTopicFacets, type TopicFacets } from "./topic-facets";

export type TopicMatchInput = {
  topic: string;
  vibe?: VibeAnalysis;
  facets?: TopicFacets;
};

const MOOD_UPBEAT = /שמח|חגיג|ריקוד|דלוק|סימחה|עליז|קצבי|מסיבה/i;
const MOOD_SAD = /עצוב|בכי|אבל|יגון|כאב/i;
const MOOD_QUIET = /שקט|נוגה|מרגש|תפילה|אמונה|השראה/i;

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

  switch (vibe.mood) {
    case "quiet":
    case "emotional":
      return MOOD_QUIET.test(text) ? 0.9 : MOOD_UPBEAT.test(text) ? 0.25 : 0.55;
    case "celebratory":
    case "energetic":
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
  for (const re of patterns) {
    if (re.test(title)) return 0.12;
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
  const penalty = rejectPenalty(hit, facets.rejectTitlePatterns);

  const semantic =
    (tagScore * 0.38 +
      genreScore * 0.18 +
      phraseScore * 0.28 +
      moodScore * 0.16) *
    penalty;

  return Math.min(1, base * 0.22 + semantic * 0.78);
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
    ].slice(0, 6),
    moodHint: research.moodHint?.trim() || base.moodHint,
    avoidUpbeat: research.avoidUpbeat ?? base.avoidUpbeat,
    avoidSad: research.avoidSad ?? base.avoidSad,
    reason: research.reason?.trim() || base.reason,
  };
}
