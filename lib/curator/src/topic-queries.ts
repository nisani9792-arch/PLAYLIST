import type { VibeAnalysis } from "./vibe-analysis";

export function buildTopicQueries(topic: string, vibe: VibeAnalysis): string[] {
  const queries = new Set<string>();
  queries.add(topic.trim());

  if (vibe.moodHint) queries.add(`${topic} ${vibe.moodHint}`.trim());
  for (const genre of vibe.genreHints.slice(0, 2)) {
    queries.add(`${genre} ${topic}`.trim());
  }
  for (const kw of vibe.keywords.slice(0, 4)) {
    if (kw.length >= 2) queries.add(kw);
  }

  return [...queries].filter(Boolean).slice(0, 8);
}
