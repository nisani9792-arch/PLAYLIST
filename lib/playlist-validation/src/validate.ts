import {
  applyInputTitleAliases,
  canonicalParashaForTitle,
} from "./aliases";
import { normalizeHebrew, normalizeParashaToken } from "./normalize";
import {
  parseArtistSongLine,
  parseLineBothWays,
  sanitizePlaylistLine,
} from "./sanitize";
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

export type ValidationIssueSeverity = "block" | "review";

export type ValidationIssue = {
  code: ValidationIssueCode;
  message: string;
  severity: ValidationIssueSeverity;
};

export function validationIssueSeverity(
  code: ValidationIssueCode,
): ValidationIssueSeverity {
  return code === "HASHKAFA_SECULAR_ARTIST" ? "block" : "review";
}

function issue(
  code: ValidationIssueCode,
  message: string,
  severity?: ValidationIssueSeverity,
): ValidationIssue {
  return {
    code,
    message,
    severity: severity ?? validationIssueSeverity(code),
  };
}

export type ParashaValidationContext = {
  targetParasha: string;
  /** Rows for the target parasha (playlist membership). */
  catalogRows: PshSongRow[];
  /** Full PSH catalog — used for cross-parasha and hashkafa checks on pasted lines. */
  allCatalogRows?: PshSongRow[];
};

export const AUTO_MATCH_THRESHOLD = 0.68;
export const REVIEW_THRESHOLD = 0.38;
/** Lomdaat/Odoo export — accept catalog matches at review confidence (not only auto-match). */
export const LOMDAAT_EXPORT_THRESHOLD = REVIEW_THRESHOLD;

/** Normalized song+artist equality (nikud / final letters ignored). */
export function isExactSongArtistMatch(
  a: { song_name?: string; artist?: string },
  b: { song_name?: string; artist?: string },
): boolean {
  const s1 = normalizeHebrew(String(a.song_name ?? ""));
  const s2 = normalizeHebrew(String(b.song_name ?? ""));
  const ar1 = normalizeHebrew(String(a.artist ?? ""));
  const ar2 = normalizeHebrew(String(b.artist ?? ""));
  if (!s1 || !s2) return false;
  if (s1 !== s2) return false;
  if (!ar1 || !ar2) return true;
  return ar1 === ar2;
}

export function isExactSongTitleMatch(a: string, b: string): boolean {
  const s1 = normalizeHebrew(a);
  const s2 = normalizeHebrew(b);
  return Boolean(s1 && s2 && s1 === s2);
}

/** True when the pasted line clearly matches the Meilisearch hit (auto-approve staging). */
export function queryMatchesHit(query: string, hit: MsHitLike): boolean {
  const cleaned = applyInputTitleAliases(sanitizePlaylistLine(query));
  for (const parsed of parseLineBothWays(cleaned)) {
    if (
      isExactSongArtistMatch(
        { song_name: parsed.song, artist: parsed.artist },
        hit,
      )
    ) {
      return true;
    }
    if (
      isExactSongTitleMatch(parsed.song, hit.song_name) &&
      (!parsed.artist.trim() ||
        matchConfidence("", parsed.artist, hit) >= 0.45)
    ) {
      return true;
    }
    if (matchConfidence(parsed.song, parsed.artist, hit) >= 0.92) {
      return true;
    }
  }
  return false;
}

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

function globalCatalog(ctx?: ParashaValidationContext | null): PshSongRow[] {
  if (!ctx) return [];
  return ctx.allCatalogRows?.length ? ctx.allCatalogRows : ctx.catalogRows;
}

export function hashkafaFromCatalogTitle(
  title: string,
  catalog: PshSongRow[],
): ValidationIssue | null {
  const needle = normalizeHebrew(title);
  if (!needle) return null;

  for (const row of catalog) {
    const rowTitle = normalizeHebrew(row.title);
    const titleMatches =
      rowTitle === needle ||
      (needle.length >= 4 &&
        (rowTitle.includes(needle) || needle.includes(rowTitle)) &&
        wordsSimilarity(needle, rowTitle) >= 0.72);
    if (!titleMatches) continue;
    const blocked = assertHashkafaClean(
      row.title,
      row.artist,
      row.composer,
      row.album,
    );
    if (blocked) {
      return issue(
        "HASHKAFA_SECULAR_ARTIST",
        `חסימת השקפה: זוהה אמן חילוני אסור (${blocked})`,
        "block",
      );
    }
  }
  return null;
}

