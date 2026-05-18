import { useEffect } from "react";
import {
  AUTO_MATCH_THRESHOLD,
  REVIEW_THRESHOLD,
  buildStagingSearchQuery,
  formatStagingDisplayLabel,
  sanitizePlaylistLine,
  stagingSearchVariants,
  validateStagingMatch,
  type ParashaValidationContext,
  type PshSongRow,
} from "@workspace/playlist-validation";
import { MsHit, meilisearchSearch } from "../../lib/meilisearch";
import type { SearchFilterOptions } from "../../lib/search-filters";
import { SONGS_ONLY_FILTERS } from "../../lib/search-filters";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import {
  Loader2,
  X,
  CheckCircle2,
  SearchX,
  Clock,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import React from "react";

export interface StagingItem {
  id: string;
  query: string;
  status:
    | "pending"
    | "searching"
    | "matched"
    | "review"
    | "not-found"
    | "skipped"
    | "blocked";
  match?: MsHit;
  confidence?: number;
  pshRow?: PshSongRow;
  blockReason?: string;
  skipReason?: string;
}
const RANKING_BOOST = 0.1;
const STAGING_SEARCH_LIMIT = 20;
const STAGING_BATCH_SIZE = 10;

function normalizeHebrew(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u0591-\u05c7]/g, "")
    .replace(/[׳"`]/g, "")
    .replace(/[^\u0590-\u05ffa-z0-9\s]/g, " ")
    .replace(/[ך]/g, "כ")
    .replace(/[ם]/g, "מ")
    .replace(/[ן]/g, "נ")
    .replace(/[ף]/g, "פ")
    .replace(/[ץ]/g, "צ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(0),
  );
  for (let i = 0; i < rows; i += 1) dp[i]![0] = i;
  for (let j = 0; j < cols; j += 1) dp[0]![j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        (dp[i - 1]![j] ?? 0) + 1,
        (dp[i]![j - 1] ?? 0) + 1,
        (dp[i - 1]![j - 1] ?? 0) + cost,
      );
    }
  }
  return dp[rows - 1]![cols - 1] ?? Math.max(a.length, b.length);
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
    let matched = false;
    for (const cw of cWords) {
      if (qw === cw) {
        matched = true;
        break;
      }
      if (qw.includes(cw) || cw.includes(qw)) {
        matched = true;
        break;
      }
      const dist = levenshtein(qw, cw);
      if (dist <= 1 && Math.min(qw.length, cw.length) >= 4) {
        matched = true;
        break;
      }
    }
    if (matched) hits += 1;
  }
  return hits / qWords.length;
}

function splitArtistSong(query: string): {
  left: string;
  right: string;
  whole: string;
} {
  const cleaned = query.replace(/^[\d.)\-\s]+/, "").trim();
  const sep = cleaned.match(/\s[-–—:]\s/);
  if (!sep) return { left: "", right: cleaned, whole: cleaned };
  const [left = "", right = ""] = cleaned.split(sep[0], 2);
  if (!left.trim() || !right.trim())
    return { left: "", right: cleaned, whole: cleaned };
  return { left: left.trim(), right: right.trim(), whole: cleaned };
}

function candidateConfidence(
  song: string,
  artist: string,
  whole: string,
  hit: MsHit,
): number {
  const songScore = wordsSimilarity(song || whole, hit.song_name);
  const artistScore = artist ? wordsSimilarity(artist, hit.artist) : 0;
  const searchableHitText = [
    hit.song_name,
    hit.artist,
    hit.album,
    hit.genre,
    ...hit.tags,
  ].join(" ");
  const wholeScore = wordsSimilarity(whole, searchableHitText);

  const structuredScore = artist
    ? songScore * 0.72 + artistScore * 0.28
    : songScore;

  const normalizedSong = normalizeHebrew(song || whole);
  const normalizedCandidateSong = normalizeHebrew(hit.song_name);
  const containsBoost =
    normalizedSong &&
    normalizedCandidateSong &&
    (normalizedSong.includes(normalizedCandidateSong) ||
      normalizedCandidateSong.includes(normalizedSong))
      ? 0.08
      : 0;

  return Math.min(
    1,
    Math.max(structuredScore, wholeScore * 0.9) + containsBoost,
  );
}

