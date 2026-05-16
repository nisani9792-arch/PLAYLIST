/** Minimal song hit shape used by validation (matches jusic MsHit). */
export type MsHitLike = {
  id: string;
  song_name: string;
  artist: string;
  genre?: string;
  album?: string;
  tags?: string[];
  _rankingScore?: number;
};

export function canonicalSongKey(hit: MsHitLike): string {
  const id = String(hit.id ?? "").trim();
  if (/^\d+$/.test(id) || /^SON-\d+$/i.test(id)) {
    return `id:${id.toLowerCase()}`;
  }
  return `t:${hit.artist}|${hit.song_name}`.toLowerCase();
}

export function applyPshCanonical(hit: MsHitLike, psh: {
  title: string;
  artist: string;
  album?: string;
}): MsHitLike {
  return {
    ...hit,
    song_name: psh.title,
    artist: psh.artist,
    album: psh.album?.trim() || hit.album || "",
  };
}
