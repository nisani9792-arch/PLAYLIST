import { createContext, useContext, type ReactNode } from 'react';
import { usePlayer } from '@/hooks/use-player';
import type { MsHit } from '@/lib/meilisearch';
import { tracksAreSame } from '@/lib/track-format';

type PlayerContextValue = ReturnType<typeof usePlayer>;

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const player = usePlayer();
  return (
    <PlayerContext.Provider value={player}>
      {children}
      <audio
        ref={player.audioRef}
        onTimeUpdate={player.handleTimeUpdate}
        onLoadedMetadata={player.handleLoadedMetadata}
        onEnded={player.handleEnded}
        className="hidden"
        preload="none"
      />
    </PlayerContext.Provider>
  );
}

export function usePlayerContext(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayerContext must be used within PlayerProvider');
  return ctx;
}

export function useOptionalPlayer() {
  return useContext(PlayerContext);
}

export function isSongPlaying(
  player: PlayerContextValue | null,
  song: MsHit,
): boolean {
  return Boolean(player?.isPlaying && tracksAreSame(player.currentSong, song));
}
