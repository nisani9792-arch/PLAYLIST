import { useEffect, useMemo, useState } from "react";
import {
  expandTopicFacets,
  parseVibeFromPrompt,
  scoreHitForTopic,
  TOPIC_STAGING_MIN_SCORE,
} from "@workspace/curator";
import {
  AUTO_MATCH_THRESHOLD,
  REVIEW_THRESHOLD,
  buildStagingSearchQuery,
  formatStagingDisplayLabel,
  normalizeHebrew,
  queryMatchesHit,
  sanitizePlaylistLine,
  scoreStagingQueryHit,
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
import { postStagingEvents } from "@/lib/memory-api";

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
  /** Top Meilisearch candidates when auto-match failed (pick manually). */
  alternatives?: MsHit[];
  pshRow?: PshSongRow;
  blockReason?: string;
  skipReason?: string;
}
const STAGING_SEARCH_LIMIT = 20;
const STAGING_BATCH_SIZE = 10;

function rankHitsForQuery(
  query: string,
  hits: MsHit[],
  topicContext?: string | null,
): Array<{ hit: MsHit; confidence: number }> {
  const vibe = topicContext ? parseVibeFromPrompt(topicContext) : undefined;
  const facets = topicContext ? expandTopicFacets(topicContext, vibe) : undefined;

  return hits
    .map((hit) => {
      const lineConf = scoreStagingQueryHit(query, hit);
      if (!topicContext) {
        return { hit, confidence: lineConf };
      }
      const topicConf = scoreHitForTopic(hit, {
        topic: topicContext,
        vibe,
        facets,
      });
      return { hit, confidence: Math.min(1, lineConf * 0.55 + topicConf * 0.45) };
    })
    .sort((a, b) => b.confidence - a.confidence);
}

