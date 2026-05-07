import { usePlaylist } from '../hooks/use-playlist';
import { usePlayer } from '../hooks/use-player';
import { SearchBar } from '../components/workspace/SearchBar';
import { PlaylistView } from '../components/workspace/PlaylistView';
import { MiniPlayer } from '../components/workspace/MiniPlayer';
import { AIPanel } from '../components/workspace/AIPanel';
import { BulkPanel } from '../components/workspace/BulkPanel';
import { MsHit } from '../lib/meilisearch';

export default function Workspace() {
  const playlist = usePlaylist();
  const player = usePlayer();

  const handlePlaySong = (song: MsHit) => player.playSong(song);

  const handlePrev = () => {
    if (!player.currentSong || !playlist.songs.length) return;
    const idx = playlist.songs.findIndex(s => s.id === player.currentSong!.id);
    if (idx === -1) return;
    player.playSong(playlist.songs[(idx - 1 + playlist.songs.length) % playlist.songs.length]);
  };

  const handleNext = () => {
    if (!player.currentSong || !playlist.songs.length) return;
    const idx = playlist.songs.findIndex(s => s.id === player.currentSong!.id);
    if (idx === -1) return;
    player.playSong(playlist.songs[(idx + 1) % playlist.songs.length]);
  };

  return (
    <div
      className="flex flex-col h-[100dvh] w-full overflow-hidden text-foreground"
      style={{
        background: 'radial-gradient(ellipse at 10% 20%, rgba(0,180,180,0.05) 0%, transparent 50%), radial-gradient(ellipse at 90% 80%, rgba(0,120,200,0.04) 0%, transparent 50%), hsl(var(--background))',
      }}
    >
      {/* HEADER */}
      <header
        className="flex-shrink-0 h-20 flex items-center justify-between px-6 border-b border-black/[0.06] z-40"
        style={{ background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center gap-3 w-48">
          <img src="/logo.png" alt="BUILD PLAY" className="h-9 w-auto object-contain" />
          <div className="flex flex-col leading-none">
            <span className="text-xl font-black text-primary tracking-widest" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>BUILD PLAY</span>
            <span className="text-muted-foreground text-[10px] font-medium tracking-widest">עמדת עריכה</span>
          </div>
        </div>
        <div className="flex-1 max-w-2xl mx-8">
          <SearchBar onAddSong={playlist.addSong} />
        </div>
        <div className="w-48" />
      </header>

      {/* MAIN */}
      <main className="flex-1 flex overflow-hidden mb-20">
        <BulkPanel onAddSongs={playlist.addSongs} />
        <PlaylistView
          playlistName={playlist.playlistName}
          setPlaylistName={playlist.setPlaylistName}
          songs={playlist.songs}
          removeSong={playlist.removeSong}
          reorderSongs={playlist.reorderSongs}
          clearPlaylist={playlist.clearPlaylist}
          onPlaySong={handlePlaySong}
          currentPlayingId={player.currentSong?.id}
        />
        <AIPanel onAddSongs={playlist.addSongs} />
      </main>

      <MiniPlayer
        currentSong={player.currentSong}
        isPlaying={player.isPlaying}
        currentTime={player.currentTime}
        duration={player.duration}
        volume={player.volume}
        onTogglePlay={player.togglePlay}
        onSeek={player.handleSeek}
        onVolumeChange={player.handleVolume}
        audioRef={player.audioRef}
        onTimeUpdate={player.handleTimeUpdate}
        onLoadedMetadata={player.handleLoadedMetadata}
        onEnded={player.handleEnded}
        onPrev={handlePrev}
        onNext={handleNext}
      />
    </div>
  );
}
