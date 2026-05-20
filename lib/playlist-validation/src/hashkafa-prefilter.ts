import type { MsHitLike } from "./ms-hit";
import { assertHashkafaClean, findSecularArtistViolation } from "./secular-artists";

export type HashkafaBlockResult = {
  blocked: boolean;
  reason?: string;
};

export function checkHashkafa(...texts: Array<string | undefined | null>): HashkafaBlockResult {
  const hit = assertHashkafaClean(...texts);
  if (hit) return { blocked: true, reason: `אמן חסום: ${hit}` };
  return { blocked: false };
}

export function filterHashkafaHits<T extends MsHitLike>(
  hits: T[],
): { allowed: T[]; blocked: Array<{ hit: T; reason: string }> } {
  const allowed: T[] = [];
  const blocked: Array<{ hit: T; reason: string }> = [];

  for (const hit of hits) {
    const violation = findSecularArtistViolation(`${hit.artist} ${hit.song_name}`);
    if (violation) {
      blocked.push({ hit, reason: `אמן חסום: ${violation}` });
      continue;
    }
    allowed.push(hit);
  }

  return { allowed, blocked };
}
