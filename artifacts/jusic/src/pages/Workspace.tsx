import { usePlaylist } from '../hooks/use-playlist';
import { SearchBar } from '../components/workspace/SearchBar';
import { PlaylistView } from '../components/workspace/PlaylistView';
import { AIPanel } from '../components/workspace/AIPanel';
import { BulkPanel } from '../components/workspace/BulkPanel';
import { ApiStatusIndicator } from '../components/workspace/ApiStatusIndicator';
import { WorkspaceHelpPopover } from '../components/workspace/WorkspaceHelpPopover';
import { LearningExportButton } from '../components/workspace/LearningExportButton';

export default function Workspace() {
  const playlist = usePlaylist();

  return (
    <div
      className="flex flex-col h-[100dvh] w-full overflow-hidden text-foreground"
      style={{
        background:
          'radial-gradient(ellipse at 10% 20%, rgba(0,180,180,0.05) 0%, transparent 50%), radial-gradient(ellipse at 90% 80%, rgba(0,120,200,0.04) 0%, transparent 50%), hsl(var(--background))',
      }}
    >
      <header
        className="flex-shrink-0 min-h-20 flex items-center justify-between gap-3 px-6 py-3 border-b border-black/[0.06] z-40"
        style={{
          background: 'rgba(255,255,255,0.78)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 1px 0 rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex items-center gap-3 w-48 shrink-0">
          <img src="/logo.png" alt="BUILD PLAY" className="h-9 w-auto object-contain" />
          <div className="flex flex-col leading-none">
            <span
              className="text-xl font-black text-primary tracking-widest"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              BUILD PLAY
            </span>
            <span className="text-muted-foreground text-[10px] font-medium tracking-widest">
              עמדת עריכה
            </span>
          </div>
        </div>
        <div className="flex-1 max-w-3xl mx-4 min-w-0">
          <SearchBar onAddSong={playlist.addSong} />
        </div>
        <div className="flex items-center justify-end gap-1 shrink-0">
          <ApiStatusIndicator />
          <LearningExportButton />
          <WorkspaceHelpPopover />
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden min-h-0">
        <BulkPanel onAddSongs={playlist.addSongs} />
        <PlaylistView
          playlistName={playlist.playlistName}
          setPlaylistName={playlist.setPlaylistName}
          songs={playlist.songs}
          removeSong={playlist.removeSong}
          reorderSongs={playlist.reorderSongs}
          clearPlaylist={playlist.clearPlaylist}
        />
        <AIPanel onAddSongs={playlist.addSongs} />
      </main>
    </div>
  );
}