function calcHitConfidence(query: string, hit: MsHit): number {
  const parsed = splitArtistSong(query);
  const interpretations = parsed.left
    ? [
        { artist: parsed.left, song: parsed.right },
        { artist: parsed.right, song: parsed.left },
      ]
    : [{ artist: "", song: parsed.right }];

  let conf = 0;
  for (const interpretation of interpretations) {
    conf = Math.max(
      conf,
      candidateConfidence(
        interpretation.song,
        interpretation.artist,
        parsed.whole,
        hit,
      ),
    );
  }

  if (typeof hit._rankingScore === "number" && hit._rankingScore > 0.75) {
    conf = Math.min(1, conf + RANKING_BOOST);
  }
  return conf;
}

function bestMatchForQuery(
  query: string,
  hits: MsHit[],
): { hit: MsHit | null; confidence: number } {
  let best: MsHit | null = null;
  let confidence = 0;
  for (const hit of hits) {
    const c = calcHitConfidence(query, hit);
    if (c > confidence) {
      best = hit;
      confidence = c;
    }
  }
  return { hit: best, confidence };
}

function cachedSearch(
  variant: string,
  filters: SearchFilterOptions,
  cache: Map<string, Promise<MsHit[]>>,
): Promise<MsHit[]> {
  const cacheKey = `${normalizeHebrew(variant)}|${filters.genre ?? ""}`;
  let searchPromise = cache.get(cacheKey);
  if (!searchPromise) {
    searchPromise = meilisearchSearch(variant, STAGING_SEARCH_LIMIT, filters).then(
      (r) => r.hits,
    );
    cache.set(cacheKey, searchPromise);
  }
  return searchPromise;
}

async function findBestMatch(
  query: string,
  filters: SearchFilterOptions,
  cache: Map<string, Promise<MsHit[]>>,
): Promise<{ hit: MsHit | null; confidence: number }> {
  const allHits = new Map<string, MsHit>();
  const [primaryVariant, ...fallbackVariants] = stagingSearchVariants(query);
  if (!primaryVariant) return { hit: null, confidence: 0 };

  const primaryHits = await cachedSearch(primaryVariant, filters, cache);
  for (const hit of primaryHits) {
    allHits.set(hit.id, hit);
  }

  const primaryBest = bestMatchForQuery(query, Array.from(allHits.values()));
  if (
    primaryBest.confidence >= AUTO_MATCH_THRESHOLD ||
    fallbackVariants.length === 0
  ) {
    return primaryBest;
  }

  const settledSearches = await Promise.allSettled(
    fallbackVariants.slice(0, 1).map((variant) => cachedSearch(variant, filters, cache)),
  );
  for (const result of settledSearches) {
    if (result.status !== "fulfilled") continue;
    const hits = result.value;
    for (const hit of hits) {
      allHits.set(hit.id, hit);
    }
  }

  return bestMatchForQuery(query, Array.from(allHits.values()));
}

