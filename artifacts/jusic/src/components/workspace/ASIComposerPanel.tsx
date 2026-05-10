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

  const handleASICompose = () => {
    const input = composerInput.trim();
    if (!input) return;
    // #region agent log
    fetch('http://127.0.0.1:7720/ingest/a3b66527-1e2c-496d-8748-962b4e82cf3c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0e4088'},body:JSON.stringify({sessionId:'0e4088',runId:`asi_${Date.now()}`,hypothesisId:'H3',location:'workspace/ASIComposerPanel.tsx:handleASICompose',message:'ASI compose triggered',data:{inputLooksLikeList,listLinesCount,inputLength:input.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (inputLooksLikeList) {
      handleMatchFromList(listLines);
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
      className={`relative h-full flex flex-col border-r border-black/[0.06] transition-all duration-300 ${
        isOpen ? 'w-[360px]' : 'w-14'
      }`}
    >
      <div
        className="flex flex-col h-full"
        style={{
          background: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
        }}
      >
        <motion.button
          type="button"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setIsOpen((v) => !v)}
          className="absolute -left-3.5 top-1/2 -translate-y-1/2 bg-white border border-black/[0.1] rounded-xl p-1.5 z-10 shadow-sm hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-colors"
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
              className="h-full p-4 overflow-y-auto"
            >
              <div className="mb-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-primary/10 p-1.5 rounded-xl border border-primary/20">
                      <Sparkles className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-sm text-foreground">ASI Playlist Bot</h2>
                      <p className="text-[11px] text-muted-foreground">שדה אחד חכם: בונה לבד או מתאים רשימה</p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 rounded-xl text-xs"
                    onClick={onRememberDraft}
                  >
                    <BookmarkPlus className="w-3.5 h-3.5 mr-1" />
                    זכור טיוטה
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <Textarea
                  data-testid="asi-composer-input"
                  placeholder="הדבק רשימת שירים (שורה לכל שיר) או כתוב בקשה חופשית (למשל: שירי שבת שמחים)"
                  className="resize-none h-44 bg-white border-black/10 focus-visible:ring-primary/35 rounded-2xl text-sm shadow-sm"
                  value={composerInput}
                  onChange={(e) => setComposerInput(e.target.value)}
                />
                <div className="text-[11px] text-muted-foreground">
                  {inputLooksLikeList
                    ? `ASI זיהה רשימה (${listLinesCount} שורות) ויבצע התאמה מדויקת`
                    : 'ASI זיהה בקשת נושא ויבנה פלייליסט עצמאי'}
                </div>
                <Button
                  data-testid="asi-compose-button"
                  className="w-full rounded-xl h-10 shadow-sm"
                  onClick={handleASICompose}
                  disabled={generatePlaylist.isPending || !composerInput.trim() || stagingBusy}
                >
                  {generatePlaylist.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ASI מייצר...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      {inputLooksLikeList ? `ASI התאם רשימה (${listLinesCount})` : 'ASI צור פלייליסט'}
                    </>
                  )}
                </Button>
              </div>

              <div className="mt-4">
                <div className="flex items-center gap-2 text-xs font-medium mb-2">
                  <History className="w-3.5 h-3.5" />
                  טיוטות אחרונות
                </div>
                <div className="space-y-2 max-h-[32vh] overflow-y-auto pr-1 custom-scrollbar">
                  {draftHistory.length === 0 ? (
                    <div className="text-xs text-muted-foreground bg-muted/45 rounded-xl border border-border/60 p-3">
                      עדיין אין טיוטות שמורות. לחץ "זכור טיוטה" כדי לשמור מצב עבודה.
                    </div>
                  ) : (
                    draftHistory.map((draft) => (
                      <div
                        key={draft.id}
                        className="rounded-xl border border-border/70 bg-white/80 px-3 py-2.5 shadow-[0_2px_10px_rgba(10,20,40,0.04)]"
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
              className="flex-1 flex flex-col items-center justify-center"
            >
              <span className="transform -rotate-90 whitespace-nowrap text-muted-foreground/75 font-medium tracking-[0.22em] flex items-center gap-2 text-[11px]">
                <Sparkles className="w-3.5 h-3.5 rotate-90 text-primary/70" />
                ASI PLAYLIST BOT
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
