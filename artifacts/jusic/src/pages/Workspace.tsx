import { usePlaylist } from "../hooks/use-playlist";
import { SearchBar } from "../components/workspace/SearchBar";
import { PlaylistView } from "../components/workspace/PlaylistView";
import { ASIComposerPanel } from "../components/workspace/ASIComposerPanel";
import { ApiStatusIndicator } from "../components/workspace/ApiStatusIndicator";
import { WorkspaceHelpPopover } from "../components/workspace/WorkspaceHelpPopover";
import { LearningExportButton } from "../components/workspace/LearningExportButton";
import { OfflinePlaylistMasterDialog } from "../components/workspace/OfflinePlaylistMasterDialog";
import { InstallAppButton } from "../components/workspace/InstallAppButton";
import { APP_LOGO_URL } from "@/lib/brand";

type WorkspaceProps = {
  operatorName: string;
  offline?: boolean;
};

export default function Workspace({ operatorName, offline = false }: WorkspaceProps) {
  const playlist = usePlaylist();
  return (
    <div className="app-shell-bg flex flex-col h-[100dvh] w-full overflow-hidden text-foreground selection:bg-primary/20 selection:text-foreground">
      <header className="bp-glass-strip flex-shrink-0 flex flex-wrap md:flex-nowrap items-center justify-between gap-2 sm:gap-3 px-3 sm:px-5 lg:px-7 py-2.5 sm:py-3.5 z-40 pt-[max(env(safe-area-inset-top,0px),0.625rem)] sm:pt-3.5">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 shrink-0">
          <span className="relative rounded-[1rem] bp-gradient-border p-[2px] shadow-[0_12px_32px_-8px_rgba(6,182,212,0.45)]">
            <span className="block rounded-[0.9375rem] bg-card/90 p-[2px]">
              <img
                src={APP_LOGO_URL}
                alt="BUILD PLAY"
                className="h-9 w-9 sm:h-[2.6rem] sm:w-[2.6rem] rounded-[0.8rem] object-cover"
              />
            </span>
          </span>
          <div className="flex flex-col leading-tight min-w-0 gap-0.5">
            <span className="font-display text-[0.9375rem] sm:text-xl font-black tracking-[0.12em] sm:tracking-[0.22em] uppercase bg-gradient-to-l from-primary via-emerald-500 to-indigo-500 bg-clip-text text-transparent whitespace-nowrap">
              BUILD PLAY
            </span>
            <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/90">
              עמדת פלייליסט חיה
            </span>
            <span
              className="text-[10px] text-primary/90 truncate max-w-[14rem] sm:max-w-[18rem]"
              title={operatorName}
            >
              גורם מטפל: {operatorName}
              {offline ? ' · מצב לא מקוון' : ''}
            </span>
          </div>
        </div>
        <div className="order-3 md:order-none w-full md:flex-1 md:max-w-3xl md:mx-3 lg:mx-6 min-w-0">
          <SearchBar onAddSong={playlist.addSong} />
        </div>
        <div className="flex flex-wrap md:flex-nowrap items-center justify-end gap-1 sm:gap-1 shrink-0 rounded-2xl md:rounded-none border md:border-transparent border-border/50 bg-muted/25 md:bg-transparent px-1 py-1">
          <ApiStatusIndicator />
          <InstallAppButton />
          <OfflinePlaylistMasterDialog />
          <LearningExportButton />
          <WorkspaceHelpPopover />
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 gap-px md:gap-0 p-0 sm:p-2 md:p-2.5 pb-[max(env(safe-area-inset-bottom,0px),0.5rem)]">
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
