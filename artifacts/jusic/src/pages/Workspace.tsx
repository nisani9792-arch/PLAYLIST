import { usePlaylist } from '../hooks/use-playlist';
import { useEffect } from 'react';
import { SearchBar } from '../components/workspace/SearchBar';
import { PlaylistView } from '../components/workspace/PlaylistView';
import { ASIComposerPanel } from '../components/workspace/ASIComposerPanel';
import { ApiStatusIndicator } from '../components/workspace/ApiStatusIndicator';
import { WorkspaceHelpPopover } from '../components/workspace/WorkspaceHelpPopover';
import { LearningExportButton } from '../components/workspace/LearningExportButton';
import { OfflinePlaylistMasterDialog } from '../components/workspace/OfflinePlaylistMasterDialog';

export default function Workspace() {
  const playlist = usePlaylist();
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7720/ingest/a3b66527-1e2c-496d-8748-962b4e82cf3c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0e4088'},body:JSON.stringify({sessionId:'0e4088',runId:`workspace_${Date.now()}`,hypothesisId:'H5',location:'pages/Workspace.tsx:mount',message:'Workspace mounted in running frontend bundle',data:{path:window.location.pathname},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, []);

  return (
    <div
      className="flex flex-col h-[100dvh] w-full overflow-hidden text-foreground"
      style={{
        background:
          'radial-gradient(ellipse at 8% 12%, rgba(44,173,183,0.11) 0%, transparent 48%), radial-gradient(ellipse at 92% 88%, rgba(16,112,255,0.08) 0%, transparent 46%), linear-gradient(180deg, rgba(255,255,255,0.74) 0%, rgba(255,255,255,0.35) 100%)',
      }}
    >
      <header
        className="flex-shrink-0 min-h-20 flex items-center justify-between gap-3 px-6 py-3 border-b border-black/[0.07] z-40"
        style={{
          background: 'rgba(255,255,255,0.84)',
          backdropFilter: 'blur(26px)',
          WebkitBackdropFilter: 'blur(26px)',
          boxShadow: '0 10px 30px rgba(15,35,60,0.04), 0 1px 0 rgba(0,0,0,0.05)',
        }}
      >
        <div className="flex items-center gap-3 w-48 shrink-0">
          <img src="/logo.png" alt="JUSIC MANEGE PRO" className="h-9 w-auto object-contain" />
          <div className="flex flex-col leading-none">
            <span
              className="text-xl font-black text-primary tracking-widest"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              JUSIC MANEGE
            </span>
            <span className="text-primary/60 text-[10px] font-bold tracking-[0.25em] uppercase">
              PRO
            </span>
          </div>
        </div>
        <div className="flex-1 max-w-3xl mx-4 min-w-0">
          <SearchBar onAddSong={playlist.addSong} />
        </div>
        <div className="flex items-center justify-end gap-1 shrink-0">
          <ApiStatusIndicator />
          <OfflinePlaylistMasterDialog />
          <LearningExportButton />
          <WorkspaceHelpPopover />
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden min-h-0">
        <ASIComposerPanel
          onAddSongs={playlist.addSongs}
          draftHistory={playlist.draftHistory}
          onRememberDraft={playlist.rememberCurrentDraft}
          onLoadDraft={playlist.loadDraft}
          onDeleteDraft={playlist.deleteDraft}
        />
        <PlaylistView
          playlistName={playlist.playlistName}
          setPlaylistName={playlist.setPlaylistName}
          songs={playlist.songs}
          removeSong={playlist.removeSong}
          reorderSongs={playlist.reorderSongs}
          clearPlaylist={playlist.clearPlaylist}
        />
      </main>
    </div>
  );
}
