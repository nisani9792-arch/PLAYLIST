import { useEffect } from 'react';
import { MsHit, meilisearchSearch } from '../../lib/meilisearch';
import type { SearchFilterOptions } from '../../lib/search-filters';
import { DEFAULT_SEARCH_FILTERS } from '../../lib/search-filters';
import { Button } from '../ui/button';
import { Loader2, X, CheckCircle2, SearchX, Clock, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import React from 'react';

export interface StagingItem {
  id: string;
  query: string;
  status: 'pending' | 'searching' | 'matched' | 'review' | 'not-found' | 'skipped';
  match?: MsHit;
  confidence?: number;
}

// Lowered from 0.28 → 0.15 so Hebrew partial-word matches pass auto-approve.
// The "review" state still lets the user approve or skip borderline results.
const CONFIDENCE_THRESHOLD = 0.15;
const RANKING_BOOST = 0.12;

function calcSimilarity(query: string, hit: MsHit): number {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\u0590-\u05FF\u200c-\u200fa-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const queryNorm = norm(query);
  const hitNorm = norm(`${hit.song_name} ${hit.artist}`);

  const qWords = queryNorm.split(' ').filter(Boolean);
  const hWords = hitNorm.split(' ').filter(Boolean);
  const hSet = new Set(hWords);

  if (!qWords.length || !hWords.length) return 0;

  let score = 0;
  for (const w of qWords) {
    if (w.length < 2) continue;
    if (hSet.has(w)) {
      score += 1;
    } else {
      for (const hw of hWords) {
        if (hw.length >= 2 && (hw.includes(w) || w.includes(hw))) {
          score += 0.5;
          break;
        }
      }
    }
  }

  let conf = score / Math.max(qWords.length, 1);
  if (typeof hit._rankingScore === 'number' && hit._rankingScore > 0.75) {
    conf = Math.min(1, conf + RANKING_BOOST);
  }
  return conf;
}

export function StagingArea({
  items,
  setItems,
  onApproveAll,
  onCancel,
  searchFilters = DEFAULT_SEARCH_FILTERS,
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

    for (let i = 0; i < pendingItems.length; i += 5) {
      const batch = pendingItems.slice(i, i + 5);

      const promises = batch.map(async (item) => {
        setItems((prev) =>
          prev.map((p) =>
            p.id === item.id ? { ...p, status: 'searching' as const } : p,
          ),
        );
        try {
          // Use limit=5 to maximise the chance of getting a strong match,
          // and drop songsOnly temporarily so partial-title queries that span
          // types still surface candidates (confidence filter cleans noise).
          const relaxedFilters = { ...searchFilters, songsOnly: false };
          const hits = await meilisearchSearch(item.query, 5, relaxedFilters);
          return { id: item.id, hit: hits[0] ?? null };
        } catch {
          return { id: item.id, hit: null };
        }
      });

      const results = await Promise.all(promises);

      setItems((prev) =>
        prev.map((p) => {
          const res = results.find((r) => r.id === p.id);
          if (!res) return p;
          if (!res.hit) return { ...p, status: 'not-found' as const, confidence: 0 };

          const conf = calcSimilarity(p.query, res.hit);
          if (conf >= CONFIDENCE_THRESHOLD) {
            return {
              ...p,
              status: 'matched' as const,
              match: res.hit,
              confidence: conf,
            };
          }
          return {
            ...p,
            status: 'review' as const,
            match: res.hit,
            confidence: conf,
          };
        }),
      );
    }
  };

  useEffect(() => {
    const pending = items.filter((i) => i.status === 'pending');
    const isIdle = !items.some((i) => i.status === 'searching');
    if (pending.length > 0 && isIdle) {
      void processBatch(pending);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parent uses key to reset batches; mount handles each batch
  }, []);

  const handleSkip = (id: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, status: 'skipped' as const } : i,
      ),
    );
  };

  const handleApproveReview = (id: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, status: 'matched' as const } : i,
      ),
    );
  };

  const isProcessing = items.some((i) => i.status === 'searching');
  const matchedSongs = items
    .filter((i) => i.status === 'matched' && i.match)
    .map((i) => i.match!);
  const reviewCount = items.filter((i) => i.status === 'review').length;
  const totalCount = items.length;

  return (
    <div className="flex flex-col gap-3 mt-4 bg-card/40 p-4 rounded-2xl border border-border/60 backdrop-blur-sm">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          אזור התאמה
          <span className="text-xs text-muted-foreground font-normal">
            ({matchedSongs.length}/{totalCount}
            {reviewCount > 0 && (
              <span className="text-yellow-400 mr-1"> · {reviewCount} לבדיקה</span>
            )}
            )
          </span>
        </h3>
        {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
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
                item.status === 'matched'
                  ? 'bg-primary/5 border-primary/20'
                  : item.status === 'review'
                    ? 'bg-yellow-500/5 border-yellow-500/20'
                    : item.status === 'not-found'
                      ? 'bg-destructive/5 border-destructive/15'
                      : item.status === 'skipped'
                        ? 'bg-muted/20 border-transparent opacity-40'
                        : 'bg-background/30 border-border/40'
              }`}
            >
              <span className="truncate flex-1 text-xs font-medium" title={item.query}>
                {item.query}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0 mr-2">
                {item.status === 'pending' && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> ממתין
                  </span>
                )}
                {item.status === 'searching' && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                )}
                {item.status === 'not-found' && (
                  <span className="flex items-center gap-1 text-xs text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded-lg">
                    <SearchX className="h-3 w-3" /> לא נמצא
                  </span>
                )}
                {item.status === 'skipped' && (
                  <span className="text-xs text-muted-foreground bg-muted/30 border border-border px-2 py-0.5 rounded-lg">
                    דולג
                  </span>
                )}
                {item.status === 'review' && item.match && (
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
                {item.status === 'matched' && item.match && (
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
        <Button variant="ghost" size="sm" onClick={onCancel} className="rounded-xl text-xs">
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
