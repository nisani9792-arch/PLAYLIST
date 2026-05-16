import { normalizeHebrew, normalizeParashaToken } from "./normalize";
import { parseArtistSongLine, sanitizePlaylistLine } from "./sanitize";
import { assertHashkafaClean, findForbiddenFeatureViolation } from "./secular-artists";
import type { MsHitLike } from "./ms-hit";
import { applyPshCanonical, canonicalSongKey } from "./ms-hit";
import type { PshSongRow } from "./psh-types";
import { toPlaylistLine } from "./psh-types";

export type ValidationIssueCode =
  | "HASHKAFA_SECULAR_ARTIST"
  | "PARASHA_MISMATCH"
  | "PSH_NOT_IN_PARASHA"
  | "MEILI_PSH_MISMATCH"
  | "DUPLICATE_SONG";

export type ValidationIssue = {
  code: ValidationIssueCode;
  message: string;
};

export type ParashaValidationContext = {
  targetParasha: string;
  catalogRows: PshSongRow[];
};

export const AUTO_MATCH_THRESHOLD = 0.68;
export const REVIEW_THRESHOLD = 0.38;

function wordsSimilarity(query: string, candidate: string): number {
  const qWords = normalizeHebrew(query)
    .split(" ")
    .filter((w) => w.length >= 2);
  const cWords = normalizeHebrew(candidate)
    .split(" ")
    .filter((w) => w.length >= 2);
  if (!qWords.length || !cWords.length) return 0;

  let hits = 0;
  for (const qw of qWords) {
    if (cWords.some((cw) => qw === cw || qw.includes(cw) || cw.includes(qw))) {
      hits += 1;
    }
  }
  return hits / qWords.length;
}

export function matchConfidence(
  song: string,
  artist: string,
  hit: MsHitLike,
): number {
  const songScore = wordsSimilarity(song, hit.song_name);
  const artistScore = artist ? wordsSimilarity(artist, hit.artist) : 0;
  const whole = [song, artist].filter(Boolean).join(" ");
  const wholeScore = wordsSimilarity(
    whole,
    [hit.song_name, hit.artist, hit.album, ...(hit.tags ?? [])].join(" "),
  );
  const structured = artist ? songScore * 0.72 + artistScore * 0.28 : songScore;
  return Math.min(1, Math.max(structured, wholeScore * 0.9));
}

export function findPshRowForLine(
  line: string,
  rows: PshSongRow[],
  targetParasha?: string,
): PshSongRow | null {
  const sanitized = sanitizePlaylistLine(line);
  const key = normalizeHebrew(sanitized);
  const target = targetParasha
    ? normalizeParashaToken(targetParasha)
    : null;

  let best: PshSongRow | null = null;
  let bestScore = 0;

  const parsed = parseArtistSongLine(sanitized);

  for (const row of rows) {
    if (target && normalizeParashaToken(row.parasha) !== target) continue;

    const lineVariants = [
      normalizeHebrew(toPlaylistLine(row)),
      normalizeHebrew(`${row.title} ${row.artist}`),
      normalizeHebrew(`${row.artist} ${row.title}`),
    ];

    for (const variant of lineVariants) {
      if (variant === key) return row;
    }

    const conf = Math.max(
      matchConfidence(parsed.song || sanitized, parsed.artist, {
        id: "",
        song_name: row.title,
        artist: row.artist,
      }),
      matchConfidence(row.title, row.artist, {
        id: "",
        song_name: parsed.song || sanitized,
        artist: parsed.artist,
      }),
    );

    if (conf > bestScore) {
      bestScore = conf;
      best = row;
    }
  }

  return bestScore >= 0.72 ? best : null;
}

export function validateHashkafa(
  texts: Array<string | undefined | null>,
): ValidationIssue | null {
  const blocked = assertHashkafaClean(...texts);
  if (blocked) {
    return {
      code: "HASHKAFA_SECULAR_ARTIST",
      message: `חסימת השקפה: זוהה אמן חילוני אסור (${blocked})`,
    };
  }

  for (const text of texts) {
    if (!text?.trim()) continue;
    const feature = findForbiddenFeatureViolation(text, ...texts);
    if (feature) {
      return {
        code: "HASHKAFA_SECULAR_ARTIST",
        message: `חסימת השקפה: בשיר זה מופיע אמן חילוני אסור (${feature})`,
      };
    }
  }

  return null;
}

