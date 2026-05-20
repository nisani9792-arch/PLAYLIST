import { useRef, useState } from 'react';
import { MsHit } from '../../lib/meilisearch';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useVirtualizer } from '@tanstack/react-virtual';
import { GripVertical, X, Download, Trash2, Search, Music, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';
import { exportPlaylistToCsv } from '@/lib/export';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface PlaylistViewProps {
  playlistName: string;
  setPlaylistName: (name: string) => void;
  songs: MsHit[];
  removeSong: (index: number) => void;
  reorderSongs: (startIndex: number, endIndex: number) => void;
  clearPlaylist: () => void;
  className?: string;
}

export function PlaylistView({
  playlistName,
  setPlaylistName,
  songs,
  removeSong,
  reorderSongs,
  clearPlaylist,
  className,
}: PlaylistViewProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [filter, setFilter] = useState('');

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

  const filteredSongs = filter.trim()
    ? songs.filter((s) => {
        const q = filter.trim().toLowerCase();
        return (
          s.song_name.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
        );
      })
    : songs;

  const rowVirtualizer = useVirtualizer({
    count: filteredSongs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 68,
    overscan: 8,
  });

  const onDragEnd = (result: {
    destination?: { index: number } | null;
    source: { index: number };
  }) => {
    if (!result.destination) return;
    reorderSongs(result.source.index, result.destination.index);
  };

  return (
    <div
      className={cn(
        'relative flex-1 flex flex-col min-h-0 overflow-hidden md:rounded-[1.35rem] md:ml-2 border-0 md:border border-border/40 bg-transparent',
        className,
      )}
      data-testid="playlist-container"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-l from-primary/55 via-transparent to-primary/55 opacity-75" aria-hidden />
      <div
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 px-3 sm:px-5 pt-4 pb-3 flex-shrink-0 border-b border-border/45 bg-gradient-to-b from-card/80 to-transparent"
      >
        <div className="flex flex-col gap-2 w-full sm:flex-1 sm:max-w-md min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">
            <Music className="h-3.5 w-3.5 text-primary" />
            <span>פלייליסט פעיל</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
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
              className="w-full min-w-0 font-display text-[1rem] sm:text-lg font-bold bg-background/70 border-border/55 hover:border-primary/25 focus-visible:ring-2 focus-visible:ring-primary/25 h-10 sm:h-11 px-3 rounded-2xl text-foreground"
            />
            <span
              className="font-display self-start sm:self-auto shrink-0 text-primary text-xs whitespace-nowrap bg-primary/10 border border-primary/25 px-3 py-1.5 rounded-xl tabular-nums font-semibold"
              title="שירים בפלייליסט — בייצוא יישמרו שמות קנוניים ממסד ג'וזיק"
            >
              {songs.length} שירים · ייצוא Lomdaat
            </span>
          </div>
          <Input
            type="search"
            placeholder="סינון שירים..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-9 rounded-xl text-sm"
            dir="rtl"
          />
        </div>
        <div className="flex items-center justify-stretch sm:justify-end gap-2 w-full sm:w-auto shrink-0">
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="flex-1 sm:flex-none">
            <Button
              variant="outline"
              size="sm"
              onClick={clearPlaylist}
              disabled={!songs.length}
              className="w-full sm:w-auto text-muted-foreground hover:text-destructive hover:border-destructive/40 rounded-xl text-xs border-border/60 bg-background/50"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> נקה
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="flex-1 sm:flex-none">
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
          </motion.div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative bg-gradient-to-b from-transparent to-muted/[0.12]">
        {songs.length === 0 ? (
          <div className="absolute inset-6 sm:inset-10 flex flex-col items-center justify-center text-center px-6 rounded-[1.5rem] border border-dashed border-primary/22 bg-muted/30">
            <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-[hsl(var(--mesh-grey)/0.12)] text-primary border border-primary/25 shadow-sm">
              <Search className="w-7 h-7 opacity-85" />
            </span>
            <p className="text-[15px] sm:text-base font-semibold text-foreground/85 max-w-[20rem] leading-relaxed">
              התחלה קלה — חפשו למעלה, הוסיפו וגזרו לפי הסדר הנכון
            </p>
            <p className="mt-2 text-xs sm:text-[13px] text-muted-foreground max-w-[18rem] leading-relaxed">
              גרירה לסידור, כפתור הוסף ליד כל תוצאה.
            </p>
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable
              droppableId="playlist"
              mode="virtual"
              renderClone={(provided, _snapshot, rubric) => (
                <div
                  {...provided.draggableProps}
                  {...provided.dragHandleProps}
                  ref={provided.innerRef}
                  className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 mx-2 sm:mx-3 bg-card/80 border border-primary/25 rounded-2xl j-glow-primary ring-1 ring-primary/15"
                  style={provided.draggableProps.style}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground/40" />
                  <Music className="w-4 h-4 text-primary/60" />
                  <div className="flex-1 truncate">
                    <div className="font-semibold text-sm truncate">{songs[rubric.source.index].song_name}</div>
                    <div className="text-xs text-muted-foreground truncate">{songs[rubric.source.index].artist}</div>
                  </div>
                </div>
              )}
            >
              {(provided) => (
                <div
                  ref={(node) => {
                    parentRef.current = node;
                    provided.innerRef(node);
                  }}
                  {...provided.droppableProps}
                  className="h-full overflow-y-auto px-3 sm:px-5 py-4 custom-scrollbar"
                >
                  <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const song = filteredSongs[virtualRow.index]!;

                      return (
                        <Draggable
                          key={song._id || song.id}
                          draggableId={song._id || song.id}
                          index={virtualRow.index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              style={{
                                ...provided.draggableProps.style,
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                              }}
                            >
                              <motion.div
                                className={`flex items-center group h-[calc(100%-10px)] my-[5px] rounded-[0.875rem] border transition-all duration-200 ${
                                  snapshot.isDragging
                                    ? 'bg-card border-primary/35 j-glow-primary z-50 ring-1 ring-primary/20 scale-[1.01]'
                                    : 'bg-card/75 border-border/50 hover:border-primary/28 hover:bg-primary/4'
                                }`}
                                transition={{ duration: 0.1 }}
                              >
                                <div {...provided.dragHandleProps} className="px-2 sm:px-3 py-2 text-muted-foreground/50 sm:text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0">
                                  <motion.div whileHover={{ scale: 1.2 }} transition={{ duration: 0.1 }}>
                                    <GripVertical className="w-3.5 h-3.5" />
                                  </motion.div>
                                </div>

                                <div
                                  className="w-7 sm:w-8 text-center text-[11px] font-display font-bold tabular-nums shrink-0 text-primary/85 bg-primary/[0.08] rounded-lg py-2 mx-0.5 border border-primary/15"
                                  style={{ fontFamily: "'Space Grotesk', monospace" }}
                                >
                                  {virtualRow.index + 1}
                                </div>

                                <div className="flex-1 min-w-0 px-2 py-1 flex flex-col justify-center">
                                  <div className="font-medium text-sm truncate text-foreground">
                                    {song.song_name}
                                  </div>
                                  <div className="text-xs text-muted-foreground/70 flex items-center gap-1.5 truncate">
                                    <span className="truncate">{song.artist}</span>
                                    {song.genre && (
                                      <>
                                        <span className="opacity-40">·</span>
                                        <span className="truncate opacity-70">{song.genre}</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 px-1 sm:px-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                  <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 rounded-xl text-muted-foreground/50 hover:text-destructive hover:bg-destructive/8"
                                      onClick={() => removeSong(virtualRow.index)}
                                      title="הסר"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </Button>
                                  </motion.div>
                                </div>
                              </motion.div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                  </div>
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
    </div>
  );
}
