import type { MsHit } from './meilisearch';

export type ArrangeMode = 'bpm' | 'key' | 'vibe' | 'energy';

const KEY_ORDER = [
  'C', 'Cm', 'C#', 'C#m', 'Db', 'Dbm', 'D', 'Dm', 'D#', 'D#m', 'Eb', 'Ebm',
  'E', 'Em', 'F', 'Fm', 'F#', 'F#m', 'Gb', 'Gbm', 'G', 'Gm', 'G#', 'G#m',
  'Ab', 'Abm', 'A', 'Am', 'A#', 'A#m', 'Bb', 'Bbm', 'B', 'Bm',
];

const VIBE_ORDER: Record<string, number> = {
  slow: 0,
  ballad: 1,
  calm: 2,
  acoustic: 3,
  mid: 4,
  upbeat: 5,
  dance: 6,
  energetic: 7,
  fast: 8,
};

function fromTags(song: MsHit, pattern: RegExp): string | null {
  for (const tag of song.tags) {
    const m = tag.match(pattern);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function extractBpm(song: MsHit): number | null {
  const fromTag = fromTags(song, /(\d{2,3})\s*bpm/i);
  if (fromTag) return parseInt(fromTag, 10);
  const genreMatch = song.genre.match(/(\d{2,3})\s*bpm/i);
  if (genreMatch?.[1]) return parseInt(genreMatch[1], 10);
  return null;
}

export function extractKey(song: MsHit): string | null {
  const fromTag = fromTags(song, /^([A-G][#b]?m?)$/i);
  if (fromTag) return fromTag;
  for (const tag of song.tags) {
    const m = tag.match(/key[:\s]+([A-G][#b]?m?)/i);
    if (m?.[1]) return m[1];
  }
  return null;
}

function extractVibe(song: MsHit): string {
  for (const tag of song.tags) {
    const lower = tag.toLowerCase();
    if (lower in VIBE_ORDER) return lower;
  }
  const genre = song.genre.toLowerCase();
  for (const vibe of Object.keys(VIBE_ORDER)) {
    if (genre.includes(vibe)) return vibe;
  }
  return 'mid';
}

function keyIndex(key: string | null): number {
  if (!key) return 999;
  const idx = KEY_ORDER.findIndex((k) => k.toLowerCase() === key.toLowerCase());
  return idx >= 0 ? idx : 500;
}

function energyScore(song: MsHit): number {
  const bpm = extractBpm(song) ?? 100;
  const vibe = extractVibe(song);
  const vibeScore = VIBE_ORDER[vibe] ?? 4;
  return bpm * 0.7 + vibeScore * 12;
}

/** Client-side auto-arrange by BPM, musical key, vibe, or energy curve. */
export function arrangeSongs(songs: MsHit[], mode: ArrangeMode): MsHit[] {
  const copy = [...songs];
  switch (mode) {
    case 'bpm':
      return copy.sort((a, b) => (extractBpm(a) ?? 999) - (extractBpm(b) ?? 999));
    case 'key':
      return copy.sort((a, b) => keyIndex(extractKey(a)) - keyIndex(extractKey(b)));
    case 'vibe':
      return copy.sort(
        (a, b) =>
          (VIBE_ORDER[extractVibe(a)] ?? 4) - (VIBE_ORDER[extractVibe(b)] ?? 4),
      );
    case 'energy':
      return copy.sort((a, b) => energyScore(a) - energyScore(b));
    default:
      return copy;
  }
}
