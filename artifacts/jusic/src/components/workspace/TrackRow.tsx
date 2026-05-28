import { forwardRef, type ReactNode } from 'react';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';
import { GripVertical, Pause, Play, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusChip, type StatusChipTone } from '@/components/ui/status-chip';
import type { MsHit } from '@/lib/meilisearch';
import { formatTrackDuration, getTrackVibeLabel } from '@/lib/track-format';

export const TRACK_ROW_HEIGHT = 34;

export type TrackRowProps = {
  song: MsHit;
  index?: number;
  /** Compact spreadsheet row (default). */
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

export const TrackRow = forwardRef<HTMLDivElement, TrackRowProps>(function TrackRow(
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
  const rowH = density === 'compact' ? TRACK_ROW_HEIGHT : 36;

  return (
    <div
      ref={ref}
      style={{ ...style, minHeight: rowH, height: rowH }}
      data-testid={testId}
      className={cn(
        'ws-track-row group relative flex items-center gap-1.5 px-1.5 text-[11px] leading-none',
        'border-b border-border/35 transition-colors duration-150',
        isDragging && 'ws-track-row--dragging z-50',
        isSelected && 'bg-primary/10',
        isDropTarget && 'bg-primary/6',
        !isDragging && !isSelected && 'hover:bg-[hsl(var(--surface-2)/0.65)]',
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
          <GripVertical className="h-3 w-3 opacity-50" />
        </button>
      ) : null}

      {selectionMode ? (
        <span
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] font-bold',
            isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60',
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
              {isPlaying ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5" />}
            </button>
          ) : null}
        </span>
      ) : null}

      <div className="ws-track-row__title min-w-0 flex-1 truncate font-medium text-foreground">
        {song.song_name}
      </div>

      <div className="ws-track-row__artist hidden min-w-0 max-w-[28%] truncate text-muted-foreground sm:block">
        {song.artist}
      </div>

      {vibe ? (
        <StatusChip tone="primary" className="ws-track-row__chip hidden md:inline-flex px-1.5 py-0 text-[9px]">
          {vibe}
        </StatusChip>
      ) : null}

      {statusLabel ? (
        <StatusChip tone={statusTone} className="ws-track-row__chip hidden lg:inline-flex px-1.5 py-0 text-[9px]">
          {statusLabel}
        </StatusChip>
      ) : null}

      {showDuration ? (
        <span className="ws-track-row__duration tabular-nums text-muted-foreground/80 shrink-0 w-9 text-left">
          {formatTrackDuration(song)}
        </span>
      ) : null}

      {trailing}

      {onAdd ? (
        <button
          type="button"
          className="ws-track-row__action opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          aria-label="הוסף"
        >
          <Plus className="h-3 w-3" />
        </button>
      ) : null}

      {onRemove ? (
        <button
          type="button"
          className="ws-track-row__action ws-track-row__action--danger opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="הסר"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
});
