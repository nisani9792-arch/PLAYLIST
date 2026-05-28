import { useState } from 'react';
import { PlaylistView } from './PlaylistView';
import { PlaylistProgressRing } from '@/components/ui/playlist-progress-ring';
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
  songs,
  isDirty,
  committing,
  onCommit,
  replaceSongs,
  className,
  ...rest
}: PlaylistCanvasProps) {
  const isMobile = useIsMobile();
  const [assistantOpen, setAssistantOpen] = useState(false);

  const handleCommit = async () => {
    const ok = await onCommit();
    if (ok) toast.success('הפלייליסט נשמר וננעל');
    else toast.error('שגיאה בשמירת הפלייליסט');
  };

  return (
    <PlayerProvider>
      <section className={cn('ws-col ws-col--canvas min-h-0', className)} aria-label="פלייליסט פעיל">
        <header className="ws-col__header">
          <div className="flex items-center gap-2">
            <PlaylistProgressRing current={songs.length} target={targetSize} />
            <h2 className="ws-col__title">Canvas</h2>
          </div>
          <PlaylistAssistantTrigger
            disabled={!songs.length}
            onClick={() => setAssistantOpen(true)}
          />
        </header>

        <PlaylistView {...rest} songs={songs} className="flex-1 min-h-0" />

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