export function StagingArea({
  items,
  setItems,
  onApproveAll,
  onCancel,
  searchFilters = SONGS_ONLY_FILTERS,
  parashaContext = null,
  mobileLayout = false,
}: {
  items: StagingItem[];
  setItems: React.Dispatch<React.SetStateAction<StagingItem[]>>;
  onApproveAll: (songs: MsHit[]) => void;
  onCancel: () => void;
  searchFilters?: SearchFilterOptions;
  parashaContext?: ParashaValidationContext | null;
  mobileLayout?: boolean;
}) {
  const processBatch = async (pendingItems: StagingItem[]) => {
    if (!pendingItems.length) return;
    const searchCache = new Map<string, Promise<MsHit[]>>();

    for (let i = 0; i < pendingItems.length; i += STAGING_BATCH_SIZE) {
      const batch = pendingItems.slice(i, i + STAGING_BATCH_SIZE);

      const promises = batch.map(async (item) => {
        const query = sanitizePlaylistLine(item.query);
        const searchLine = buildStagingSearchQuery(query, item.pshRow);

        if (!searchLine) {
          return {
            id: item.id,
            hit: null,
            confidence: 0,
            blocked: false,
            artistOnly: true,
          };
        }

        setItems((prev) =>
          prev.map((p) =>
            p.id === item.id ? { ...p, status: "searching" as const } : p,
          ),
        );
        try {
          const best = await findBestMatch(
            searchLine,
            searchFilters,
            searchCache,
          );
          const validation = validateStagingMatch({
            query,
            hit: best.hit,
            confidence: best.confidence,
            pshRow: item.pshRow,
            parashaContext,
          });
          if (validation.issue) {
            const hardBlock = validation.issue.severity === "block";
            if (hardBlock) {
              return {
                id: item.id,
                hit: null,
                confidence: 0,
                blocked: true,
                blockReason: validation.issue.message,
              };
            }
            const reviewHit = validation.canonicalHit ?? best.hit;
            return {
              id: item.id,
              hit: reviewHit,
              confidence: best.confidence,
              blocked: false,
              pendingApproval: true,
              reviewReason: validation.issue.message,
            };
          }
          return {
            id: item.id,
            hit: validation.canonicalHit,
            confidence: best.confidence,
            blocked: false,
          };
        } catch {
          return { id: item.id, hit: null, confidence: 0, blocked: false };
        }
      });

      const results = await Promise.all(promises);

      setItems((prev) =>
        prev.map((p) => {
          const res = results.find((r) => r.id === p.id);
          if (!res) return p;
          if ("artistOnly" in res && res.artistOnly) {
            return {
              ...p,
              status: "skipped" as const,
              skipReason: "שורת אמן בלבד — לא נכלל בחיפוש",
              match: undefined,
              confidence: 0,
            };
          }
          if ("blocked" in res && res.blocked) {
            return {
              ...p,
              status: "blocked" as const,
              blockReason: res.blockReason,
              match: undefined,
              confidence: 0,
            };
          }
          if (!res.hit)
            return { ...p, status: "not-found" as const, confidence: 0 };

          const conf = res.confidence ?? 0;
          const hit = res.hit as MsHit | null | undefined;
          const pendingApproval =
            "pendingApproval" in res && Boolean(res.pendingApproval);
          const reviewReason =
            "reviewReason" in res && typeof res.reviewReason === "string"
              ? res.reviewReason
              : undefined;

          if (pendingApproval && hit) {
            return {
              ...p,
              status: "review" as const,
              match: hit,
              confidence: conf,
              blockReason: reviewReason,
            };
          }

          if (conf >= AUTO_MATCH_THRESHOLD) {
            return {
              ...p,
              status: "matched" as const,
              match: hit ?? undefined,
              confidence: conf,
            };
          }
          if (conf >= REVIEW_THRESHOLD) {
            return {
              ...p,
              status: "review" as const,
              match: hit ?? undefined,
              confidence: conf,
            };
          }
          return {
            ...p,
            status: "not-found" as const,
            confidence: conf,
          };
        }),
      );
    }
  };

  useEffect(() => {
    const pending = items.filter((i) => i.status === "pending");
    const isIdle = !items.some((i) => i.status === "searching");
    if (pending.length > 0 && isIdle) {
      void processBatch(pending);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parent uses key to reset batches; mount handles each batch
  }, []);

  const handleSkip = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: "skipped" as const } : i)),
    );
  };

  const handleApproveReview = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: "matched" as const } : i)),
    );
  };

  const isProcessing = items.some((i) => i.status === "searching");
  const matchedSongs = items
    .filter((i) => i.status === "matched" && i.match)
    .map((i) => i.match!);
  const reviewCount = items.filter((i) => i.status === "review").length;
  const blockedCount = items.filter((i) => i.status === "blocked").length;
  const skippedCount = items.filter((i) => i.status === "skipped").length;
  const totalCount = items.length;

  const itemTone = (status: StagingItem["status"]) => {
    switch (status) {
      case "matched":
        return "bp-staging-item--matched";
      case "review":
        return "bp-staging-item--review";
      case "blocked":
      case "not-found":
        return "bp-staging-item--not-found";
      case "skipped":
        return "bp-staging-item--skipped";
      default:
        return "";
    }
  };

  return (
    <section
      className={cn(
        "bp-staging",
        mobileLayout ? "bp-staging--focus" : "bp-staging--embedded",
      )}
      aria-label="אזור התאמה"
    >
      <header className="bp-staging__header">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="bp-chip bg-primary/12 text-primary border border-primary/20">
            אזור התאמה
          </span>
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {matchedSongs.length}/{totalCount}
            {reviewCount > 0 ? (
              <span className="text-amber-600 mr-1"> · {reviewCount} לאישור</span>
            ) : null}
            {blockedCount > 0 ? (
              <span className="text-destructive mr-1"> · {blockedCount} חסום</span>
            ) : null}
            {skippedCount > 0 ? (
              <span className="mr-1"> · {skippedCount} דולג</span>
            ) : null}
          </span>
        </div>
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" aria-hidden />
        ) : null}
      </header>

      <ul className="bp-staging__scroll custom-scrollbar list-none m-0 p-0">
          {items.map((item) => (
            <li key={item.id} className={cn("bp-staging-item", itemTone(item.status))}>
              <div className="min-w-0 w-full space-y-1">
                <p
                  className="text-xs font-semibold leading-snug line-clamp-2 break-words text-foreground"
                  title={item.query}
                  dir="rtl"
                >
                  {formatStagingDisplayLabel(item.query)}
                </p>
                {item.match && (
                  <p
                    className="text-[11px] text-muted-foreground line-clamp-1 break-words"
                    dir="rtl"
                    title={`${item.match.artist} · ${item.match.song_name}`}
                  >
                    {item.match.artist} · {item.match.song_name}
                  </p>
                )}
                {item.skipReason && item.status === "skipped" && (
                  <p className="text-[10px] text-muted-foreground line-clamp-2">
                    {item.skipReason}
                  </p>
                )}
                {item.blockReason && item.status !== "blocked" && (
                  <p className="text-[10px] text-amber-700 line-clamp-2">
                    {item.blockReason}
                  </p>
                )}
                {item.blockReason && item.status === "blocked" && (
                  <p className="text-[10px] text-destructive line-clamp-2">
                    {item.blockReason}
                  </p>
                )}
              </div>
              <div className="bp-staging-item__actions">
                {item.status === "pending" && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> ממתין
                  </span>
                )}
                {item.status === "searching" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                )}
                {item.status === "blocked" && (
                  <span className="flex items-center gap-1 text-[10px] text-destructive bg-destructive/10 border border-destructive/25 px-2 py-1 rounded-lg shrink-0">
                    <ShieldAlert className="h-3 w-3" /> חסום
                  </span>
                )}
                {item.status === "not-found" && (
                  <span className="flex items-center gap-1 text-xs text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded-lg">
                    <SearchX className="h-3 w-3" /> לא נמצא
                  </span>
                )}
                {item.status === "skipped" && (
                  <span
                    className="text-[10px] text-muted-foreground bg-muted/30 border border-border px-2 py-0.5 rounded-lg shrink-0"
                    title={item.skipReason}
                  >
                    {item.skipReason?.includes("אמן") ? "אמן בלבד" : "דולג"}
                  </span>
                )}
                {item.status === "review" && item.match && (
                  <>
                    <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-lg shrink-0">
                      <AlertTriangle className="h-3 w-3" /> ממתין לאישור
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      className="min-h-[var(--bp-touch-min)] rounded-xl px-4 font-semibold"
                      onClick={() => handleApproveReview(item.id)}
                    >
                      אשר
                    </Button>
                    <button
                      type="button"
                      className="bp-icon-btn"
                      aria-label="דלג"
                      onClick={() => handleSkip(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                )}
                {item.status === "matched" && item.match && (
                  <>
                    <span className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-lg shrink-0">
                      <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                      הותאם
                    </span>
                    <button
                      type="button"
                      className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleSkip(item.id)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
      </ul>

      <footer className="bp-staging__dock">
        <Button
          variant="outline"
          size="lg"
          onClick={onCancel}
          className="flex-1 min-h-[var(--bp-touch-min)] rounded-xl font-semibold"
        >
          ביטול
        </Button>
        <Button
          data-testid="approve-all-button"
          size="lg"
          disabled={isProcessing || !matchedSongs.length}
          onClick={() => onApproveAll(matchedSongs)}
          className="flex-[2] min-h-[var(--bp-touch-min)] rounded-xl font-semibold shadow-md shadow-primary/20"
        >
          אשר הכל ({matchedSongs.length})
        </Button>
      </footer>
    </section>
  );
}
