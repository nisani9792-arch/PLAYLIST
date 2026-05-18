import { useState } from 'react';
import { dedupePlaylistLines } from '@workspace/playlist-validation';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { StagingArea, StagingItem } from './StagingArea';
import { List, PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import { MsHit } from '../../lib/meilisearch';
import { newClientId } from '../../lib/ids';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchFilters } from '@/contexts/SearchFiltersContext';

export function BulkPanel({ onAddSongs }: { onAddSongs: (songs: MsHit[]) => void }) {
  const { filters } = useSearchFilters();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [stagingBatchId, setStagingBatchId] = useState(0);
  const [stagingItems, setStagingItems] = useState<StagingItem[]>([]);

  const stagingBusy = stagingItems.some(
    (i) => i.status === 'searching' || i.status === 'pending',
  );

  const handleMatch = () => {
    const raw = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const lines = dedupePlaylistLines(raw);
    if (!lines.length) {
      toast.error('לא נמצאו שורות שיר תקינות (שורות אמן/כותרות סוננו)');
      return;
    }
    if (lines.length < raw.length) {
      toast.info(`סוננו ${raw.length - lines.length} שורות (אמן בלבד / כותרות)`);
    }
    setStagingBatchId((b) => b + 1);
    setStagingItems(
      lines.map((line) => ({
        id: newClientId(),
        query: line,
        status: 'pending' as const,
      })),
    );
  };

  const handleApprove = (songs: MsHit[]) => {
    onAddSongs(songs);
    setStagingItems([]);
    setText('');
    setIsOpen(false);
    toast.success(`נוספו ${songs.length} שירים`);
  };

  return (
    <div
      className={`relative h-full flex flex-col border-l border-black/[0.07] transition-all duration-300 ${isOpen ? 'w-80' : 'w-12'}`}
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
          className="absolute -left-3.5 top-1/2 -translate-y-1/2 bg-white border border-black/[0.09] rounded-xl p-1.5 z-10 shadow-sm hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-colors"
        >
          {isOpen ? (
            <PanelLeftClose className="w-3.5 h-3.5" />
          ) : (
            <PanelLeftOpen className="w-3.5 h-3.5" />
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
                <div className="bg-secondary p-1.5 rounded-xl border border-black/[0.07]">
                  <List className="w-4 h-4 text-foreground/70" />
                </div>
                <h2 className="font-semibold text-sm text-foreground">ייבוא מרשימה</h2>
              </div>

              <Textarea
                data-testid="bulk-text-input"
                placeholder="הדבק רשימת שירים (שורה לכל שיר, אמן - שיר)..."
                className="resize-none h-64 mb-4 bg-white border-black/10 focus-visible:ring-primary/30 text-sm rounded-xl placeholder:text-muted-foreground/50 shadow-sm"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />

              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button
                  data-testid="bulk-match-button"
                  className="w-full rounded-xl shadow-sm"
                  onClick={handleMatch}
                  disabled={!text.trim() || stagingBusy}
                  variant="secondary"
                >
                  חפש והתאם ({text.split('\n').filter((l) => l.trim()).length} שורות)
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
                <List className="w-3.5 h-3.5 rotate-90" />
                ייבוא מרשימה
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
