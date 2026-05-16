import { useMemo, useState } from 'react';
import { useGeneratePlaylist } from '@workspace/api-client-react';
import { Sparkles, Loader2, History, BookmarkPlus, PanelRightClose, PanelRightOpen, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { StagingArea, StagingItem } from './StagingArea';
import { useSearchFilters } from '@/contexts/SearchFiltersContext';
import type { MsHit } from '../../lib/meilisearch';
import { newClientId } from '../../lib/ids';
import type { PlaylistDraftSnapshot } from '../../lib/playlist-draft';
import { promptLooksLikeParasha, resolveParashaFromPdf } from '../../lib/parasha';

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
  draftHistory,
  onRememberDraft,
  onLoadDraft,
  onDeleteDraft,
}: {
  onAddSongs: (songs: MsHit[]) => void;
  draftHistory: PlaylistDraftSnapshot[];
  onRememberDraft: () => void;
  onLoadDraft: (draftId: string) => void;
  onDeleteDraft: (draftId: string) => void;
}) {
  const { filters } = useSearchFilters();
  const [isOpen, setIsOpen] = useState(true);
  const [composerInput, setComposerInput] = useState('');
  const [stagingBatchId, setStagingBatchId] = useState(0);
  const [stagingItems, setStagingItems] = useState<StagingItem[]>([]);
  const [parashaBusy, setParashaBusy] = useState(false);
  const generatePlaylist = useGeneratePlaylist();

  const stagingBusy = stagingItems.some((i) => i.status === 'searching' || i.status === 'pending');
  const listLines = useMemo(
    () => composerInput.split('\n').map((l) => l.trim()).filter(Boolean),
    [composerInput],
  );
  const listLinesCount = listLines.length;
  const inputLooksLikeList = listLinesCount >= 3;

  const handleGenerateFromAI = (prompt: string) => {
    generatePlaylist.mutate(
      { data: { prompt } },
      {
        onSuccess: (res) => {
          if (res.lines?.length) {
            setStagingBatchId((b) => b + 1);
            setStagingItems(
              res.lines.map((line) => ({
                id: newClientId(),
                query: line,
                status: 'pending' as const,
              })),
            );
          } else {
            toast.error('לא התקבלו תוצאות');
          }
        },
        onError: (err) => {
          const msg =
            err instanceof Error
              ? err.message
              : 'שגיאה ביצירת פלייליסט. בדוק שה-Gemini מוגדר בשרת.';
          toast.error(msg);
        },
      },
    );
  };

  const handleMatchFromList = (lines: string[]) => {
    if (!lines.length) return;
    setStagingBatchId((b) => b + 1);
    setStagingItems(
      lines.map((line) => ({
        id: newClientId(),
        query: line,
        status: 'pending' as const,
      })),
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
      setStagingBatchId((b) => b + 1);
      setStagingItems(
        data.lines.map((line) => ({
          id: newClientId(),
          query: line,
          status: 'pending' as const,
        })),
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

  const handleApprove = (songs: MsHit[]) => {
    onAddSongs(songs);
    setStagingItems([]);
    setComposerInput('');
    toast.success(`נוספו ${songs.length} שירים`);
  };

  return (
    <aside
      className={`relative flex flex-col shrink-0 rounded-none sm:rounded-[1.25rem] md:mr-2 overflow-hidden border-0 sm:border border-border/55 bg-card shadow-lg transition-all duration-300 ${
        isOpen ? 'h-[34dvh] min-h-[14rem] max-h-[42dvh] w-full md:h-full md:max-h-none md:min-h-0 md:w-[380px] lg:w-[400px]' : 'h-12 w-full md:h-full md:w-14'
      }`}
    >
      <div className="flex flex-col h-full overflow-hidden rounded-[inherit] bg-card">
        <motion.button
          type="button"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setIsOpen((v) => !v)}
          className="absolute left-3 top-4 md:top-1/2 md:-translate-y-1/2 md:-left-[0.875rem] z-20 bp-glass-panel border-primary/22 rounded-xl p-1.5 shadow-md hover:shadow-lg hover:border-primary/40 hover:text-primary transition-all"
          title={isOpen ? 'סגור ASI' : 'פתח ASI'}
        >
          {isOpen ? (
            <PanelRightClose className="w-3.5 h-3.5" />
          ) : (
            <PanelRightOpen className="w-3.5 h-3.5" />
          )}
        </motion.button>

        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="open"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="h-full p-3 sm:p-5 overflow-y-auto custom-scrollbar mt-12 md:mt-0 pt-4 md:pt-5"
            >
              <div className="mb-5 pb-4 border-b border-border/45">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex gap-3 min-w-0">
                    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-emerald-500 to-primary text-primary-foreground shadow-lg shadow-primary/35 ring-4 ring-primary/12">
                      <Sparkles className="w-[1.125rem] h-[1.125rem]" strokeWidth={2.5} />
                    </span>
                    <div>
                      <h2 className="font-display text-base font-bold tracking-tight text-foreground">
                        BUILD PLAY Intelligence
                      </h2>
                      <p className="text-[12px] text-muted-foreground leading-snug mt-0.5 max-w-[16rem]">
                        רשימה אחת גמישה — התאמה חכמה או יצירה מנושא
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 rounded-xl text-[11px] font-semibold border border-border/60 shadow-sm shrink-0"
                    onClick={onRememberDraft}
                  >
                    <BookmarkPlus className="w-3.5 h-3.5 mr-1" />
                    זכור טיוטה
                  </Button>
                </div>
              </div>

              <div className="space-y-3.5">
                <Textarea
                  data-testid="asi-composer-input"
                  placeholder="הדבק רשימה, כתוב נושא (22–30 שירים), או פרשה — למשל: פרשת שמות"
                  className="resize-none h-28 sm:h-44 rounded-[1rem] border-border/65 bg-background/75 text-[13px] leading-relaxed shadow-inner focus-visible:ring-2 focus-visible:ring-primary/30"
                  value={composerInput}
                  onChange={(e) => setComposerInput(e.target.value)}
                />
                <div className="text-[11px] font-medium px-3 py-2 rounded-xl bg-muted/65 border border-border/55 text-muted-foreground">
                  {inputLooksLikeList
                    ? `זוהתה רשימה (${listLinesCount} שורות) — מתבצעת התאמה מדויקת`
                    : promptLooksLikeParasha(composerInput)
                      ? 'זוהתה פרשת שבוע — שירים יילקחו מקובץ PSH ויותאמו במאגר'
                      : 'זוהתה בקשת נושא — הפלייליסט ייווצר (22–30 שירים)'}
                </div>
                <Button
                  data-testid="asi-compose-button"
                  className="w-full rounded-xl h-11 shadow-lg shadow-primary/20 font-semibold"
                  onClick={handleASICompose}
                  disabled={
                    generatePlaylist.isPending ||
                    parashaBusy ||
                    !composerInput.trim() ||
                    stagingBusy
                  }
                >
                  {generatePlaylist.isPending || parashaBusy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ASI מייצר...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      {inputLooksLikeList
                        ? `ASI התאם רשימה (${listLinesCount})`
                        : promptLooksLikeParasha(composerInput)
                          ? 'חפש פרשה ב-PSH'
                          : 'ASI צור פלייליסט (22–30)'}
                    </>
                  )}
                </Button>
              </div>

              <div className="mt-5 pt-4 border-t border-border/35">
                <div className="flex items-center gap-2 text-xs font-bold mb-3 text-foreground uppercase tracking-[0.1em]">
                  <History className="w-3.5 h-3.5 text-primary" />
                  טיוטות שמורות
                </div>
                <div className="space-y-2 max-h-[32vh] overflow-y-auto pr-1 custom-scrollbar">
                  {draftHistory.length === 0 ? (
                    <div className="text-xs font-medium text-muted-foreground rounded-[1rem] border border-dashed border-border/65 bg-muted/35 p-4 leading-relaxed">
                      עדיין אין טיוטות שמורות. לחץ "זכור טיוטה" כדי לשמור מצב עבודה.
                    </div>
                  ) : (
                    draftHistory.map((draft) => (
                      <div
                        key={draft.id}
                        className="rounded-xl border border-border/55 bg-card/90 px-3 py-2.5 bp-soft-glow-primary shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{draft.name || 'טיוטה ללא שם'}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {draft.songs.length} שירים · {formatDraftTime(draft.savedAt)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 rounded-lg text-xs"
                              onClick={() => onLoadDraft(draft.id)}
                            >
                              טען
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
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

              {stagingItems.length > 0 && (
                <StagingArea
                  key={stagingBatchId}
                  items={stagingItems}
                  setItems={setStagingItems}
                  onApproveAll={handleApprove}
                  onCancel={() => setStagingItems([])}
                  searchFilters={filters}
                />
              )}
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
                BUILD PLAY AI
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
