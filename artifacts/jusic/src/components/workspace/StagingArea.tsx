import { useEffect } from "react";
import { MsHit, meilisearchSearch } from "../../lib/meilisearch";
import type { SearchFilterOptions } from "../../lib/search-filters";
import { SONGS_ONLY_FILTERS } from "../../lib/search-filters";
import { Button } from "../ui/button";
import {
  Loader2,
  X,
  CheckCircle2,
  SearchX,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
    | "skipped";
  match?: MsHit;
  confidence?: number;
}

const AUTO_MATCH_THRESHOLD = 0.68;
const REVIEW_THRESHOLD = 0.38;
const RANKING_BOOST = 0.1;
const STAGING_SEARCH_LIMIT = 20;

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

function uniqueSearchVariants(query: string): string[] {
  const parsed = splitArtistSong(query);
  const variants = [
    parsed.whole,
    parsed.right,
    parsed.left && parsed.right ? `${parsed.left} ${parsed.right}` : "",
    parsed.left && parsed.right ? `${parsed.right} ${parsed.left}` : "",
  ];

  const seen = new Set<string>();
  return variants
    .map((v) => v.trim())
    .filter((v) => {
      if (v.length < 2) return false;
      const key = normalizeHebrew(v);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
  const [primaryVariant, ...fallbackVariants] = uniqueSearchVariants(query);
  if (!primaryVariant) return { hit: null, confidence: 0 };

  const primaryHits = await cachedSearch(primaryVariant, filters, cache);
  for (const hit of primaryHits) {
    allHits.set(hit.id, hit);
  }

  const primaryBest = bestMatchForQuery(query, Array.from(allHits.values()));
  if (primaryBest.confidence >= AUTO_MATCH_THRESHOLD) {
    return primaryBest;
  }

  const settledSearches = await Promise.allSettled(
    fallbackVariants.map((variant) => cachedSearch(variant, filters, cache)),
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
}: {
  items: StagingItem[];
  setItems: React.Dispatch<React.SetStateAction<StagingItem[]>>;
  onApproveAll: (songs: MsHit[]) => void;
  onCancel: () => void;
  /** Same filters as header search — default songs-only applies to text import & AI matching */
  searchFilters?: SearchFilterOptions;
}) {
  const processBatch = async (pendingItems: StagingItem[]) => {
    if (!pendingItems.length) return;
    const searchCache = new Map<string, Promise<MsHit[]>>();

    for (let i = 0; i < pendingItems.length; i += 5) {
      const batch = pendingItems.slice(i, i + 5);

      const promises = batch.map(async (item) => {
        setItems((prev) =>
          prev.map((p) =>
            p.id === item.id ? { ...p, status: "searching" as const } : p,
          ),
        );
        try {
          const best = await findBestMatch(
            item.query,
            searchFilters,
            searchCache,
          );
          return { id: item.id, hit: best.hit, confidence: best.confidence };
        } catch {
          return { id: item.id, hit: null, confidence: 0 };
        }
      });

      const results = await Promise.all(promises);

      setItems((prev) =>
        prev.map((p) => {
          const res = results.find((r) => r.id === p.id);
          if (!res) return p;
          if (!res.hit)
            return { ...p, status: "not-found" as const, confidence: 0 };

          const conf = res.confidence ?? 0;
          if (conf >= AUTO_MATCH_THRESHOLD) {
            return {
              ...p,
              status: "matched" as const,
              match: res.hit,
              confidence: conf,
            };
          }
          if (conf >= REVIEW_THRESHOLD) {
            return {
              ...p,
              status: "review" as const,
              match: res.hit,
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
  const totalCount = items.length;

  return (
    <div className="flex flex-col gap-4 mt-5 p-4 sm:p-5 rounded-[1.15rem] border border-primary/14 bg-gradient-to-b from-muted/40 to-transparent backdrop-blur-sm shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)]">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h3 className="font-display font-bold text-sm flex flex-wrap items-center gap-x-2 gap-y-1 tracking-tight">
          <span className="rounded-lg bg-primary/12 text-primary px-2 py-1 text-[11px] font-semibold border border-primary/20">
            אזור התאמה
          </span>
          <span className="text-muted-foreground text-xs font-medium tabular-nums">
            {matchedSongs.length}/{totalCount}
            {reviewCount > 0 && (
              <span className="text-amber-500 mr-1 font-semibold">
                {" "}
                · {reviewCount} לבדיקה
              </span>
            )}
          </span>
        </h3>
        {isProcessing && (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        )}
      </div>

      <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto custom-scrollbar">
        <AnimatePresence initial={false}>
          {items.map((item, idx) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: idx * 0.02, duration: 0.15 }}
              className={`flex items-center justify-between p-2.5 rounded-xl text-sm border transition-colors ${
                item.status === "matched"
                  ? "bg-primary/5 border-primary/20"
                  : item.status === "review"
                    ? "bg-yellow-500/5 border-yellow-500/20"
                    : item.status === "not-found"
                      ? "bg-destructive/5 border-destructive/15"
                      : item.status === "skipped"
                        ? "bg-muted/20 border-transparent opacity-40"
                        : "bg-background/30 border-border/40"
              }`}
            >
              <span
                className="truncate flex-1 text-xs font-medium"
                title={item.query}
              >
                {item.query}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0 mr-2">
                {item.status === "pending" && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> ממתין
                  </span>
                )}
                {item.status === "searching" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                )}
                {item.status === "not-found" && (
                  <span className="flex items-center gap-1 text-xs text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded-lg">
                    <SearchX className="h-3 w-3" /> לא נמצא
                  </span>
                )}
                {item.status === "skipped" && (
                  <span className="text-xs text-muted-foreground bg-muted/30 border border-border px-2 py-0.5 rounded-lg">
                    דולג
                  </span>
                )}
                {item.status === "review" && item.match && (
                  <>
                    <span
                      className="flex items-center gap-1 text-xs text-yellow-400 truncate max-w-[100px]"
                      title={`${item.match.song_name} - ${item.match.artist}`}
                    >
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                      {item.match.song_name}
                    </span>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="text-[10px] text-yellow-400 border border-yellow-500/30 bg-yellow-500/10 px-1.5 py-0.5 rounded-md hover:bg-yellow-500/20 transition-colors"
                      onClick={() => handleApproveReview(item.id)}
                    >
                      אשר
                    </motion.button>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={() => handleSkip(item.id)}
                    >
                      <X className="h-3 w-3" />
                    </motion.button>
                  </>
                )}
                {item.status === "matched" && item.match && (
                  <>
                    <span
                      className="flex items-center gap-1 text-xs text-primary truncate max-w-[110px]"
                      title={`${item.match.song_name} - ${item.match.artist}`}
                    >
                      <CheckCircle2 className="h-3 w-3 flex-shrink-0" />
                      {item.match.song_name}
                    </span>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={() => handleSkip(item.id)}
                    >
                      <X className="h-3 w-3" />
                    </motion.button>
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex gap-2 justify-end mt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="rounded-xl text-xs"
        >
          ביטול
        </Button>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            data-testid="approve-all-button"
            size="sm"
            disabled={isProcessing || !matchedSongs.length}
            onClick={() => onApproveAll(matchedSongs)}
            className="rounded-xl shadow-sm"
          >
            אשר הכל ({matchedSongs.length})
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
