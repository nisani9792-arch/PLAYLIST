import { forwardRef, memo } from 'react';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { motion } from 'framer-motion';
import {
  GripVertical,
  Layers,
  Pause,
  Play,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { MsHit } from '@/lib/meilisearch';
import type { OverlapInfo } from '@/hooks/use-playlist-overlap';
import { extractBpm, extractKey } from '@/lib/playlist-arrange';
import { trackRowKey } from '@/lib/track-format';

function coverFallbackLabel(song: MsHit): string {
  const src = song.album?.trim() || song.artist?.trim() || song.song_name;
  return src.slice(0, 1).toUpperCase();
}

export type TrackCardProps = {
  song: MsHit;
  index: number;
  overlap?: OverlapInfo;
  isPlaying?: boolean;
  isDragging?: boolean;
  isSelected?: boolean;
  selectionMode?: boolean;
  onPlay?: () => void;
  onRemove?: () => void;
  onToggleSelect?: () => void;
  onLongPressStart?: () => void;
  onLongPressEnd?: () => void;
  dragHandleProps?: {
    attributes: DraggableAttributes;
    listeners: SyntheticListenerMap | undefined;
  };
  className?: string;
  style?: React.CSSProperties;
};

const TrackCardInner = forwardRef<HTMLDivElement, TrackCardProps>(
  function TrackCard(
    {
      song,
      index,
      overlap,
      isPlaying,
      isDragging,
      isSelected,
      selectionMode,
      onPlay,
      onRemove,
      onToggleSelect,
      onLongPressStart,
      onLongPressEnd,
      dragHandleProps,
      className,
      style,
    },
    ref,
  ) {
    const bpm = extractBpm(song);
    const key = extractKey(song);
    const coverUrl = song.cover_url;

    return (
      <motion.div
        ref={ref}
        style={style}
        layout="position"
        data-track-id={trackRowKey(song)}
        className={cn(
          'group flex items-center gap-2 sm:gap-3 min-h-12 rounded-2xl sm:rounded-3xl px-3 py-2',
          'bg-[hsl(var(--surface-2)/0.55)] shadow-sm transition-all duration-200',
          'active:scale-[0.98]',
          isDragging
            ? 'bg-[hsl(var(--surface-3)/0.9)] z-[var(--z-drag)] scale-[1.01] shadow-md'
            : isSelected
              ? 'bg-primary/12 ring-2 ring-primary/25 shadow-md'
              : 'hover:bg-[hsl(var(--surface-3)/0.7)] hover:shadow-md',
          className,
        )}
        onPointerDown={onLongPressStart}
        onPointerUp={onLongPressEnd}
        onPointerLeave={onLongPressEnd}
        onPointerCancel={onLongPressEnd}
        onClick={selectionMode ? onToggleSelect : undefined}
      >
        {dragHandleProps ? (
          <button
            type="button"
            className="touch-none shrink-0 flex h-12 w-10 items-center justify-center text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing rounded-full"
            aria-label="גרור לסידור"
            {...dragHandleProps.attributes}
            {...dragHandleProps.listeners}
          >
            <GripVertical className="w-4 h-4" />
          </button>
        ) : null}

        {selectionMode ? (
          <span
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold',
              isSelected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border/50 bg-[hsl(var(--surface-1))]',
            )}
            aria-hidden
          >
            {isSelected ? '✓' : ''}
          </span>
        ) : null}

        <div
          className="w-8 sm:w-9 text-center text-xs font-display font-bold tabular-nums shrink-0 text-primary/90 bg-primary/[0.1] rounded-full py-2"
          style={{ fontFamily: "'Space Grotesk', monospace" }}
        >
          {index + 1}
        </div>

        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-[hsl(var(--surface-3)/0.6)] shadow-sm">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-muted/30 text-sm font-bold text-primary">
              {coverFallbackLabel(song)}
            </div>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPlay?.();
            }}
            className={cn(
              'absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100',
              isPlaying && 'opacity-100',
            )}
            aria-label={isPlaying ? 'השהה' : 'נגן'}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 text-white drop-shadow" />
            ) : (
              <Play className="h-4 w-4 text-white drop-shadow ml-0.5" />
            )}
          </button>
        </div>

        <div className="flex-1 min-w-0 py-0.5 flex flex-col justify-center gap-0.5">
          <div className="font-semibold text-sm line-clamp-1 text-foreground">
            {song.song_name}
          </div>
          <div className="text-xs text-muted-foreground/80 flex items-center gap-1.5 min-w-0">
            <span className="truncate">{song.artist}</span>
            {song.genre ? (
              <>
                <span className="opacity-40 shrink-0">·</span>
                <span className="truncate opacity-70">{song.genre}</span>
              </>
            ) : null}
          </div>
          {(bpm || key) && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 line-clamp-1">
              {bpm ? <span>{bpm} BPM</span> : null}
              {bpm && key ? <span>·</span> : null}
              {key ? <span>{key}</span> : null}
            </div>
          )}
        </div>

        {overlap ? (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2.5 py-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 shrink-0 shadow-sm"
            title={`קיים גם ב"${overlap.playlistName}"`}
          >
            <Layers className="h-3 w-3" />
            חפיפה
          </span>
        ) : null}

        {!selectionMode && onRemove ? (
          <div className="flex items-center gap-1 px-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-full text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              title="הסר"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : null}
      </motion.div>
    );
  },
);

function trackCardPropsAreEqual(prev: TrackCardProps, next: TrackCardProps): boolean {
  return (
    trackRowKey(prev.song) === trackRowKey(next.song) &&
    prev.index === next.index &&
    prev.overlap === next.overlap &&
    prev.isPlaying === next.isPlaying &&
    prev.isDragging === next.isDragging &&
    prev.isSelected === next.isSelected &&
    prev.selectionMode === next.selectionMode &&
    prev.className === next.className &&
    prev.onPlay === next.onPlay &&
    prev.onRemove === next.onRemove &&
    prev.onToggleSelect === next.onToggleSelect &&
    prev.dragHandleProps === next.dragHandleProps
  );
}

export const TrackCard = memo(TrackCardInner, trackCardPropsAreEqual);
