import {
  countHebrewLetters,
  isPrimarilyLatin,
  preferHebrewOnlyText,
  trimLomdaatField,
} from "./lomdaat-export";

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
        const he = String(row.name_he ?? row.artist_he ?? "").trim();
        const main = String(row.name ?? row.artist ?? row.label ?? "").trim();
        if (main && !isPrimarilyLatin(main)) return preferHebrewOnlyText(main);
        if (he) return preferHebrewOnlyText(he);
        return preferHebrewOnlyText(main);
      }
      return "";
    })
    .filter(Boolean);
}

/** Artist string for Lomdaat / Odoo `imported_artist_name` (Hebrew only). */
export function odooImportArtistFromHit(
  hit: Record<string, unknown> | null | undefined,
): string {
  if (!hit || typeof hit !== "object") return "";
  const artistHe = String(hit.artist_he ?? hit.artist_name_he ?? "").trim();
  const artistMain = String(hit.artist ?? hit.artist_name ?? "").trim();

  if (artistMain && countHebrewLetters(artistMain) > 0) {
    const heOnly = preferHebrewOnlyText(artistMain);
    if (heOnly) return heOnly;
  }
  if (artistHe) return preferHebrewOnlyText(artistHe);

  const fromArray = artistNamesFromArray(hit.artists);
  if (fromArray.length) return preferHebrewOnlyText(fromArray.join(" "));

  if (artistMain && !isPrimarilyLatin(artistMain)) {
    return preferHebrewOnlyText(artistMain);
  }
  if (artistMain) return preferHebrewOnlyText(artistMain);
  return "";
}

/** Song title for Lomdaat / Odoo `imported_song_name` (Hebrew preferred). */
export function odooImportSongNameFromHit(
  hit: Record<string, unknown> | null | undefined,
): string {
  if (!hit || typeof hit !== "object") return "";
  const nameHe = String(hit.name_he ?? "").trim();
  const main = String(hit.song_name ?? hit.name ?? hit.title ?? "").trim();

  if (main && !isPrimarilyLatin(main)) return preferHebrewOnlyText(main);
  if (nameHe) return preferHebrewOnlyText(nameHe);
  return preferHebrewOnlyText(main);
}

export function msHitLikeFromMeiliRecord(
  hit: Record<string, unknown> | null | undefined,
): MsHitLike {
  if (!hit || typeof hit !== "object") {
    return { id: "", song_name: "", artist: "" };
  }
  const genres = Array.isArray(hit.genres)
    ? (hit.genres as unknown[]).map(String).filter(Boolean)
    : [];
  const genre =
    String(hit.genre ?? "").trim() ||
    genres[0]?.trim() ||
    undefined;

  return {
    id: String(hit.uid ?? hit.id ?? "").trim(),
    song_name: odooImportSongNameFromHit(hit),
    artist: odooImportArtistFromHit(hit),
    album: String(hit.album ?? "").trim() || undefined,
    genre,
    tags: Array.isArray(hit.tags) ? (hit.tags as string[]) : undefined,
  };
}
