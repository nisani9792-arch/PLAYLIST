import {
  assertHashkafaClean,
  canonicalSongKey,
  type MsHitLike,
} from "@workspace/playlist-validation";

export type RankCandidate = MsHitLike & { _line?: string };

const MAX_PER_ARTIST = 3;

export function artistCountsFromLines(lines: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const artist = line.split(" - ")[0]?.trim().toLowerCase();
    if (!artist) continue;
    counts.set(artist, (counts.get(artist) ?? 0) + 1);
  }
  return counts;
}

export function excludeKeysFromLines(lines: string[]): Set<string> {
  const keys = new Set<string>();
  for (const line of lines) {
    const [artist, title] = line.split(" - ").map((s) => s.trim());
    if (artist && title) {
      keys.add(`t:${artist}|${title}`.toLowerCase());
    }
  }
  return keys;
}

export function formatArtistSongLine(hit: MsHitLike): string {
  return `${hit.artist.trim()} - ${hit.song_name.trim()}`;
}

export function rankAndSelectCandidates(
  candidates: RankCandidate[],
  targetSize: number,
  excludeKeys: Set<string> = new Set(),
  initialArtistCounts: Map<string, number> = new Map(),
): { selected: RankCandidate[]; blocked: Array<{ hit: RankCandidate; reason: string }> } {
  const blocked: Array<{ hit: RankCandidate; reason: string }> = [];
  const artistCounts = new Map(initialArtistCounts);
  const selected: RankCandidate[] = [];
  const seen = new Set<string>();

  const sorted = [...candidates].sort(
    (a, b) => (b._rankingScore ?? 0) - (a._rankingScore ?? 0),
  );

  for (const hit of sorted) {
    const key = canonicalSongKey(hit);
    if (seen.has(key) || excludeKeys.has(key)) continue;

    const hashkafa = assertHashkafaClean(hit.artist, hit.song_name);
    if (hashkafa) {
      blocked.push({ hit, reason: `hashkafa: ${hashkafa}` });
      continue;
    }

    const artistKey = hit.artist.toLowerCase().trim();
    const count = artistCounts.get(artistKey) ?? 0;
    if (count >= MAX_PER_ARTIST) continue;

    seen.add(key);
    artistCounts.set(artistKey, count + 1);
    selected.push({ ...hit, _line: formatArtistSongLine(hit) });
    if (selected.length >= targetSize) break;
  }

  return { selected, blocked };
}

export function parseRankSelectionJson(
  text: string,
  candidates: RankCandidate[],
  targetSize: number,
  excludeKeys: Set<string> = new Set(),
): RankCandidate[] {
  const byLine = new Map<string, RankCandidate>();
  for (const c of candidates) {
    byLine.set(formatArtistSongLine(c).toLowerCase(), c);
  }

  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    const parsed = JSON.parse(cleaned) as { songs?: unknown[] };
    const songs = parsed.songs;
    if (!Array.isArray(songs)) return [];

    const picked: RankCandidate[] = [];
    const seen = new Set<string>();

    for (const item of songs) {
      if (picked.length >= targetSize) break;
      const line =
        typeof item === "string"
          ? item.trim()
          : item && typeof item === "object"
            ? `${String((item as Record<string, unknown>).artist ?? "").trim()} - ${String((item as Record<string, unknown>).title ?? (item as Record<string, unknown>).song ?? "").trim()}`
            : "";
      if (!line || line.length < 4) continue;
      const hit = byLine.get(line.toLowerCase());
      if (!hit) continue;
      const key = canonicalSongKey(hit);
      if (seen.has(key) || excludeKeys.has(key)) continue;
      seen.add(key);
      picked.push({ ...hit, _line: line });
    }
    return picked;
  } catch {
    return [];
  }
}

export function buildRankSelectionPrompt(
  topic: string,
  candidates: RankCandidate[],
  targetSize: number,
  vibeReason?: string,
): string {
  const catalog = candidates
    .slice(0, 120)
    .map((c, i) => `${i + 1}. ${formatArtistSongLine(c)}`)
    .join("\n");

  return `# Jusic Curator — Rank & Select

בחר ${targetSize} שירים מהרשימה בלבד. אסור להמציא שירים שלא ברשימה.
${vibeReason ? `הקשר vibe: ${vibeReason}` : ""}

כללים:
- 60% Tier-1 (מוכר), 40% Tier-2 (פחות ndosh)
- מקסימום 3 שירים לאותו אמן
- מאושר: חסידי, מזרחי-חרדי, חזנות, ישיבתי
- אסור: קול אישה, זמרים חילוניים

נושא: "${topic}"

מאגר מועמדים:
${catalog}

החזר JSON בלבד:
{"songs":[{"artist":"...","title":"..."}, ...]}`;
}
