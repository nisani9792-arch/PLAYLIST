import { cn } from '@/lib/utils';
import { Music2 } from 'lucide-react';
import type { MsHit } from '@/lib/meilisearch';
import { HashkafaShield } from './hashkafa-shield';

export function SongCard({
  song,
  index,
  blocked,
  blockReason,
  onRemove,
  className,
}: {
  song: MsHit;
  index?: number;
  blocked?: boolean;
  blockReason?: string;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-border/60 bg-card/90 px-3 py-2.5',
        blocked && 'opacity-60 border-destructive/30',
        className,
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {index != null ? (
          <span className="text-xs font-bold tabular-nums">{index}</span>
        ) : (
          <Music2 className="h-4 w-4" />
        )}
      </span>
      <div className="min-w-0 flex-1 text-right">
        <p className="text-sm font-semibold truncate">{song.song_name}</p>
        <p className="text-[11px] text-muted-foreground truncate">{song.artist}</p>
        {song.genre ? (
          <p className="text-[10px] text-primary/70 mt-0.5">{song.genre}</p>
        ) : null}
      </div>
      <HashkafaShield blocked={blocked} reason={blockReason} />
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-muted-foreground hover:text-destructive px-2 py-1"
          aria-label="הסר שיר"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
