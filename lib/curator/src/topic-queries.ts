import type { VibeAnalysis } from "./vibe-analysis";
import { expandTopicFacets } from "./topic-facets";

export function buildTopicQueries(topic: string, vibe: VibeAnalysis): string[] {
  const facets = expandTopicFacets(topic, vibe);
  const queries = new Set<string>(facets.searchQueries);

  if (vibe.moodHint) queries.add(`${topic} ${vibe.moodHint}`.trim());
  for (const tag of facets.tagHints.slice(0, 6)) {
    queries.add(tag);
    queries.add(`${tag} ${topic}`.trim());
  }
  for (const genre of facets.genreHints.slice(0, 3)) {
    queries.add(`${genre} ${topic}`.trim());
  }

  return [...queries].filter(Boolean).slice(0, 12);
}