function bestMatchForQuery(
  query: string,
  hits: MsHit[],
  topicContext?: string | null,
): { hit: MsHit | null; confidence: number; alternatives: MsHit[] } {
  const ranked = rankHitsForQuery(query, hits, topicContext);
  const best = ranked[0];
  const alternatives = ranked
    .slice(0, 8)
    .filter((r) => r.confidence >= 0.22)
    .map((r) => r.hit);
  return {
    hit: best?.hit ?? null,
    confidence: best?.confidence ?? 0,
    alternatives,
  };
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
  topicContext?: string | null,
): Promise<{ hit: MsHit | null; confidence: number; alternatives: MsHit[] }> {
  const allHits = new Map<string, MsHit>();
  const [primaryVariant, ...fallbackVariants] = stagingSearchVariants(query);
  if (!primaryVariant) return { hit: null, confidence: 0, alternatives: [] };

  const primaryHits = await cachedSearch(primaryVariant, filters, cache);
  for (const hit of primaryHits) {
    allHits.set(hit.id, hit);
  }

  const primaryBest = bestMatchForQuery(
    query,
    Array.from(allHits.values()),
    topicContext,
  );
  if (
    primaryBest.confidence >= AUTO_MATCH_THRESHOLD ||
    fallbackVariants.length === 0
  ) {
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

  return bestMatchForQuery(query, Array.from(allHits.values()), topicContext);
}

function passesTopicContext(
  hit: MsHit,
  topicContext: string | null | undefined,
): boolean {
  if (!topicContext?.trim()) return true;
  const vibe = parseVibeFromPrompt(topicContext);
  const facets = expandTopicFacets(topicContext, vibe);
  return scoreHitForTopic(hit, { topic: topicContext, vibe, facets }) >= TOPIC_STAGING_MIN_SCORE;
}

function stagingEventFromItem(
  item: StagingItem,
  parasha?: string | null,
): {
  query: string;
  chosenUid?: string;
  rejectedUids?: string[];
  parasha?: string;
  confidence?: number;
} | null {
  if (item.status !== "matched" || !item.match?.id) return null;
  const rejected =
    item.alternatives
      ?.filter((alt) => alt.id !== item.match?.id)
      .map((alt) => alt.id)
      .slice(0, 12) ?? [];
  return {
    query: item.query,
    chosenUid: item.match.id,
    rejectedUids: rejected.length ? rejected : undefined,
    parasha: parasha ?? undefined,
    confidence: item.confidence,
  };
}

function flushStagingMemory(
  items: StagingItem[],
  parasha?: string | null,
): void {
  const events = items
    .map((item) => stagingEventFromItem(item, parasha))
    .filter((e): e is NonNullable<typeof e> => e !== null);
  if (events.length) void postStagingEvents(events);
}

function AlternativesPicker({
  alternatives,
  onPick,
}: {
  alternatives: MsHit[];
  onPick: (hit: MsHit) => void;
}) {
  return (
    <div className="flex flex-col gap-1 pt-1">
      <span className="text-[10px] text-muted-foreground">
        הצעות מהמאגר — לחץ לבחירה:
      </span>
      {alternatives.slice(0, 6).map((alt) => (
        <Button
          key={alt.id}
          type="button"
          variant="outline"
          size="sm"
          className="h-auto min-h-8 py-1 px-2 text-[10px] justify-start font-normal whitespace-normal text-right w-full"
          onClick={() => onPick(alt)}
        >
          {alt.artist} · {alt.song_name}
        </Button>
      ))}
    </div>
  );
}

const StagingListItem = React.memo(function StagingListItem({
  item,
  itemTone,
  onSkip,
  onApproveReview,
  onPickAlternative,
}: {
  item: StagingItem;
  itemTone: string;
  onSkip: (id: string) => void;
  onApproveReview: (id: string) => void;
  onPickAlternative: (id: string, hit: MsHit) => void;
}) {
  return (
    <li className={cn("bp-staging-item", itemTone)}>
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
          <p className="text-[10px] text-amber-700 line-clamp-2">{item.blockReason}</p>
        )}
        {item.blockReason && item.status === "blocked" && (
          <p className="text-[10px] text-destructive line-clamp-2">{item.blockReason}</p>
        )}
        {(item.status === "not-found" || item.status === "review") &&
          (item.alternatives?.length ?? 0) > 0 && (
            <AlternativesPicker
              alternatives={item.alternatives!}
              onPick={(hit) => onPickAlternative(item.id, hit)}
            />
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
          <span className="flex items-center gap-1 text-xs text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded-lg shrink-0">
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
              className="h-8 md:h-7 rounded-lg px-3 text-xs font-semibold"
              onClick={() => onApproveReview(item.id)}
            >
              אשר
            </Button>
            <button
              type="button"
              className="bp-icon-btn"
              aria-label="דלג"
              onClick={() => onSkip(item.id)}
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
              onClick={() => onSkip(item.id)}
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </li>
  );
});

export function StagingArea({
  items,
  setItems,
  onApproveAll,
  onCancel,
  searchFilters = SONGS_ONLY_FILTERS,
  parashaContext = null,
  topicContext = null,
  mobileLayout = false,
}: {
  items: StagingItem[];
  setItems: React.Dispatch<React.SetStateAction<StagingItem[]>>;
  onApproveAll: (songs: MsHit[]) => void;
  onCancel: () => void;
  searchFilters?: SearchFilterOptions;
  parashaContext?: ParashaValidationContext | null;
  /** Playlist topic — match by tags/vibe, not literal title tokens. */
  topicContext?: string | null;
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
            topicContext,
          );
          const validation = validateStagingMatch({
            query,
            hit: best.hit,
            confidence: best.confidence,
            pshRow: item.pshRow,
            parashaContext,
          });
          const canonicalHit = validation.canonicalHit ?? best.hit;
          const autoApprove =
            Boolean(canonicalHit) &&
            ((canonicalHit && queryMatchesHit(query, canonicalHit)) ||
              (Boolean(parashaContext && item.pshRow) &&
                best.confidence < REVIEW_THRESHOLD));

          if (validation.issue) {
            const hardBlock = validation.issue.severity === "block";
            if (hardBlock) {
              return {
                id: item.id,
                hit: null,
                confidence: 0,
                blocked: true,
                blockReason: validation.issue.message,
                alternatives: best.alternatives,
              };
            }
            if (autoApprove && canonicalHit) {
              return {
                id: item.id,
                hit: canonicalHit,
                confidence: Math.max(best.confidence, AUTO_MATCH_THRESHOLD),
                blocked: false,
                alternatives: best.alternatives,
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
              alternatives: best.alternatives,
            };
          }
          return {
            id: item.id,
            hit: validation.canonicalHit,
            confidence: best.confidence,
            blocked: false,
            alternatives: best.alternatives,
            autoApprove,
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
          const alternatives =
            "alternatives" in res && Array.isArray(res.alternatives)
              ? res.alternatives
              : undefined;

          if (!res.hit) {
            return {
              ...p,
              status: "not-found" as const,
              confidence: 0,
              alternatives,
              match: undefined,
            };
          }

          const conf = res.confidence ?? 0;
          const hit = res.hit as MsHit | null | undefined;
          const autoApprove =
            "autoApprove" in res && Boolean(res.autoApprove);
          let pendingApproval =
            "pendingApproval" in res && Boolean(res.pendingApproval);
          const reviewReason =
            "reviewReason" in res && typeof res.reviewReason === "string"
              ? res.reviewReason
              : undefined;

          if (hit && (autoApprove || queryMatchesHit(p.query, hit))) {
            pendingApproval = false;
          }
          if (
            hit &&
            topicContext &&
            !queryMatchesHit(p.query, hit) &&
            !passesTopicContext(hit, topicContext)
          ) {
            pendingApproval = true;
          }

          if (pendingApproval && hit) {
            return {
              ...p,
              status: "review" as const,
              match: hit,
              confidence: conf,
              blockReason: reviewReason,
              alternatives,
            };
          }

          const exactLine = Boolean(hit && queryMatchesHit(p.query, hit));
          const topicFit = Boolean(hit && passesTopicContext(hit, topicContext));
          const canAutoMatch =
            Boolean(hit) &&
            (exactLine || !topicContext || topicFit) &&
            (conf >= AUTO_MATCH_THRESHOLD || autoApprove);

          if (canAutoMatch && !pendingApproval) {
            return {
              ...p,
              status: "matched" as const,
              match: hit ?? undefined,
              confidence: conf,
              alternatives,
            };
          }
          if (conf >= REVIEW_THRESHOLD) {
            return {
              ...p,
              status: "review" as const,
              match: hit ?? undefined,
              confidence: conf,
              alternatives,
            };
          }
          return {
            ...p,
            status: "not-found" as const,
            confidence: conf,
            match: undefined,
            alternatives,
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

  const parashaName = parashaContext?.targetParasha ?? null;

  const handleApproveReview = (id: string) => {
    setItems((prev) => {
      const next = prev.map((i) =>
        i.id === id ? { ...i, status: "matched" as const } : i,
      );
      const item = next.find((i) => i.id === id);
      const ev = item ? stagingEventFromItem(item, parashaName) : null;
      if (ev) void postStagingEvents([ev]);
      return next;
    });
  };

  const handlePickAlternative = (id: string, hit: MsHit) => {
    setItems((prev) => {
      const next = prev.map((i) =>
        i.id === id
          ? {
              ...i,
              status: "matched" as const,
              match: hit,
              confidence: 1,
              alternatives: undefined,
              blockReason: undefined,
            }
          : i,
      );
      const item = next.find((i) => i.id === id);
      const ev = item ? stagingEventFromItem(item, parashaName) : null;
      if (ev) void postStagingEvents([ev]);
      return next;
    });
  };

  type StatusFilter = "all" | "review" | "not-found" | "blocked";
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const isProcessing = items.some((i) => i.status === "searching");
  const matchedSongs = items
    .filter((i) => i.status === "matched" && i.match)
    .map((i) => i.match!);
  const reviewCount = items.filter((i) => i.status === "review").length;
  const blockedCount = items.filter((i) => i.status === "blocked").length;
  const skippedCount = items.filter((i) => i.status === "skipped").length;
  const totalCount = items.length;

  const visibleItems = useMemo(() => {
    if (statusFilter === "all") return items;
    if (statusFilter === "review") return items.filter((i) => i.status === "review");
    if (statusFilter === "not-found")
      return items.filter((i) => i.status === "not-found");
    return items.filter((i) => i.status === "blocked");
  }, [items, statusFilter]);

  const handleApproveAllExact = () => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.status !== "review" || !item.match) return item;
        if (!queryMatchesHit(item.query, item.match)) return item;
        return { ...item, status: "matched" as const };
      }),
    );
  };

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
          {topicContext ? (
            <span
              className="bp-chip bg-muted/80 text-muted-foreground border border-border/60 max-w-[14rem] truncate"
              title={topicContext}
            >
              נושא: {topicContext}
            </span>
          ) : null}
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
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["all", "הכל"],
                ["review", "לאישור"],
                ["not-found", "לא נמצא"],
                ["blocked", "חסום"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={statusFilter === id ? "default" : "outline"}
                className="h-7 text-[10px] rounded-lg px-2"
                onClick={() => setStatusFilter(id)}
              >
                {label}
              </Button>
            ))}
            {reviewCount > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 text-[10px] rounded-lg"
                onClick={handleApproveAllExact}
              >
                אשר מדויקים
              </Button>
            ) : null}
          </div>
        </div>
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" aria-hidden />
        ) : null}
      </header>

      <ul className="bp-staging__scroll custom-scrollbar list-none m-0 p-0">
        {visibleItems.map((item) => (
          <StagingListItem
            key={item.id}
            item={item}
            itemTone={itemTone(item.status)}
            onSkip={handleSkip}
            onApproveReview={handleApproveReview}
            onPickAlternative={handlePickAlternative}
          />
        ))}
      </ul>

      <footer className="bp-staging__dock">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="flex-1 h-9 md:h-8 rounded-lg text-sm font-semibold"
        >
          ביטול
        </Button>
        <Button
          data-testid="approve-all-button"
          size="sm"
          disabled={isProcessing || !matchedSongs.length}
          onClick={() => {
            flushStagingMemory(items, parashaName);
            onApproveAll(matchedSongs);
          }}
          className="flex-[2] h-9 md:h-8 rounded-lg text-sm font-semibold shadow-sm shadow-primary/15"
        >
          אשר הכל ({matchedSongs.length})
        </Button>
      </footer>
    </section>
  );
}
