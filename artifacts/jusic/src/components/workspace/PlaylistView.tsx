import { useCallback, useMemo, useRef, useState } from 'react';
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
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion';
import { Download, Loader2, Music, Search, Trash2 } from 'lucide-react';
import { MsHit } from '../../lib/meilisearch';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';
import { exportPlaylistToCsv } from '@/lib/export';
import { toast } from 'sonner';
import { TrackCard } from './TrackCard';
import { usePlaylistOverlap } from '@/hooks/use-playlist-overlap';
import { useOptionalPlayer, isSongPlaying } from '@/contexts/PlayerContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { canonicalSongKey } from '@workspace/playlist-validation';

const LONG_PRESS_MS = 480;
const SWIPE_REMOVE_THRESHOLD = -72;

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
  onEnterSelectionMode,
}: {
  song: MsHit;
  index: number;
  overlap?: { playlistName: string; count: number };
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
  onPlay: () => void;
  onEnterSelectionMode: () => void;
}) {
  const isMobile = useIsMobile();
  const player = useOptionalPlayer();
  const playing = isSongPlaying(player, song);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragX = useMotionValue(0);
  const deleteOpacity = useTransform(dragX, [-96, -48, 0], [1, 0.6, 0]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: song._id || song.id, disabled: selectionMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerDown = () => {
    if (!isMobile || selectionMode) return;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      onEnterSelectionMode();
      onToggleSelect();
      if (navigator.vibrate) navigator.vibrate(12);
    }, LONG_PRESS_MS);
  };

  const handleDragEndSwipe = (_: unknown, info: { offset: { x: number } }) => {
    if (selectionMode) return;
    if (info.offset.x < SWIPE_REMOVE_THRESHOLD) {
      onRemove();
      if (navigator.vibrate) navigator.vibrate(8);
    }
    dragX.set(0);
  };

  return (
    <motion.div className="relative my-[5px]">
      <motion.div
        className="absolute inset-y-0 left-0 flex items-center justify-end px-4 rounded-[0.875rem] bg-destructive/15 border border-destructive/25 sm:hidden"
        style={{ opacity: deleteOpacity }}
        aria-hidden
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </motion.div>
      <motion.div
        drag={isMobile && !selectionMode ? 'x' : false}
        dragConstraints={{ left: -120, right: 0 }}
        dragElastic={0.12}
        style={{ x: dragX }}
        onDragEnd={handleDragEndSwipe}
        onDrag={(_, info) => dragX.set(Math.min(0, info.offset.x))}
      >
        <TrackCard
          ref={setNodeRef}
          style={style}
          song={song}
          index={index}
          overlap={overlap}
          isPlaying={playing}
          isDragging={isDragging}
          isSelected={isSelected}
          selectionMode={selectionMode}
          onPlay={onPlay}
          onRemove={onRemove}
          onToggleSelect={onToggleSelect}
          onLongPressStart={handlePointerDown}
          onLongPressEnd={clearLongPress}
          dragHandleProps={selectionMode ? undefined : { attributes, listeners }}
        />
      </motion.div>
    </motion.div>
  );
}

