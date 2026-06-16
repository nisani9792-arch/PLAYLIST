import { useEffect, useMemo, useState } from 'react';
import { dedupePlaylistLines, sanitizePlaylistLine } from '@workspace/playlist-validation';
import { APP_SHORT_NAME } from '@/lib/brand';
import { useIsMobile } from '@/hooks/use-mobile';
import { setActiveParashaExportContext } from '@/lib/parasha-export-context';
import type { StagingParashaContext } from '@/lib/staging-context';
import {
  buildCuratorPlaylist,
  refineCuratorPlaylist,
  useCuratorStream,
  type RefinementTurn,
} from '@/hooks/use-curator-build';
import { PlaylistProgressRing } from '@/components/ui/playlist-progress-ring';
import { VibeBadge } from '@/components/ui/vibe-badge';
import { Sparkles, Loader2, History, BookmarkPlus, PanelRightClose, PanelRightOpen, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { StagingArea, type StagingItem } from './StagingArea';
import { ComposerEntryCards } from './ComposerEntryCards';
import { useSearchFilters } from '@/contexts/SearchFiltersContext';
import { createStagingItem, useStagingSession } from '@/contexts/StagingSessionContext';
import type { MsHit } from '../../lib/meilisearch';
import { newClientId } from '../../lib/ids';
import type { PlaylistDraftSnapshot } from '../../lib/playlist-draft';
import { promptLooksLikeParasha, resolveParashaFromPdf } from '../../lib/parasha';
import {
  formatParashaPlaylistName,
  inferPlaylistDisplayName,
} from '../../lib/playlist-name';
import { cn } from '@/lib/utils';
import { fetchSuggestions } from '@/lib/memory-api';

function formatDraftTime(ts: number): string {
  try {
    return new Intl.DateTimeFormat('he-IL', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(ts));
  } catch {
    return '';
  }
}

export function ASIComposerPanel({
  onAddSongs,
  onApplyAutoPlaylistName,
  draftHistory,
  onRememberDraft,
  onLoadDraft,
  onDeleteDraft,
  mobileFullScreen = false,
  mobileVisible = true,
  hideStaging = false,
  onMatchStepRequest,
  variant = 'default',
  className,
}: {
  onAddSongs: (songs: MsHit[]) => void;
  onApplyAutoPlaylistName?: (label: string | null) => void;
  draftHistory: PlaylistDraftSnapshot[];
  onRememberDraft: () => void;
  onLoadDraft: (draftId: string) => void;
  onDeleteDraft: (draftId: string) => void;
  mobileFullScreen?: boolean;
  mobileVisible?: boolean;
  hideStaging?: boolean;
  onMatchStepRequest?: () => void;
  /** Edge-to-edge studio column — no glass shell or collapse rail. */
  variant?: 'default' | 'studio';
  className?: string;
}) {
  const { filters } = useSearchFilters();
  const isMobile = useIsMobile();
  const useMobileTabs = mobileFullScreen && isMobile;
  const {
    stagingItems,
    setStagingItems,
    stagingBatchId,
    startStaging,
    clearStaging,
    parashaContext,
    setParashaContext,
    stagingActive,
    stagingBuildLabel,
    stagingTopic,
  } = useStagingSession();
  const [isOpen, setIsOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
  );
  const [composerInput, setComposerInput] = useState('');
  const [parashaBusy, setParashaBusy] = useState(false);
  const [showDrafts, setShowDrafts] = useState(!useMobileTabs);
  const [styleHint, setStyleHint] = useState('');
  const [curatorBusy, setCuratorBusy] = useState(false);
  const [refinementInput, setRefinementInput] = useState('');
  const [refineBusy, setRefineBusy] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<RefinementTurn[]>([]);
  const [lastOriginalPrompt, setLastOriginalPrompt] = useState('');
  const curatorStream = useCuratorStream();

  const REFINEMENT_CHIPS = [
    'יותר אנרגטי',
    'יותר שקט',
    'הסר אמנים חילוניים',
    'פחות חזנות',
    'הוסף מזרחי',
  ] as const;

  useEffect(() => {
    void fetchSuggestions().then((s) => {
      if (s.styleNotes) setStyleHint(s.styleNotes);
    });
  }, []);

  const stagingBusy = stagingItems.some((i) => i.status === 'searching' || i.status === 'pending');
  const mobileStagingFocus = useMobileTabs && stagingActive && !hideStaging;

  useEffect(() => {
    if (stagingActive) onMatchStepRequest?.();
  }, [stagingActive, onMatchStepRequest]);
  const listLines = useMemo(
    () => dedupePlaylistLines(composerInput.split('\n')),
    [composerInput],
  );
  const listLinesCount = listLines.length;
  const inputLooksLikeList = listLinesCount >= 3;

  const handleGenerateFromAI = (prompt: string) => {
    setCuratorBusy(true);
    setLastOriginalPrompt(prompt.trim());
    setConversationHistory([{ role: 'user', content: prompt.trim() }]);
    curatorStream.reset();
    curatorStream.startStream(prompt, 35);
    void buildCuratorPlaylist({ prompt, mode: 'topic', targetSize: 35 })
      .then((res) => {
        curatorStream.cancel();
        if (res.lines?.length) {
          if (res.meta?.reason) toast.info(res.meta.reason);
          setConversationHistory((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `נוצרו ${res.lines.length} שירים${res.meta?.vibe ? ` · וייב: ${res.meta.vibe}` : ''}`,
            },
          ]);
          startStaging(
            res.lines.map((line) => createStagingItem(line)),
            null,
            inferPlaylistDisplayName({ prompt }),
            prompt.trim(),
          );
        } else if (!curatorStream.lines.length) {
          toast.error('לא התקבלו תוצאות');
        }
      })
      .catch((err) => {
        if (!curatorStream.lines.length) {
          const msg =
            err instanceof Error
              ? err.message
              : 'שגיאה ביצירת פלייליסט. בדוק שה-Gemini/Meilisearch מוגדרים בשרת.';
          toast.error(msg);
        }
      })
      .finally(() => setCuratorBusy(false));
  };

  const handleMatchFromList = (lines: string[]) => {
    const clean = dedupePlaylistLines(lines);
    if (!clean.length) {
      toast.error('לא נמצאו שורות שיר תקינות (שורות אמן/כותרות סוננו)');
      return;
    }
    if (clean.length < lines.length) {
      toast.info(`סוננו ${lines.length - clean.length} שורות (אמן בלבד / כותרות)`);
    }
    setParashaContext(null);
    setActiveParashaExportContext(null, null, null);
    startStaging(
      clean.map((line) => createStagingItem(sanitizePlaylistLine(line))),
      null,
    );
  };

  const handleParashaFromPdf = async (prompt: string) => {
    setParashaBusy(true);
    try {
      const data = await resolveParashaFromPdf(prompt);
      if (!data.lines.length) {
        toast.error(`לא נמצאו שירים לפרשת ${data.parasha} בקובץ PSH`);
        return;
      }
      const catalogRows = data.catalogRows ?? data.songs ?? [];
      const allCatalogRows = data.allCatalogRows ?? catalogRows;
      const ctx: StagingParashaContext = {
        targetParasha: data.parasha,
        catalogRows,
        allCatalogRows,
      };
      setParashaContext(ctx);
      setActiveParashaExportContext(data.parasha, catalogRows, allCatalogRows);

      const sourceRows = data.songs?.length
        ? data.songs
        : data.lines.map((line) => ({ line, title: '', artist: '', album: '', year: '', composer: '', parasha: data.parasha, section: 'parasha' as const }));
      const seen = new Set<string>();
      const stagingItemsNext: StagingItem[] = [];
      for (const row of sourceRows) {
        const line = row.line ?? `${row.artist} - ${row.title}`;
        const clean = sanitizePlaylistLine(line);
        const key = clean.toLocaleLowerCase();
        if (!clean || seen.has(key)) continue;
        seen.add(key);
        stagingItemsNext.push({
          id: newClientId(),
          query: clean,
          status: 'pending',
          pshRow: row.title ? row : undefined,
        });
      }

      startStaging(
        stagingItemsNext,
        ctx,
        formatParashaPlaylistName(data.parasha),
      );
      toast.success(
        `פרשת ${data.parasha}: ${data.parashaOnlyCount} שירי פרשה` +
          (data.haftarahCount ? ` + ${data.haftarahCount} הפטרה` : '') +
          ` — ${data.pdfSongCount} שורות לחיפוש במאגר`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'שגיאה בחיפוש פרשה ב-PSH';
      toast.error(msg);
    } finally {
      setParashaBusy(false);
    }
  };

  const handleASICompose = () => {
    const input = composerInput.trim();
    if (!input) return;
    if (inputLooksLikeList) {
      handleMatchFromList(listLines);
      return;
    }
    if (promptLooksLikeParasha(input)) {
      void handleParashaFromPdf(input);
      return;
    }
    handleGenerateFromAI(input);
  };

  const handleRefinement = async (refinement: string) => {
    const trimmed = refinement.trim();
    if (!trimmed || !lastOriginalPrompt) return;
    setRefineBusy(true);
    const toastId = toast.loading('משפר פלייליסט…');
    try {
      const currentLines = stagingItems
        .filter((i) => i.match)
        .map((i) => `${i.match!.artist} - ${i.match!.song_name}`);
      const fallbackLines = listLines.length ? listLines : currentLines;
      const res = await refineCuratorPlaylist({
        originalPrompt: lastOriginalPrompt,
        refinement: trimmed,
        currentLines: fallbackLines,
        conversationHistory,
        targetSize: 35,
      });
      if (!res.lines?.length) {
        toast.error('לא התקבלה רשימה מעודכנת', { id: toastId });
        return;
      }
      setConversationHistory((prev) => [
        ...prev,
        { role: 'user', content: trimmed },
        {
          role: 'assistant',
          content: `עודכנו ${res.lines.length} שירים${res.meta?.reason ? ` — ${res.meta.reason}` : ''}`,
        },
      ]);
      startStaging(
        res.lines.map((line) => createStagingItem(line)),
        parashaContext,
        stagingBuildLabel,
        stagingTopic ?? lastOriginalPrompt,
      );
      setRefinementInput('');
      toast.success(`עודכנו ${res.lines.length} שירים`, { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בשיפור', { id: toastId });
    } finally {
      setRefineBusy(false);
    }
  };

  const handleApprove = (songs: MsHit[]) => {
    onAddSongs(songs);
    onApplyAutoPlaylistName?.(stagingBuildLabel);
    clearStaging();
    setComposerInput('');
    setRefinementInput('');
    setConversationHistory([]);
    setLastOriginalPrompt('');
    toast.success(`נוספו ${songs.length} שירים`);
  };

  const isStudio = variant === 'studio';
  const panelOpen = useMobileTabs || isStudio ? true : isOpen;

  if (useMobileTabs && !mobileVisible) {
    return null;
  }

  return (
    <aside
      className={cn(
        'relative flex flex-col shrink-0 overflow-hidden min-h-0 transition-all duration-300',
        isStudio
          ? 'h-full min-w-0 border-0 bg-transparent shadow-none rounded-none j-cyan-rim'
          : 'rounded-none sm:rounded-[1.35rem] md:mr-2 border-0 sm:border border-border/45 j-glass-panel j-gradient-border j-cyan-rim',
        !isStudio &&
          (panelOpen
            ? useMobileTabs
              ? 'flex-1 min-h-0 w-full h-full'
              : 'h-full min-w-0'
            : 'h-12 w-full md:h-full md:w-14'),
        isStudio && 'flex-1 min-h-0 w-full',
        className,
      )}
    >
      <div
        className={cn(
          'flex flex-col h-full overflow-hidden',
          isStudio ? 'bg-transparent' : 'rounded-[inherit] bg-card',
        )}
      >
        {!useMobileTabs && !isStudio ? (
          <motion.button
            type="button"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setIsOpen((v) => !v)}
            className="absolute left-3 top-4 md:top-1/2 md:-translate-y-1/2 md:-left-[0.875rem] z-20 j-glass-panel border-primary/22 rounded-xl p-1.5 hover:border-primary/40 hover:text-primary transition-all"
            title={isOpen ? 'סגור ASI' : 'פתח ASI'}
          >
            {isOpen ? (
              <PanelRightClose className="w-3.5 h-3.5" />
            ) : (
              <PanelRightOpen className="w-3.5 h-3.5" />
            )}
          </motion.button>
        ) : null}

        <AnimatePresence mode="wait">
          {panelOpen ? (
            <motion.div
              key="open"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className={
                useMobileTabs
                  ? `bp-workspace-pane p-3 overflow-y-auto custom-scrollbar ws-scroll-bottom-safe ${mobileStagingFocus ? 'overflow-hidden' : ''}`
                  : isStudio
                    ? 'h-full p-2 overflow-y-auto custom-scrollbar flex flex-col gap-2 min-h-0'
                    : 'h-full p-3 sm:p-5 overflow-y-auto custom-scrollbar mt-12 md:mt-0 pt-4 md:pt-5'
              }
            >
              <div
                className={cn(
                  'shrink-0',
                  !isStudio && 'border-b border-border/45',
                  useMobileTabs ? 'mb-3 pb-3' : isStudio ? 'pb-1' : 'mb-5 pb-4',
                  mobileStagingFocus && 'hidden',
                  isStudio && 'hidden',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex gap-3 min-w-0 flex-1">
                    <span className="relative flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-[hsl(var(--mesh-coral))] to-[hsl(var(--mesh-teal))] text-primary-foreground j-glow-primary shadow-md">
                      <Sparkles className="w-[1.125rem] h-[1.125rem]" strokeWidth={2.5} />
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-display text-sm sm:text-base font-bold tracking-tight">
                        <span className="j-text-gradient">{APP_SHORT_NAME} Intelligence</span>
                      </h2>
                      <p className="text-[11px] sm:text-[12px] text-muted-foreground leading-snug mt-0.5">
                        נושא, תגיות ואווירה — לא התאמה מילולית לשם שיר
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 rounded-full text-[11px] font-semibold border border-border/55 shrink-0"
                    onClick={onRememberDraft}
                  >
                    <BookmarkPlus className="w-3.5 h-3.5 mr-1" />
                    זכור טיוטה
                  </Button>
                </div>
              </div>

              <div
                className={`shrink-0 space-y-3 ${mobileStagingFocus ? 'hidden' : ''}`}
              >
                {!composerInput.trim() ? (
                  <ComposerEntryCards
                    onPick={(id) => {
                      if (id === 'list') setComposerInput('אמן - שיר\nאמן - שיר\n');
                      else if (id === 'parasha') setComposerInput('פרשת ');
                      else setComposerInput('שירי ');
                    }}
                  />
                ) : null}
                <Textarea
                  data-testid="asi-composer-input"
                  placeholder="הדבק רשימה, כתוב נושא (20–50 שירים), או פרשה — למשל: פרשת שמות"
                  className={cn(
                    'resize-none rounded-xl border-border/40 bg-[hsl(var(--surface-1))] text-[13px] leading-relaxed focus-visible:ring-2 focus-visible:ring-primary/25',
                    useMobileTabs ? 'h-20' : isStudio ? 'h-16 min-h-[4rem]' : 'h-24 sm:h-40',
                  )}
                  value={composerInput}
                  onChange={(e) => setComposerInput(e.target.value)}
                />
                <div className="text-[11px] font-medium px-3 py-2 rounded-xl bg-muted/65 border border-border/55 text-muted-foreground">
                  {inputLooksLikeList
                    ? `זוהתה רשימה (${listLinesCount} שורות) — מתבצעת התאמה מדויקת`
                    : promptLooksLikeParasha(composerInput)
                      ? 'זוהתה פרשת שבוע — שירים יילקחו מקובץ PSH ויותאמו במאגר'
                      : 'זוהתה בקשת נושא — חיפוש לפי תגיות, ז\'אנר ואווירה + השראה מפלייליסטים'}
                  {styleHint && !inputLooksLikeList && !promptLooksLikeParasha(composerInput) ? (
                    <span className="block mt-1 text-[10px] text-primary/80">
                      זיכרון: {styleHint.slice(0, 80)}
                      {styleHint.length > 80 ? '…' : ''}
                    </span>
                  ) : null}
                </div>
                <Button
                  data-testid="asi-compose-button"
                  className="w-full rounded-full h-10 md:h-9 text-sm font-semibold"
                  onClick={handleASICompose}
                  disabled={
                    curatorBusy ||
                    curatorStream.isStreaming ||
                    parashaBusy ||
                    !composerInput.trim() ||
                    stagingBusy
                  }
                >
                  {curatorBusy || curatorStream.isStreaming || parashaBusy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> יוצר פלייליסט...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      {inputLooksLikeList
                        ? `ASI התאם רשימה (${listLinesCount})`
                        : promptLooksLikeParasha(composerInput)
                          ? 'חפש פרשה ב-PSH'
                          : 'צור פלייליסט חכם (20–50)'}
                    </>
                  )}
                </Button>
                {(stagingActive || lastOriginalPrompt) && !inputLooksLikeList ? (
                  <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-2 j-cinematic-glass">
                    <p className="text-[10px] font-semibold text-primary/90">שיפור בשיחה</p>
                    {conversationHistory.length > 1 ? (
                      <ul className="max-h-20 overflow-y-auto custom-scrollbar space-y-1 text-[10px] text-muted-foreground">
                        {conversationHistory.slice(-4).map((turn, i) => (
                          <li key={`${turn.role}-${i}`} className="truncate">
                            <span className="font-semibold text-foreground/80">
                              {turn.role === 'user' ? 'אתה' : 'AI'}:
                            </span>{' '}
                            {turn.content}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="flex flex-wrap gap-1">
                      {REFINEMENT_CHIPS.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          className="ws-filter-chip"
                          disabled={refineBusy}
                          onClick={() => void handleRefinement(chip)}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={refinementInput}
                        onChange={(e) => setRefinementInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleRefinement(refinementInput);
                        }}
                        placeholder="למשל: יותר אנרגטי, פחות חזנות…"
                        className="flex-1 h-8 rounded-lg border border-border/50 bg-background/60 px-2 text-xs"
                        dir="rtl"
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 rounded-lg text-xs shrink-0"
                        disabled={refineBusy || !refinementInput.trim()}
                        onClick={() => void handleRefinement(refinementInput)}
                      >
                        {refineBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'שפר'}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {(curatorStream.isStreaming || curatorStream.lines.length > 0) ? (
                  <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-primary/5 border border-primary/15 j-cyan-rim">
                    <PlaylistProgressRing
                      current={curatorStream.lines.length}
                      target={curatorStream.progress?.targetSize ?? 35}
                    />
                    <div className="min-w-0 flex-1 text-right">
                      {curatorStream.vibe ? <VibeBadge vibe={curatorStream.vibe} className="mb-1" /> : null}
                      <p className="text-[10px] text-muted-foreground truncate">
                        {curatorStream.progress?.message ??
                          (curatorStream.isStreaming ? 'בונה פלייליסט...' : `${curatorStream.lines.length} שירים`)}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div
                className={cn(
                  'border-t border-border/35',
                  mobileStagingFocus && 'hidden',
                  isStudio && 'hidden',
                  useMobileTabs ? 'mt-3 pt-3' : 'mt-5 pt-4',
                )}
              >
                <div className="flex items-center gap-2 text-xs font-bold mb-3 text-foreground uppercase tracking-[0.1em]">
                  <History className="w-3.5 h-3.5 text-primary" />
                  טיוטות שמורות
                </div>
                <div className="space-y-1.5 max-h-[28vh] md:max-h-[22vh] overflow-y-auto pr-1 custom-scrollbar">
                  {draftHistory.length === 0 ? (
                    <div className="text-xs font-medium text-muted-foreground rounded-[1rem] border border-dashed border-border/65 bg-muted/35 p-4 leading-relaxed">
                      עדיין אין טיוטות שמורות. לחץ "זכור טיוטה" כדי לשמור מצב עבודה.
                    </div>
                  ) : (
                    draftHistory.map((draft) => (
                      <div
                        key={draft.id}
                        className="rounded-xl border border-border/55 bg-card/85 backdrop-blur-sm px-2.5 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs md:text-[13px] font-medium truncate">{draft.name || 'טיוטה ללא שם'}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {draft.songs.length} שירים · {formatDraftTime(draft.savedAt)}
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 rounded-md text-[11px] font-medium"
                              onClick={() => onLoadDraft(draft.id)}
                            >
                              טען
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-md text-muted-foreground hover:text-destructive"
                              onClick={() => onDeleteDraft(draft.id)}
                              title="מחק טיוטה"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {stagingActive && !hideStaging ? (
                <div className={useMobileTabs ? 'bp-workspace-pane mt-0' : 'mt-5'}>
                  <StagingArea
                    key={stagingBatchId}
                    items={stagingItems}
                    setItems={setStagingItems}
                    onApproveAll={handleApprove}
                    onCancel={() => {
                      clearStaging();
                      setParashaContext(null);
                      setActiveParashaExportContext(null, null, null);
                    }}
                    searchFilters={filters}
                    parashaContext={parashaContext}
                    topicContext={stagingTopic}
                    mobileLayout={useMobileTabs}
                  />
                </div>
              ) : null}
            </motion.div>
          ) : (
            <motion.div
              key="closed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="flex-1 flex flex-col items-center justify-center pb-12 md:pb-0 px-4"
            >
              <span className="md:-rotate-90 whitespace-nowrap text-muted-foreground font-semibold tracking-[0.26em] flex flex-col md:flex-row items-center gap-2 text-[10px] uppercase md:normal-case md:text-[11px]">
                <Sparkles className="w-4 h-4 md:w-3.5 md:h-3.5 md:rotate-90 text-primary shrink-0" />
                {APP_SHORT_NAME} AI
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
