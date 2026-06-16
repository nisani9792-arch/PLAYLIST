import { forwardRef, memo, type ReactNode } from 'react';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { GripVertical, Pause, Play, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusChip, type StatusChipTone } from '@/components/ui/status-chip';
import type { MsHit } from '@/lib/meilisearch';
import { formatTrackDuration, getTrackVibeLabel, trackRowKey } from '@/lib/track-format';

/** M3 minimum touch target (48px). */
export const TRACK_ROW_HEIGHT = 48;

export type TrackRowProps = {
  song: MsHit;
  index?: number;
  density?: 'compact' | 'comfortable';
  showThumb?: boolean;
  showIndex?: boolean;
  showDuration?: boolean;
  vibeLabel?: string | null;
  statusLabel?: string;
  statusTone?: StatusChipTone;
  isPlaying?: boolean;
  isDragging?: boolean;
  isSelected?: boolean;
  isDropTarget?: boolean;
  dropPosition?: 'before' | 'after';
  selectionMode?: boolean;
  onPlay?: () => void;
  onRemove?: () => void;
  onAdd?: () => void;
  onToggleSelect?: () => void;
  dragHandleProps?: {
    attributes: DraggableAttributes;
    listeners: SyntheticListenerMap | undefined;
  };
  trailing?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  'data-testid'?: string;
};

function coverFallback(song: MsHit): string {
  const src = song.album?.trim() || song.artist?.trim() || song.song_name;
  return src.slice(0, 1).toUpperCase();
}

const TrackRowInner = forwardRef<HTMLDivElement, TrackRowProps>(function TrackRow(
  {
    song,
    index,
    density = 'compact',
    showThumb = true,
    showIndex = false,
    showDuration = true,
    vibeLabel,
    statusLabel,
    statusTone = 'muted',
    isPlaying,
    isDragging,
    isSelected,
    isDropTarget,
    dropPosition,
    selectionMode,
    onPlay,
    onRemove,
    onAdd,
    onToggleSelect,
    dragHandleProps,
    trailing,
    className,
    style,
    'data-testid': testId,
  },
  ref,
) {
  const vibe = vibeLabel ?? getTrackVibeLabel(song);
  const rowH = density === 'compact' ? TRACK_ROW_HEIGHT : 52;

  return (
    <div
      ref={ref}
      style={{ ...style, minHeight: rowH }}
      data-testid={testId}
      data-track-id={trackRowKey(song)}
      className={cn(
        'ws-track-row group relative flex items-center gap-2 px-2 text-sm leading-tight',
        'transition-[background,transform,box-shadow] duration-150',
        'active:scale-[0.99]',
        isDragging && 'ws-track-row--dragging',
        isSelected && 'bg-primary/10',
        isDropTarget && 'bg-primary/6',
        !isDragging && !isSelected && 'hover:bg-[hsl(var(--surface-2)/0.75)]',
        className,
      )}
      onClick={selectionMode ? onToggleSelect : undefined}
    >
      {isDropTarget && dropPosition === 'before' ? (
        <span className="ws-drop-line ws-drop-line--before" aria-hidden />
      ) : null}
      {isDropTarget && dropPosition === 'after' ? (
        <span className="ws-drop-line ws-drop-line--after" aria-hidden />
      ) : null}

      {dragHandleProps ? (
        <button
          type="button"
          className="ws-track-row__grip touch-none shrink-0"
          aria-label="גרור"
          {...dragHandleProps.attributes}
          {...dragHandleProps.listeners}
        >
          <GripVertical className="h-4 w-4 opacity-50" />
        </button>
      ) : null}

      {selectionMode ? (
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold',
            isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border/50 bg-[hsl(var(--surface-2))]',
          )}
          aria-hidden
        >
          {isSelected ? '✓' : ''}
        </span>
      ) : null}

      {showIndex && index != null ? (
        <span className="ws-track-row__index tabular-nums">{index + 1}</span>
      ) : null}

      {showThumb ? (
        <span className="ws-track-row__thumb shrink-0">
          {song.cover_url ? (
            <img src={song.cover_url} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <span className="ws-track-row__thumb-fallback">{coverFallback(song)}</span>
          )}
          {onPlay ? (
            <button
              type="button"
              className={cn(
                'ws-track-row__play',
                isPlaying && 'ws-track-row__play--visible',
              )}
              onClick={(e) => {
                e.stopPropagation();
                onPlay();
              }}
              aria-label={isPlaying ? 'השהה' : 'נגן'}
            >
              {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </button>
          ) : null}
        </span>
      ) : null}

      <div className="min-w-0 flex-1 flex flex-col justify-center gap-0.5">
        <div className="ws-track-row__title line-clamp-1 font-semibold text-foreground">
          {song.song_name}
        </div>
        <div className="ws-track-row__artist line-clamp-1 text-xs text-muted-foreground sm:hidden">
          {song.artist}
        </div>
      </div>

      <div className="ws-track-row__artist hidden min-w-0 max-w-[28%] truncate text-muted-foreground sm:block">
        {song.artist}
      </div>

      {vibe ? (
        <StatusChip tone="primary" className="ws-track-row__chip hidden md:inline-flex rounded-full px-2 py-0.5 text-[10px]">
          {vibe}
        </StatusChip>
      ) : null}

      {statusLabel ? (
        <StatusChip tone={statusTone} className="ws-track-row__chip hidden lg:inline-flex rounded-full px-2 py-0.5 text-[10px]">
          {statusLabel}
        </StatusChip>
      ) : null}

      {showDuration ? (
        <span className="ws-track-row__duration tabular-nums text-muted-foreground/80 shrink-0 w-10 text-left text-xs">
          {formatTrackDuration(song)}
        </span>
      ) : null}

      {trailing}

      {onAdd ? (
        <button
          type="button"
          className="ws-track-row__action opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          aria-label="הוסף"
        >
          <Plus className="h-4 w-4" />
        </button>
      ) : null}

      {onRemove ? (
        <button
          type="button"
          className="ws-track-row__action ws-track-row__action--danger opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="הסר"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
});

function trackRowPropsAreEqual(prev: TrackRowProps, next: TrackRowProps): boolean {
  return (
    trackRowKey(prev.song) === trackRowKey(next.song) &&
    prev.index === next.index &&
    prev.density === next.density &&
    prev.showThumb === next.showThumb &&
    prev.showIndex === next.showIndex &&
    prev.showDuration === next.showDuration &&
    prev.vibeLabel === next.vibeLabel &&
    prev.statusLabel === next.statusLabel &&
    prev.statusTone === next.statusTone &&
    prev.isPlaying === next.isPlaying &&
    prev.isDragging === next.isDragging &&
    prev.isSelected === next.isSelected &&
    prev.isDropTarget === next.isDropTarget &&
    prev.dropPosition === next.dropPosition &&
    prev.selectionMode === next.selectionMode &&
    prev.className === next.className &&
    prev.onPlay === next.onPlay &&
    prev.onRemove === next.onRemove &&
    prev.onAdd === next.onAdd &&
    prev.onToggleSelect === next.onToggleSelect &&
    prev.dragHandleProps === next.dragHandleProps &&
    prev.trailing === next.trailing
  );
}

export const TrackRow = memo(TrackRowInner, trackRowPropsAreEqual);