export function PlaylistView({
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
  const player = useOptionalPlayer();
  const overlapMap = usePlaylistOverlap(songs, playlistName);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
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
    songs.forEach((s, i) => map.set(s._id || s.id, i));
    return map;
  }, [songs]);

  const sortableIds = useMemo(
    () => filteredSongs.map((s) => s._id || s.id),
    [filteredSongs],
  );

  const handleExportCsv = () => {
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
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || filter.trim()) return;
    const oldIndex = songs.findIndex((s) => (s._id || s.id) === active.id);
    const newIndex = songs.findIndex((s) => (s._id || s.id) === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    reorderSongs(oldIndex, newIndex);
  };

  const toggleSelect = useCallback((song: MsHit) => {
    const key = song._id || song.id;
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedKeys(new Set());
  };

  const removeSelected = () => {
    removeSongsById(selectedKeys);
    exitSelectionMode();
  };

  const handlePlay = (song: MsHit) => {
    if (!player) return;
    if (isSongPlaying(player, song)) {
      player.togglePlay();
    } else {
      player.playSong(song);
    }
  };

  return (
    <div
      className={cn(
        'relative flex-1 flex flex-col min-h-0 overflow-hidden md:rounded-[1.35rem] md:ml-2 border-0 md:border border-border/40 bg-transparent',
        className,
      )}
      data-testid="playlist-container"
    >
      <motion.div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-primary/55 via-transparent to-primary/55 opacity-75" aria-hidden />
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 px-3 sm:px-5 pt-4 pb-3 flex-shrink-0 border-b border-border/45 bg-gradient-to-b from-card/80 to-transparent">
        <div className="flex flex-col gap-2 w-full sm:flex-1 sm:max-w-md min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">
            <Music className="h-3.5 w-3.5 text-primary" />
            <span>Creative Workflow</span>
          </div>
          <motion.div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <Input
              data-testid="playlist-name-input"
              type="text"
              aria-label="שם הפלייליסט"
              placeholder="שם הפלייליסט (ריק = לפי נושא/פרשה)"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              onBlur={(e) => {
                const trimmed = e.target.value.trim();
                if (trimmed !== playlistName) setPlaylistName(trimmed || 'פלייליסט חדש');
              }}
              className="w-full min-w-0 font-display text-[1rem] sm:text-lg font-bold bg-background/70 border-border/55 hover:border-primary/25 focus-visible:ring-2 focus-visible:ring-primary/25 h-10 sm:h-11 px-3 rounded-2xl text-foreground"
            />
            <span
              className="font-display self-start sm:self-auto shrink-0 text-primary text-xs whitespace-nowrap bg-primary/10 border border-primary/25 px-3 py-1.5 rounded-xl tabular-nums font-semibold"
              title="שירים בפלייליסט — בייצוא יישמרו שמות קנוניים ממסד ג'וזיק"
            >
              {songs.length} שירים · ייצוא Lomdaat
            </span>
          </motion.div>
          <Input
            type="search"
            placeholder="סינון שירים..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-9 rounded-xl text-sm"
            dir="rtl"
          />
          {filter.trim() ? (
            <p className="text-[10px] text-amber-600 dark:text-amber-400">
              גרירה מושבתת בזמן סינון — נקו את הסינון לסידור מחדש
            </p>
          ) : null}
        </div>
        <div className="flex items-center justify-stretch sm:justify-end gap-2 w-full sm:w-auto shrink-0">
          {selectionMode ? (
            <>
              <Button variant="outline" size="sm" onClick={exitSelectionMode} className="rounded-xl text-xs">
                ביטול
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!selectedKeys.size}
                onClick={removeSelected}
                className="rounded-xl text-xs"
              >
                <Trash2 className="w-3.5 h-3.5 ml-1" />
                הסר ({selectedKeys.size})
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={clearPlaylist}
              disabled={!songs.length}
              className="w-full sm:w-auto text-muted-foreground hover:text-destructive hover:border-destructive/40 rounded-xl text-xs border-border/60 bg-background/50"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> נקה
            </Button>
          )}
          <Button
            data-testid="export-csv-button"
            size="sm"
            onClick={handleExportCsv}
            disabled={!songs.length || exporting}
            className="w-full sm:w-auto rounded-full text-xs font-semibold min-h-[2.35rem] sm:min-h-[2rem]"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 mr-1.5" />
            )}
            ייצוא CSV
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative bg-gradient-to-b from-transparent to-muted/[0.12] min-h-0">
        {songs.length === 0 ? (
          <div className="absolute inset-6 sm:inset-10 flex flex-col items-center justify-center text-center px-6 rounded-[1.5rem] border border-dashed border-primary/22 bg-muted/30">
            <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-[hsl(var(--mesh-grey)/0.12)] text-primary border border-primary/25 shadow-sm">
              <Search className="w-7 h-7 opacity-85" />
            </span>
            <p className="text-[15px] sm:text-base font-semibold text-foreground/85 max-w-[20rem] leading-relaxed">
              התחלה קלה — חפשו למעלה, הוסיפו וסדרו בגרירה
            </p>
            <p className="mt-2 text-xs sm:text-[13px] text-muted-foreground max-w-[18rem] leading-relaxed">
              לחיצה ארוכה לבחירה מרובה · החלקה שמאלה להסרה
            </p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <div className="h-full overflow-y-auto px-3 sm:px-5 py-4 custom-scrollbar">
                <AnimatePresence initial={false}>
                  {filteredSongs.map((song) => {
                    const id = song._id || song.id;
                    const fullIndex = songIndexById.get(id) ?? 0;
                    const overlap = overlapMap.get(canonicalSongKey(song));
                    return (
                      <SortableTrackRow
                        key={id}
                        song={song}
                        index={fullIndex}
                        overlap={overlap}
                        selectionMode={selectionMode}
                        isSelected={selectedKeys.has(id)}
                        onToggleSelect={() => toggleSelect(song)}
                        onRemove={() => removeSong(fullIndex)}
                        onPlay={() => handlePlay(song)}
                        onEnterSelectionMode={() => setSelectionMode(true)}
                      />
                    );
                  })}
                </AnimatePresence>
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
