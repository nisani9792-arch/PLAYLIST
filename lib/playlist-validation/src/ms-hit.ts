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

function artistNamesFromArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (entry && typeof entry === "object") {
        const row = entry as Record<string, unknown>;
        return String(
          row.name ?? row.artist ?? row.name_he ?? row.label ?? "",
        ).trim();
      }
      return "";
    })
    .filter(Boolean);
}

/** Artist string for Lomdaat / Odoo `imported_artist_name` (must match catalog). */
export function odooImportArtistFromHit(hit: Record<string, unknown>): string {
  const direct = String(hit.artist ?? hit.artist_name ?? "").trim();
  if (direct) return direct;

  const fromArray = artistNamesFromArray(hit.artists);
  if (fromArray.length) return fromArray.join(" ");

  return String(hit.artist_he ?? hit.artist_name_he ?? "").trim();
}

/** Song title for Lomdaat / Odoo `imported_song_name`. */
export function odooImportSongNameFromHit(hit: Record<string, unknown>): string {
  return String(
    hit.name_he ??
      hit.song_name ??
      hit.name_en ??
      hit.name ??
      hit.title ??
      "",
  ).trim();
}

export function msHitLikeFromMeiliRecord(hit: Record<string, unknown>): MsHitLike {
  return {
    id: String(hit.uid ?? hit.id ?? "").trim(),
    song_name: odooImportSongNameFromHit(hit),
    artist: odooImportArtistFromHit(hit),
    album: String(hit.album ?? "").trim() || undefined,
    tags: Array.isArray(hit.tags) ? (hit.tags as string[]) : undefined,
  };
}
