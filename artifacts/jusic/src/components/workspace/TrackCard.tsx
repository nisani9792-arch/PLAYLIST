import { forwardRef } from 'react';
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

export const TrackCard = forwardRef<HTMLDivElement, TrackCardProps>(
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
        className={cn(
          'group flex items-center gap-2 sm:gap-3 rounded-[0.875rem] border transition-all duration-200 min-h-[4.25rem] px-2 sm:px-3 j-cinematic-glass',
          isDragging
            ? 'border-primary/45 j-cyan-rim-active z-50 scale-[1.01] shadow-lg'
            : isSelected
              ? 'bg-primary/12 border-primary/45 j-cyan-rim-active ring-1 ring-primary/30'
              : 'border-border/40 hover:border-primary/35 hover:j-cyan-rim',
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
            className="touch-none shrink-0 p-1.5 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing rounded-lg"
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
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold',
              isSelected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border/60 bg-background/80',
            )}
            aria-hidden
          >
            {isSelected ? '✓' : ''}
          </span>
        ) : null}

        <motion.div
          className="w-7 sm:w-8 text-center text-[11px] font-display font-bold tabular-nums shrink-0 text-primary/85 bg-primary/[0.08] rounded-lg py-2 border border-primary/15"
          style={{ fontFamily: "'Space Grotesk', monospace" }}
        >
          {index + 1}
        </motion.div>

        <motion.div
          className="relative h-11 w-11 sm:h-12 sm:w-12 shrink-0 overflow-hidden rounded-xl border border-border/50 bg-muted/40"
          whileTap={{ scale: 0.95 }}
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <motion.div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-muted/30 text-sm font-bold text-primary">
              {coverFallbackLabel(song)}
            </motion.div>
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
        </motion.div>

        <motion.div className="flex-1 min-w-0 py-1 flex flex-col justify-center gap-0.5">
          <motion.div className="font-medium text-sm truncate text-foreground">
            {song.song_name}
          </motion.div>
          <motion.div className="text-xs text-muted-foreground/70 flex items-center gap-1.5 truncate">
            <span className="truncate">{song.artist}</span>
            {song.genre ? (
              <>
                <span className="opacity-40">·</span>
                <span className="truncate opacity-70">{song.genre}</span>
              </>
            ) : null}
          </motion.div>
          {(bpm || key) && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
              {bpm ? <span>{bpm} BPM</span> : null}
              {bpm && key ? <span>·</span> : null}
              {key ? <span>{key}</span> : null}
            </div>
          )}
        </motion.div>

        {overlap ? (
          <span
            className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 shrink-0"
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
              className="h-8 w-8 rounded-xl text-muted-foreground/50 hover:text-destructive hover:bg-destructive/8"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              title="הסר"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : null}
      </motion.div>
    );
  },
);