export function validateCanonicalTitleParasha(
  title: string,
  ctx: ParashaValidationContext,
): ValidationIssue | null {
  const canonicalParasha = canonicalParashaForTitle(title);
  if (!canonicalParasha) return null;
  const target = normalizeParashaToken(ctx.targetParasha);
  if (normalizeParashaToken(canonicalParasha) === target) return null;
  return issue(
    "PARASHA_MISMATCH",
    `השיר שייך לפרשת ${canonicalParasha}, לא לפרשת ${ctx.targetParasha}`,
    "review",
  );
}

export function findPshRowForLine(
  line: string,
  rows: PshSongRow[],
  targetParasha?: string,
  globalRows?: PshSongRow[],
): PshSongRow | null {
  const sanitized = applyInputTitleAliases(sanitizePlaylistLine(line));
  const key = normalizeHebrew(sanitized);
  const target = targetParasha
    ? normalizeParashaToken(targetParasha)
    : null;
  const pool = globalRows?.length ? globalRows : rows;

  let best: PshSongRow | null = null;
  let bestScore = 0;

  const orientations = parseLineBothWays(sanitized);
  const titleTokens = [
    ...new Set(
      orientations
        .flatMap((o) => [o.song, o.artist])
        .map((t) => normalizeHebrew(t))
        .filter((t) => t.length >= 3),
    ),
  ];

  const directPool = target
    ? pool.filter((r) => normalizeParashaToken(r.parasha) === target)
    : pool;
  const directMatches = directPool.filter((row) => {
    const rt = normalizeHebrew(row.title);
    return titleTokens.some((t) => rt === t || rt.includes(t));
  });
  if (directMatches.length === 1) {
    return directMatches[0]!;
  }
  if (directMatches.length > 1) {
    let bestDirect: PshSongRow | null = null;
    let bestDirectScore = 0;
    for (const row of directMatches) {
      for (const parsed of orientations) {
        const conf = matchConfidence(parsed.song, parsed.artist, {
          id: "",
          song_name: row.title,
          artist: row.artist,
        });
        if (conf > bestDirectScore) {
          bestDirectScore = conf;
          bestDirect = row;
        }
      }
    }
    if (bestDirect) return bestDirect;
  }

  for (const row of pool) {

    const lineVariants = [
      normalizeHebrew(toPlaylistLine(row)),
      normalizeHebrew(`${row.title} ${row.artist}`),
      normalizeHebrew(`${row.artist} ${row.title}`),
    ];

    for (const variant of lineVariants) {
      if (variant === key) return row;
    }

    let conf = 0;
    for (const parsed of orientations) {
      conf = Math.max(
        conf,
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
    }

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
    return issue(
      "HASHKAFA_SECULAR_ARTIST",
      `חסימת השקפה: זוהה אמן חילוני אסור (${blocked})`,
      "block",
    );
  }

  for (const text of texts) {
    if (!text?.trim()) continue;
    const feature = findForbiddenFeatureViolation(text, ...texts);
    if (feature) {
      return issue(
        "HASHKAFA_SECULAR_ARTIST",
        `חסימת השקפה: בשיר זה מופיע אמן חילוני אסור (${feature})`,
        "block",
      );
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
    return issue(
      "PSH_NOT_IN_PARASHA",
      `השיר לא נמצא בקטלוג PSH לפרשת ${ctx.targetParasha}`,
      "review",
    );
  }

  if (normalizeParashaToken(pshRow.parasha) !== target) {
    return issue(
      "PARASHA_MISMATCH",
      `השיר שייך לפרשת ${pshRow.parasha}, לא לפרשת ${ctx.targetParasha}`,
      "review",
    );
  }

  return null;
}

export function validateMeiliAgainstPsh(
  hit: MsHitLike,
  pshRow: PshSongRow,
  minConfidence = 0.55,
): ValidationIssue | null {
  if (
    isExactSongArtistMatch(
      { song_name: hit.song_name, artist: hit.artist },
      { song_name: pshRow.title, artist: pshRow.artist },
    )
  ) {
    return null;
  }
  if (isExactSongTitleMatch(hit.song_name, pshRow.title)) {
    const artistOnly = matchConfidence("", pshRow.artist, hit);
    if (artistOnly >= 0.38 || !pshRow.artist.trim()) return null;
  }
  const conf = matchConfidence(pshRow.title, pshRow.artist, hit);
  if (conf >= minConfidence) return null;
  return issue(
    "MEILI_PSH_MISMATCH",
    `התאמה חלשה למאגר: PSH "${pshRow.title}" – ${pshRow.artist}, נמצא "${hit.song_name}" – ${hit.artist}`,
    "review",
  );
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

function pshRowToHit(row: PshSongRow, seed?: MsHitLike | null): MsHitLike {
  return applyPshCanonical(
    {
      id: seed?.id ?? "",
      song_name: seed?.song_name ?? row.title,
      artist: seed?.artist ?? row.artist,
      album: seed?.album ?? row.album,
      tags: seed?.tags,
    },
    row,
  );
}

export function validateStagingMatch(
  input: StagingValidationInput,
): StagingValidationResult {
  const query = applyInputTitleAliases(sanitizePlaylistLine(input.query));
  const parsed = parseArtistSongLine(query);
  let pshRow = input.pshRow ?? null;
  const global = globalCatalog(input.parashaContext);

  if (input.parashaContext && !pshRow) {
    pshRow = findPshRowForLine(
      query,
      input.parashaContext.catalogRows,
      input.parashaContext.targetParasha,
      global,
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

  const titleNeedles = [
    ...parseLineBothWays(query).flatMap((p) => [p.song, p.artist]),
    pshRow?.title,
    query,
  ].filter((t): t is string => Boolean(t?.trim()));

  if (pshRow) {
    const rowHashkafa = validateHashkafa([
      pshRow.title,
      pshRow.artist,
      pshRow.composer,
      pshRow.album,
    ]);
    if (rowHashkafa?.severity === "block") {
      return { issue: rowHashkafa, canonicalHit: null, effectivePshRow: pshRow };
    }
  } else {
    for (const needle of titleNeedles) {
      const catalogHashkafa = hashkafaFromCatalogTitle(needle, global);
      if (catalogHashkafa?.severity === "block") {
        return { issue: catalogHashkafa, canonicalHit: null, effectivePshRow: pshRow };
      }
    }
  }

  if (input.parashaContext) {
    let titleParasha: ValidationIssue | null = null;
    for (const needle of titleNeedles) {
      titleParasha = validateCanonicalTitleParasha(needle, input.parashaContext);
      if (titleParasha) break;
    }
    if (titleParasha) {
      return { issue: titleParasha, canonicalHit: null, effectivePshRow: pshRow };
    }

    const parashaIssue = validateParashaMembership(pshRow, input.parashaContext);
    if (parashaIssue) {
      return { issue: parashaIssue, canonicalHit: null, effectivePshRow: pshRow };
    }
  }

  if (!input.hit || input.confidence < REVIEW_THRESHOLD) {
    if (pshRow) {
      return {
        issue: null,
        canonicalHit: pshRowToHit(pshRow, input.hit),
        effectivePshRow: pshRow,
      };
    }
    return { issue: null, canonicalHit: null, effectivePshRow: pshRow };
  }

  if (input.hit && queryMatchesHit(query, input.hit)) {
    if (pshRow) {
      const target = input.parashaContext
        ? normalizeParashaToken(input.parashaContext.targetParasha)
        : "";
      const rowInTargetParasha =
        Boolean(target) && normalizeParashaToken(pshRow.parasha) === target;
      if (!input.parashaContext || rowInTargetParasha) {
        return {
          issue: null,
          canonicalHit: applyPshCanonical(input.hit, pshRow),
          effectivePshRow: pshRow,
        };
      }
    } else {
      return {
        issue: null,
        canonicalHit: input.hit,
        effectivePshRow: pshRow,
      };
    }
  }

  if (pshRow) {
    const target = input.parashaContext
      ? normalizeParashaToken(input.parashaContext.targetParasha)
      : "";
    const rowInTargetParasha =
      Boolean(target) && normalizeParashaToken(pshRow.parasha) === target;

    if (rowInTargetParasha) {
      return {
        issue: null,
        canonicalHit: applyPshCanonical(input.hit ?? pshRowToHit(pshRow), pshRow),
        effectivePshRow: pshRow,
      };
    }

    const mismatch = validateMeiliAgainstPsh(input.hit, pshRow);
    if (mismatch) {
      return {
        issue: mismatch,
        canonicalHit: pshRowToHit(pshRow, input.hit),
        effectivePshRow: pshRow,
      };
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
      issues.push(
        issue(
          "DUPLICATE_SONG",
          `כפילות בפלייליסט: ${song.song_name} – ${song.artist}`,
          "review",
        ),
      );
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

    const line = `${song.artist} - ${song.song_name}`;
    const global = globalCatalog(parashaContext);
    const hashkafaCatalog = hashkafaFromCatalogTitle(song.song_name, global);
    if (hashkafaCatalog) issues.push(hashkafaCatalog);

    if (parashaContext) {
      const titleParasha = validateCanonicalTitleParasha(
        song.song_name,
        parashaContext,
      );
      if (titleParasha) issues.push(titleParasha);

      const pshRow = findPshRowForLine(
        line,
        parashaContext.catalogRows,
        parashaContext.targetParasha,
        global,
      );
      const parashaIssue = validateParashaMembership(pshRow, parashaContext);
      if (parashaIssue) issues.push(parashaIssue);
    }
  }

  return issues;
}
