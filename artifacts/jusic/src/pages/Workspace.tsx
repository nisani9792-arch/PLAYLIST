import { lazy, Suspense, useEffect, useState } from "react";
import { usePlaylist } from "../hooks/use-playlist";
import { useIsMobile } from "../hooks/use-mobile";
import { SearchBar } from "../components/workspace/SearchBar";
import { PlaylistView } from "../components/workspace/PlaylistView";
import { ASIComposerPanel } from "../components/workspace/ASIComposerPanel";
import { ApiStatusIndicator } from "../components/workspace/ApiStatusIndicator";
import { WorkspaceHelpPopover } from "../components/workspace/WorkspaceHelpPopover";
import { LearningExportButton } from "../components/workspace/LearningExportButton";
import { InstallAppButton } from "../components/workspace/InstallAppButton";
import { APP_LOGO_URL } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { ListMusic, Sparkles } from "lucide-react";

type MobileWorkspaceTab = "playlist" | "composer";

const OfflinePlaylistMasterDialog = lazy(() =>
  import("../components/workspace/OfflinePlaylistMasterDialog").then((m) => ({
    default: m.OfflinePlaylistMasterDialog,
  })),
);

type WorkspaceProps = {
  operatorName: string;
  offline?: boolean;
};

export default function Workspace({ operatorName, offline = false }: WorkspaceProps) {
  const playlist = usePlaylist();
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<MobileWorkspaceTab>("playlist");
  const [stagingActive, setStagingActive] = useState(false);

  useEffect(() => {
    if (stagingActive && isMobile) {
      setMobileTab("composer");
    }
  }, [stagingActive, isMobile]);

  return (
    <div className="app-shell-bg flex flex-col h-[100dvh] w-full overflow-hidden text-foreground selection:bg-primary/20 selection:text-foreground">
      <header className="bp-glass-strip flex-shrink-0 flex flex-col z-40 overflow-visible pt-[max(env(safe-area-inset-top,0px),0.625rem)] sm:pt-3.5 bg-card/95">
        <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-2 sm:gap-3 px-3 sm:px-5 lg:px-7 py-2 sm:py-2.5">
          <div className="flex items-center gap-2.5 min-w-0 shrink-0">
            <span className="relative rounded-[1rem] bp-gradient-border p-[2px] shadow-[0_12px_32px_-8px_rgba(6,182,212,0.45)]">
              <span className="block rounded-[0.9375rem] bg-card p-[2px]">
                <img
                  src={APP_LOGO_URL}
                  alt="BUILD PLAY"
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-[0.8rem] object-cover"
                />
              </span>
            </span>
            <div className="flex flex-col leading-tight min-w-0 gap-0.5">
              <span className="font-display text-[0.9375rem] sm:text-lg font-black tracking-[0.12em] uppercase bg-gradient-to-l from-primary via-emerald-500 to-indigo-500 bg-clip-text text-transparent whitespace-nowrap">
                BUILD PLAY
              </span>
              <span
                className="text-[10px] text-primary/90 truncate max-w-[12rem] sm:max-w-[18rem]"
                title={operatorName}
              >
                {operatorName}
                {offline ? " · לא מקוון" : ""}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-end gap-0.5 sm:gap-1 shrink-0">
            <ApiStatusIndicator />
            <InstallAppButton />
            <Suspense fallback={null}>
              <OfflinePlaylistMasterDialog />
            </Suspense>
            <LearningExportButton />
            <WorkspaceHelpPopover />
          </div>
        </div>

        <div className="px-3 sm:px-5 lg:px-7 pb-2.5 sm:pb-3 relative z-[80] max-w-5xl mx-auto w-full">
          <SearchBar onAddSong={playlist.addSong} />
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden min-h-0 relative z-10 touch-manipulation">
        {isMobile ? (
          <div className="bp-workspace-tabs" role="tablist" aria-label="אזורי עבודה">
            <button
              type="button"
              role="tab"
              aria-selected={mobileTab === "playlist"}
              className="bp-workspace-tab"
              onClick={() => setMobileTab("playlist")}
            >
              <ListMusic className="w-4 h-4 shrink-0" />
              פלייליסט
              {playlist.songs.length > 0 ? (
                <span className="tabular-nums text-[11px] px-1.5 py-0.5 rounded-md bg-background/80">
                  {playlist.songs.length}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileTab === "composer"}
              className="bp-workspace-tab"
              onClick={() => setMobileTab("composer")}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              התאמה / AI
              {stagingActive ? (
                <span className="tabular-nums text-[11px] px-1.5 py-0.5 rounded-md bg-amber-400/30 text-amber-900">
                  פעיל
                </span>
              ) : null}
            </button>
          </div>
        ) : null}

        <div className="bp-workspace-split flex flex-col md:flex-row flex-1 gap-0 md:gap-2 p-0 md:p-2 pb-[max(env(safe-area-inset-bottom,0px),0.25rem)]">
          <PlaylistView
            playlistName={playlist.playlistName}
            setPlaylistName={playlist.setPlaylistName}
            songs={playlist.songs}
            removeSong={playlist.removeSong}
            reorderSongs={playlist.reorderSongs}
            clearPlaylist={playlist.clearPlaylist}
            className={cn(
              "bp-playlist-main order-2 md:order-1",
              isMobile && mobileTab !== "playlist" && "hidden",
            )}
          />
          <ASIComposerPanel
            onAddSongs={playlist.addSongs}
            draftHistory={playlist.draftHistory}
            onRememberDraft={playlist.rememberCurrentDraft}
            onLoadDraft={playlist.loadDraft}
            onDeleteDraft={playlist.deleteDraft}
            mobileFullScreen={isMobile}
            mobileVisible={!isMobile || mobileTab === "composer"}
            onStagingActiveChange={setStagingActive}
          />
        </div>
      </main>
    </div>
  );
}
