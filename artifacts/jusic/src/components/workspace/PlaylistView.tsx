import { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Download, Loader2, Music, Search, Trash2 } from 'lucide-react';
import { MsHit } from '../../lib/meilisearch';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';
import { exportPlaylistToCsv } from '@/lib/export';
import { toast } from 'sonner';
import { TrackRow, TRACK_ROW_HEIGHT } from './TrackRow';
import { usePlaylistOverlap } from '@/hooks/use-playlist-overlap';
import { useOptionalPlayer, isSongPlaying } from '@/contexts/PlayerContext';
import { canonicalSongKey } from '@workspace/playlist-validation';
import { trackRowKey } from '@/lib/track-format';

interface PlaylistViewProps {
  playlistName: string;
  setPlaylistName: (name: string) => void;
  songs: MsHit[];
  removeSong: (index: number) => void;
  removeSongsById: (ids: Set<string>) => void;
  reorderSongs: (startIndex: number, endIndex: number) => void;
  clearPlaylist: () => void;
  className?: string;
}

function SortableTrackRow({
  song,
  index,
  overlap,
  selectionMode,
  isSelected,
  onToggleSelect,
  onRemove,
  onPlay,
}: {
  song: MsHit;
  index: number;
  overlap?: { playlistName: string; count: number };
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
  onPlay: () => void;
}) {
  const player = useOptionalPlayer();
  const playing = isSongPlaying(player, song);
  const id = trackRowKey(song);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: selectionMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TrackRow
      ref={setNodeRef}
      style={style}
      song={song}
      index={index}
      showIndex
      isPlaying={playing}
      isDragging={isDragging}
      isSelected={isSelected}
      selectionMode={selectionMode}
      onPlay={onPlay}
      onRemove={selectionMode ? undefined : onRemove}
      onToggleSelect={onToggleSelect}
      dragHandleProps={selectionMode ? undefined : { attributes, listeners }}
      statusLabel={overlap ? 'חפיפה' : undefined}
      statusTone="warning"
    />
  );
}

