import { useState } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { StagingArea, StagingItem } from './StagingArea';
import { useGeneratePlaylist } from '@workspace/api-client-react';
import { Sparkles, Loader2, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { MsHit } from '../../lib/meilisearch';
import { newClientId } from '../../lib/ids';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useSearchFilters } from '@/contexts/SearchFiltersContext';

export function AIPanel({ onAddSongs }: { onAddSongs: (songs: MsHit[]) => void }) {
  const { filters } = useSearchFilters();
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [stagingBatchId, setStagingBatchId] = useState(0);
  const [stagingItems, setStagingItems] = useState<StagingItem[]>([]);
  const generatePlaylist = useGeneratePlaylist();

  const stagingBusy = stagingItems.some(
    (i) => i.status === 'searching' || i.status === 'pending',
  );

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    generatePlaylist.mutate(
      { data: { prompt } },
      {
        onSuccess: (res) => {
          if (res.lines && res.lines.length) {
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

  const handleApprove = (songs: MsHit[]) => {
    onAddSongs(songs);
    setStagingItems([]);
    setPrompt('');
    setIsOpen(false);
    toast.success(`נוספו ${songs.length} שירים`);
  };

  return (
    <div
      className={`relative h-full flex flex-col border-r border-black/[0.07] transition-all duration-300 ${isOpen ? 'w-80' : 'w-12'}`}
    >
      <div
        className="flex flex-col h-full"
        style={{
          background: 'rgba(255,255,255,0.68)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <motion.button
          type="button"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsOpen(!isOpen)}
          className="absolute -right-3.5 top-1/2 -translate-y-1/2 bg-white border border-black/[0.09] rounded-xl p-1.5 z-10 shadow-sm hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-colors"
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
              transition={{ duration: 0.15 }}
              className="flex flex-col h-full p-4 overflow-y-auto"
            >
              <div className="flex items-center gap-2 mb-5">
                <div className="bg-primary/10 p-1.5 rounded-xl border border-primary/15">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-semibold text-sm text-foreground">AI מוזיקלי</h2>
              </div>

              <Textarea
                data-testid="ai-prompt-input"
                placeholder="תיאור פלייליסט (למשל: שירי שבת שמחים, ניגוני חסידות)..."
                className="resize-none h-32 mb-4 bg-white border-black/10 focus-visible:ring-primary/30 rounded-xl text-sm placeholder:text-muted-foreground/50 shadow-sm"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />

              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button
                  data-testid="generate-playlist-button"
                  className="w-full rounded-xl shadow-sm"
                  onClick={handleGenerate}
                  disabled={generatePlaylist.isPending || !prompt.trim() || stagingBusy}
                >
                  {generatePlaylist.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> מייצר...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" /> צור פלייליסט
                    </>
                  )}
                </Button>
              </motion.div>

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
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col items-center justify-center"
            >
              <span className="transform -rotate-90 whitespace-nowrap text-muted-foreground/70 font-medium tracking-widest flex items-center gap-2 text-xs">
                <Sparkles className="w-3.5 h-3.5 rotate-90 text-primary/70" />
                AI מוזיקלי
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
