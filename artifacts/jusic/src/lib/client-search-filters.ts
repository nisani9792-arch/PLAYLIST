import { scoreHitForTopic, parseVibeFromPrompt } from '@workspace/curator';
import { filterHashkafaHits } from '@workspace/playlist-validation';
import type { MsHit } from './meilisearch';
import type { VibeFilter } from '@/stores/slices/searchSlice';

export function applyClientSearchFilters(
  hits: MsHit[],
  options: { vibeFilter: VibeFilter; hashkafaShield: boolean },
): MsHit[] {
  let filtered = hits;

  if (options.hashkafaShield) {
    filtered = filterHashkafaHits(filtered).allowed;
  }

  if (options.vibeFilter) {
    const vibe = parseVibeFromPrompt(options.vibeFilter);
    const topic = `vibe:${options.vibeFilter}`;
    filtered = filtered
      .map((hit) => ({
        hit,
        score: scoreHitForTopic(hit, { topic, vibe }),
      }))
      .filter((r) => r.score >= 0.28)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.hit);
  }

  return filtered;
}