function PlaylistViewInner({
  playlistName,
  setPlaylistName,
  songs,
  removeSong,
  removeSongsById,
  reorderSongs,
  clearPlaylist,
  className,
}: PlaylistViewProps) {
  const [exporting, setExporting] = useState(false);
  const [filter, setFilter] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const player = useOptionalPlayer();
  const overlapMap = usePlaylistOverlap(songs, playlistName);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const filteredSongs = useMemo(
    () =>
      filter.trim()
        ? songs.filter((s) => {
            const q = filter.trim().toLowerCase();
            return (
              s.song_name.toLowerCase().includes(q) ||
              s.artist.toLowerCase().includes(q)
            );
          })
        : songs,
    [songs, filter],
  );

  const songIndexById = useMemo(() => {
    const map = new Map<string, number>();
    songs.forEach((s, i) => map.set(trackRowKey(s), i));
    return map;
  }, [songs]);

  const sortableIds = useMemo(
    () => filteredSongs.map((s) => trackRowKey(s)),
    [filteredSongs],
  );

  const virtualizer = useVirtualizer({
    count: filteredSongs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => TRACK_ROW_HEIGHT,
    overscan: 18,
    getItemKey: (index) => sortableIds[index] ?? String(index),
  });

  const handleExportCsv = useCallback(() => {
    if (!songs.length || exporting) return;
    setExporting(true);
    const toastId = toast.loading('מייצא CSV...');
    void exportPlaylistToCsv(playlistName, songs)
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'שגיאה בייצוא');
      })
      .finally(() => {
        toast.dismiss(toastId);
        setExporting(false);
      });
  }, [songs, exporting, playlistName]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || filter.trim()) return;
    const oldIndex = songs.findIndex((s) => trackRowKey(s) === active.id);
    const newIndex = songs.findIndex((s) => trackRowKey(s) === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    reorderSongs(oldIndex, newIndex);
  }, [filter, songs, reorderSongs]);

  const toggleSelect = useCallback((song: MsHit) => {
    const key = trackRowKey(song);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedKeys(new Set());
  }, []);

  const removeSelected = useCallback(() => {
    removeSongsById(selectedKeys);
    exitSelectionMode();
  }, [removeSongsById, selectedKeys, exitSelectionMode]);

  const handlePlay = useCallback((song: MsHit) => {
    if (!player) return;
    if (isSongPlaying(player, song)) {
      player.togglePlay();
    } else {
      player.playSong(song);
    }
  }, [player]);

  return (
    <div
      className={cn('relative flex flex-1 flex-col min-h-0 overflow-hidden', className)}
      data-testid="playlist-container"
    >
      <div className="ws-canvas-toolbar shrink-0 flex flex-wrap items-center gap-2 px-2 py-1.5 border-b border-border/30">
        <Input
          data-testid="playlist-name-input"
          type="text"
          aria-label="שם הפלייליסט"
          placeholder="שם הפלייליסט"
          value={playlistName}
          onChange={(e) => setPlaylistName(e.target.value)}
          onBlur={(e) => {
            const trimmed = e.target.value.trim();
            if (trimmed !== playlistName) setPlaylistName(trimmed || 'פלייליסט חדש');
          }}
          className="h-8 flex-1 min-w-[8rem] max-w-xs text-xs font-semibold rounded-lg bg-[hsl(var(--surface-1))] border-border/40"
        />
        <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
          {songs.length} שירים
        </span>
        <Input
          type="search"
          placeholder="סינון…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 w-24 sm:w-28 text-xs rounded-lg"
          dir="rtl"
        />
        <div className="flex items-center gap-1 ms-auto">
          {selectionMode ? (
            <>
              <Button variant="outline" size="sm" className="h-7 text-[10px] rounded-lg" onClick={exitSelectionMode}>
                ביטול
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-[10px] rounded-lg"
                disabled={!selectedKeys.size}
                onClick={removeSelected}
              >
                <Trash2 className="w-3 h-3 ml-0.5" />
                ({selectedKeys.size})
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] rounded-lg"
              onClick={clearPlaylist}
              disabled={!songs.length}
            >
              נקה
            </Button>
          )}
          <Button
            data-testid="export-csv-button"
            size="sm"
            className="h-7 text-[10px] rounded-lg px-2"
            onClick={handleExportCsv}
            disabled={!songs.length || exporting}
          >
            {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {songs.length === 0 ? (
          <div className="absolute inset-4 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-border/40 bg-[hsl(var(--surface-1)/0.5)]">
            <Search className="w-5 h-5 text-primary/70 mb-2" />
            <p className="text-xs font-medium text-muted-foreground">חפשו בקטלוג והוסיפו שירים</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <div
                ref={scrollRef}
                className="h-full overflow-y-auto overflow-x-hidden custom-scrollbar ws-track-list"
              >
                <div
                  className="relative w-full"
                  style={{ height: `${virtualizer.getTotalSize()}px`, contain: 'layout style' }}
                >
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const song = filteredSongs[virtualRow.index]!;
                    const id = trackRowKey(song);
                    const fullIndex = songIndexById.get(id) ?? virtualRow.index;
                    const overlap = overlapMap.get(canonicalSongKey(song));
                    return (
                      <div
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        className="absolute top-0 left-0 w-full"
                        style={{ transform: `translateY(${virtualRow.start}px)` }}
                      >
                        <SortableTrackRow
                          song={song}
                          index={fullIndex}
                          overlap={overlap}
                          selectionMode={selectionMode}
                          isSelected={selectedKeys.has(id)}
                          onToggleSelect={() => toggleSelect(song)}
                          onRemove={() => removeSong(fullIndex)}
                          onPlay={() => handlePlay(song)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </SortableContext>
          </DndContext>
        )}
        {filter.trim() ? (
          <p className="absolute bottom-1 inset-x-2 text-[9px] text-amber-700/90 dark:text-amber-400 text-center pointer-events-none">
            גרירה מושבתת בזמן סינון
          </p>
        ) : null}
      </div>
    </div>
  );
}

export const PlaylistView = memo(PlaylistViewInner);
