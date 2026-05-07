import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { MsHit } from '../../lib/meilisearch';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { RefObject } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function formatTime(seconds: number) {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface MiniPlayerProps {
  currentSong: MsHit | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  audioRef: RefObject<HTMLAudioElement | null>;
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
  onEnded: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function MiniPlayer({
  currentSong,
  isPlaying,
  currentTime,
  duration,
  volume,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  audioRef,
  onTimeUpdate,
  onLoadedMetadata,
  onEnded,
  onPrev,
  onNext,
}: MiniPlayerProps) {
  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
      />
      <div
        data-testid="mini-player"
        className="fixed bottom-0 left-0 right-0 h-20 border-t border-black/[0.07] flex items-center px-6 z-50"
        style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 -1px 0 rgba(0,0,0,0.06), 0 -8px 24px rgba(0,0,0,0.05)',
        }}
      >
        <AnimatePresence mode="wait">
          {!currentSong ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full text-center text-muted-foreground/60 text-sm"
            >
              בחר שיר מהפלייליסט להשמעה
            </motion.div>
          ) : (
            <motion.div
              key={currentSong.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="w-full flex items-center justify-between"
            >
              {/* Song Info */}
              <div className="flex-1 min-w-0 flex items-center gap-4">
                <div className="w-11 h-11 bg-primary/10 rounded-xl border border-primary/20 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Play className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate text-sm text-foreground">{currentSong.song_name}</div>
                  <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
                    <span>{currentSong.artist}</span>
                    {!currentSong.audio_url && (
                      <span className="bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded-md text-[10px] font-medium">
                        אין אודיו
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex-[2] flex flex-col items-center justify-center gap-2 max-w-xl px-4">
                <div className="flex items-center gap-3">
                  <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
                    <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground hover:text-foreground h-8 w-8" onClick={onNext}>
                      <SkipForward className="w-4 h-4" />
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}>
                    <Button
                      data-testid="play-pause-button"
                      variant="default"
                      size="icon"
                      disabled={!currentSong.audio_url}
                      className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
                      onClick={onTogglePlay}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </Button>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
                    <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground hover:text-foreground h-8 w-8" onClick={onPrev}>
                      <SkipBack className="w-4 h-4" />
                    </Button>
                  </motion.div>
                </div>
                <div className="w-full flex items-center gap-3 text-xs text-muted-foreground" style={{ fontFamily: "'Space Grotesk', monospace" }}>
                  <span className="tabular-nums w-8 text-center">{formatTime(currentTime)}</span>
                  <input
                    data-testid="seek-bar"
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    disabled={!currentSong.audio_url}
                    onChange={(e) => onSeek(Number(e.target.value))}
                    className="flex-1 h-1 rounded-full appearance-none bg-black/10 accent-primary focus:outline-none disabled:opacity-30"
                    style={{
                      background: currentSong.audio_url
                        ? `linear-gradient(to left, hsl(var(--primary)) ${(currentTime / (duration || 1)) * 100}%, rgba(0,0,0,0.1) ${(currentTime / (duration || 1)) * 100}%)`
                        : 'rgba(0,0,0,0.08)',
                    }}
                  />
                  <span className="tabular-nums w-8 text-center">{formatTime(duration)}</span>
                </div>
              </div>

              {/* Volume */}
              <div className="flex-1 flex justify-end items-center gap-3">
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground h-8 w-8" onClick={() => onVolumeChange(volume === 0 ? 1 : 0)}>
                    {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>
                </motion.div>
                <Slider
                  value={[volume * 100]}
                  max={100}
                  step={1}
                  onValueChange={(val) => onVolumeChange(val[0] / 100)}
                  className="w-20 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 10px;
          width: 10px;
          border-radius: 50%;
          background: hsl(var(--primary));
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
          transition: transform 0.1s;
        }
        input[type="range"]:hover::-webkit-slider-thumb {
          transform: scale(1.3);
        }
      `}</style>
    </>
  );
}
