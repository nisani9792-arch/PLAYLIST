import { PlaylistView } from './PlaylistView';
import { PlaylistProgressRing } from '@/components/ui/playlist-progress-ring';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MsHit } from '@/lib/meilisearch';

type PlaylistCanvasProps = {
  playlistName: string;
  setPlaylistName: (name: string) => void;
  songs: MsHit[];
  removeSong: (index: number) => void;
  reorderSongs: (from: number, to: number) => void;
  clearPlaylist: () => void;
  targetSize?: number;
  onSmartFill?: () => void;
  smartFillBusy?: boolean;
  className?: string;
};

export function PlaylistCanvas({
  targetSize = 35,
  onSmartFill,
  smartFillBusy,
  songs,
  className,
  ...rest
}: PlaylistCanvasProps) {
  const showFill = songs.length > 0 && songs.length < targetSize && onSmartFill;

  return (
    <section className={cn('flex flex-col min-h-0 bp-surface-card rounded-[1.25rem] overflow-hidden', className)}>
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <PlaylistProgressRing current={songs.length} target={targetSize} />
          <div>
            <h2 className="font-display text-sm font-bold">פלייליסט</h2>
            <p className="text-[10px] text-muted-foreground">{songs.length} שירים</p>
          </div>
        </div>
        {showFill ? (
          <Button
            size="sm"
            variant="secondary"
            className="h-9 rounded-xl text-[11px] font-semibold"
            disabled={smartFillBusy}
            onClick={onSmartFill}
          >
            <Sparkles className="w-3.5 h-3.5 ml-1" />
            השלם ל-{targetSize}
          </Button>
        ) : null}
      </div>
      <PlaylistView
        {...rest}
        songs={songs}
        className="flex-1 min-h-0 border-0 rounded-none shadow-none bg-transparent"
      />
    </section>
  );
}