export function validateParashaMembership(
  pshRow: PshSongRow | null | undefined,
  ctx: ParashaValidationContext,
): ValidationIssue | null {
  const target = normalizeParashaToken(ctx.targetParasha);
  if (!target) return null;

  if (!pshRow) {
    return {
      code: "PSH_NOT_IN_PARASHA",
      message: `השיר לא נמצא בקטלוג PSH לפרשת ${ctx.targetParasha}`,
    };
  }

  if (normalizeParashaToken(pshRow.parasha) !== target) {
    return {
      code: "PARASHA_MISMATCH",
      message: `השיר שייך לפרשת ${pshRow.parasha}, לא לפרשת ${ctx.targetParasha}`,
    };
  }

  return null;
}

export function validateMeiliAgainstPsh(
  hit: MsHitLike,
  pshRow: PshSongRow,
  minConfidence = 0.55,
): ValidationIssue | null {
  const conf = matchConfidence(pshRow.title, pshRow.artist, hit);
  if (conf >= minConfidence) return null;
  return {
    code: "MEILI_PSH_MISMATCH",
    message: `התאמה חלשה למאגר: PSH "${pshRow.title}" – ${pshRow.artist}, נמצא "${hit.song_name}" – ${hit.artist}`,
  };
}

export type StagingValidationInput = {
  query: string;
  hit: MsHitLike | null;
  confidence: number;
  pshRow?: PshSongRow | null;
  parashaContext?: ParashaValidationContext | null;
};

export type StagingValidationResult = {
  issue: ValidationIssue | null;
  canonicalHit: MsHitLike | null;
  effectivePshRow: PshSongRow | null;
};

export function validateStagingMatch(
  input: StagingValidationInput,
): StagingValidationResult {
  const query = sanitizePlaylistLine(input.query);
  let pshRow = input.pshRow ?? null;

  if (input.parashaContext && !pshRow) {
    pshRow = findPshRowForLine(
      query,
      input.parashaContext.catalogRows,
      input.parashaContext.targetParasha,
    );
  }

  const hashkafaTexts = [
    query,
    pshRow?.title,
    pshRow?.artist,
    pshRow?.composer,
    input.hit?.song_name,
    input.hit?.artist,
    input.hit?.album,
    ...(input.hit?.tags ?? []),
  ];

  const hashkafaIssue = validateHashkafa(hashkafaTexts);
  if (hashkafaIssue) {
    return { issue: hashkafaIssue, canonicalHit: null, effectivePshRow: pshRow };
  }

  if (input.parashaContext) {
    const parashaIssue = validateParashaMembership(pshRow, input.parashaContext);
    if (parashaIssue) {
      return { issue: parashaIssue, canonicalHit: null, effectivePshRow: pshRow };
    }
  }

  if (!input.hit || input.confidence < REVIEW_THRESHOLD) {
    return { issue: null, canonicalHit: null, effectivePshRow: pshRow };
  }

  if (pshRow) {
    const mismatch = validateMeiliAgainstPsh(input.hit, pshRow);
    if (mismatch) {
      return { issue: mismatch, canonicalHit: null, effectivePshRow: pshRow };
    }
    return {
      issue: null,
      canonicalHit: applyPshCanonical(input.hit, pshRow),
      effectivePshRow: pshRow,
    };
  }

  return {
    issue: null,
    canonicalHit: input.hit,
    effectivePshRow: pshRow,
  };
}

export function validatePlaylistForExport(
  songs: MsHitLike[],
  parashaContext?: ParashaValidationContext | null,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  for (const song of songs) {
    const key = canonicalSongKey(song);
    if (seen.has(key)) {
      issues.push({
        code: "DUPLICATE_SONG",
        message: `כפילות בפלייליסט: ${song.song_name} – ${song.artist}`,
      });
      continue;
    }
    seen.add(key);

    const hashkafa = validateHashkafa([
      song.song_name,
      song.artist,
      song.album,
      ...(song.tags ?? []),
    ]);
    if (hashkafa) issues.push(hashkafa);

    if (parashaContext) {
      const pshRow = findPshRowForLine(
        `${song.artist} - ${song.song_name}`,
        parashaContext.catalogRows,
        parashaContext.targetParasha,
      );
      const parashaIssue = validateParashaMembership(pshRow, parashaContext);
      if (parashaIssue) issues.push(parashaIssue);
    }
  }

  return issues;
}
