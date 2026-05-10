import { useRef } from 'react';
import { MsHit } from '../../lib/meilisearch';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useVirtualizer } from '@tanstack/react-virtual';
import { GripVertical, X, Download, Trash2, Search, Music } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { exportToOdooCSV } from '../../lib/export';
import { recordPlaylistExport } from '../../lib/playlist-learning';
import { motion } from 'framer-motion';

interface PlaylistViewProps {
  playlistName: string;
  setPlaylistName: (name: string) => void;
  songs: MsHit[];
  removeSong: (index: number) => void;
  reorderSongs: (startIndex: number, endIndex: number) => void;
  clearPlaylist: () => void;
}

export function PlaylistView({
  playlistName,
  setPlaylistName,
  songs,
  removeSong,
  reorderSongs,
  clearPlaylist,
}: PlaylistViewProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: songs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 8,
  });

  const onDragEnd = (result: {
    destination?: { index: number } | null;
    source: { index: number };
  }) => {
    if (!result.destination) return;
    reorderSongs(result.source.index, result.destination.index);
  };

  const handleExport = () => {
    recordPlaylistExport(playlistName, songs);
    exportToOdooCSV(playlistName, songs);
  };

  return (
    <div
      className="flex-1 flex flex-col h-full overflow-hidden"
      data-testid="playlist-container"
      style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.64) 0%, rgba(255,255,255,0.4) 100%)' }}
    >
      <div
        className="flex items-center justify-between px-5 py-3 border-b border-black/[0.06] flex-shrink-0"
        style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)' }}
      >
        <div className="flex items-center gap-3 flex-1 max-w-sm">
          <Input
            data-testid="playlist-name-input"
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
            className="text-base font-bold bg-transparent border-transparent hover:border-black/10 focus:bg-white h-9 px-2 rounded-xl text-foreground shadow-none"
          />
          <span
            className="text-muted-foreground text-xs whitespace-nowrap bg-primary/10 text-primary border border-primary/15 px-2.5 py-1 rounded-lg tabular-nums"
            style={{ fontFamily: "'Space Grotesk', monospace" }}
          >
            {songs.length} שירים
          </span>
        </div>
        <div className="flex items-center gap-2">
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearPlaylist}
              disabled={!songs.length}
              className="text-muted-foreground hover:text-destructive rounded-xl text-xs"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> נקה
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button
              data-testid="export-csv-button"
              size="sm"
              onClick={handleExport}
              disabled={!songs.length}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl shadow-sm text-xs"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> ייצוא לאודו
            </Button>
          </motion.div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {songs.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/40">
            <Search className="w-10 h-10 mb-3" />
            <p className="text-sm">בחר פילטרים למעלה, חפש והוסף שירים</p>
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
                  className="flex items-center gap-3 px-4 py-3 mx-3 bg-white border border-primary/20 shadow-[0_4px_20px_rgba(0,0,0,0.12)] rounded-2xl"
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
                  className="h-full overflow-y-auto px-4 py-3 custom-scrollbar"
                >
                  <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const song = songs[virtualRow.index];

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
                                className={`flex items-center group h-full rounded-xl border transition-colors ${
                                  snapshot.isDragging
                                    ? 'bg-white border-primary/25 shadow-[0_10px_24px_rgba(16,40,70,0.12)] z-50'
                                    : 'bg-white/70 border-black/[0.05] hover:bg-white hover:border-black/[0.08] hover:shadow-[0_6px_18px_rgba(16,40,70,0.06)]'
                                }`}
                                transition={{ duration: 0.1 }}
                              >
                                <div {...provided.dragHandleProps} className="px-3 py-2 text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0">
                                  <motion.div whileHover={{ scale: 1.2 }} transition={{ duration: 0.1 }}>
                                    <GripVertical className="w-3.5 h-3.5" />
                                  </motion.div>
                                </div>

                                <div
                                  className="w-7 text-center text-xs tabular-nums flex-shrink-0 text-muted-foreground"
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

                                <div className="flex items-center gap-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
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
