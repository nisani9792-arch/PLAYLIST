import { useState } from 'react';
import { PlaylistView } from './PlaylistView';
import { PlaylistProgressRing } from '@/components/ui/playlist-progress-ring';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { scaleTap } from '@/lib/motion-presets';
import { cn } from '@/lib/utils';
import type { MsHit } from '@/lib/meilisearch';
import {
  PlaylistAssistantPanel,
  PlaylistAssistantTrigger,
} from './PlaylistAssistantPanel';
import { PlaylistCommitFooter } from './PlaylistCommitFooter';
import { PlayerProvider } from '@/contexts/PlayerContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';

type PlaylistCanvasProps = {
  playlistName: string;
  setPlaylistName: (name: string) => void;
  songs: MsHit[];
  removeSong: (index: number) => void;
  removeSongsById: (ids: Set<string>) => void;
  reorderSongs: (from: number, to: number) => void;
  replaceSongs: (songs: MsHit[]) => void;
  clearPlaylist: () => void;
  isDirty: boolean;
  committing: boolean;
  onCommit: () => Promise<boolean>;
  targetSize?: number;
  onSmartFill?: () => void;
  smartFillBusy?: boolean;
  className?: string;
};

export function PlaylistCanvas({
  targetSize = 50,
  onSmartFill,
  smartFillBusy,
  songs,
  isDirty,
  committing,
  onCommit,
  replaceSongs,
  removeSongsById,
  className,
  ...rest
}: PlaylistCanvasProps) {
  const isMobile = useIsMobile();
  const [assistantOpen, setAssistantOpen] = useState(false);
  const showFill = songs.length > 0 && songs.length < targetSize && onSmartFill;

  const handleCommit = async () => {
    const ok = await onCommit();
    if (ok) toast.success('הפלייליסט נשמר וננעל');
    else toast.error('שגיאה בשמירת הפלייליסט');
  };

  return (
    <PlayerProvider>
      <section className={cn('flex flex-col min-h-0 j-glass-panel j-gradient-border rounded-[1.35rem] overflow-hidden', className)}>
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3.5 border-b border-border/50 bg-gradient-to-l from-primary/7 via-transparent to-[hsl(var(--mesh-grey)/0.06)] shadow-sm">
          <div className="flex items-center gap-3">
            <PlaylistProgressRing current={songs.length} target={targetSize} />
            <div>
              <h2 className="font-display text-sm font-bold tracking-tight">פלייליסט</h2>
              <p className="text-[10px] text-secondary">{songs.length} שירים</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PlaylistAssistantTrigger
              disabled={!songs.length}
              onClick={() => setAssistantOpen(true)}
            />
            {showFill ? (
              <motion.div {...scaleTap}>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-9 rounded-full px-4 text-[11px] font-semibold border-primary/20 bg-primary/8 hover:bg-primary/12"
                  disabled={smartFillBusy}
                  onClick={onSmartFill}
                >
                  <Sparkles className="w-3.5 h-3.5 ml-1" />
                  השלם ל-{targetSize}
                </Button>
              </motion.div>
            ) : null}
          </div>
        </div>
        <PlaylistView
          {...rest}
          songs={songs}
          removeSongsById={removeSongsById}
          className="flex-1 min-h-0 border-0 rounded-none shadow-none bg-transparent"
        />
        <PlaylistCommitFooter
          isDirty={isDirty}
          committing={committing}
          songCount={songs.length}
          onCommit={() => void handleCommit()}
          mobileNavOffset={isMobile}
        />
      </section>
      <PlaylistAssistantPanel
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        songs={songs}
        onApplyArrangement={replaceSongs}
      />
    </PlayerProvider>
  );
}
