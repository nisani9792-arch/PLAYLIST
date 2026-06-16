import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { WorkspaceFilterChips } from '@/components/workspace/WorkspaceFilterChips';
import { migrateLocalLearningOnce } from '@/lib/memory-api';
import { usePlaylist } from '../hooks/use-playlist';
import { useIsMobile } from '../hooks/use-mobile';
import { SearchBar } from '../components/workspace/SearchBar';
import { CatalogPanel } from '../components/workspace/CatalogPanel';
import { PlaylistCanvas } from '../components/workspace/PlaylistCanvas';
import { SmartComposer } from '../components/workspace/SmartComposer';
import { StagingArea } from '../components/workspace/StagingArea';
import { MobileWorkspaceNav, type MobileWorkspaceStep } from '../components/workspace/MobileWorkspaceNav';
import { WorkspaceToolsMenu } from '../components/workspace/WorkspaceToolsMenu';
import { WorkspaceSmartActions } from '../components/workspace/WorkspaceSmartActions';
import { JusicLogo } from '@/components/ui/jusic-logo';
import { useStagingSession } from '@/contexts/StagingSessionContext';
import { useSearchFilters } from '@/contexts/SearchFiltersContext';
import { setActiveParashaExportContext } from '@/lib/parasha-export-context';
import { APP_SHORT_NAME } from '@/lib/brand';
import { fillCuratorPlaylist } from '@/hooks/use-curator-build';
import { computeFillTarget, PLAYLIST_MAX } from '@workspace/curator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { MsHit } from '../lib/meilisearch';
import {
  inferPlaylistDisplayName,
  isDefaultPlaylistName,
  resolveAutoPlaylistName,
} from '@/lib/playlist-name';

function inferFillTopic(name: string, songs: MsHit[]): string {
  const trimmed = name.trim();
  if (trimmed && !isDefaultPlaylistName(trimmed)) return trimmed;
  const titles = songs.slice(0, 4).map((s) => s.song_name).filter(Boolean);
  if (titles.length) return `פלייליסט במתכונת: ${titles.join(', ')}`;
  return 'מוזיקה חרדית מגוונת';
}

type WorkspaceProps = {
  operatorName: string;
  offline?: boolean;
};

function WorkspaceBody({ operatorName, offline = false }: WorkspaceProps) {
  const playlist = usePlaylist();
  const isMobile = useIsMobile();
  const isStudio = !isMobile;
  const { filters } = useSearchFilters();
  const {
    stagingItems,
    setStagingItems,
    stagingBatchId,
    parashaContext,
    stagingActive,
    stagingBuildLabel,
    stagingTopic,
    clearStaging,
    startStaging,
  } = useStagingSession();

  const [mobileStep, setMobileStep] = useState<MobileWorkspaceStep>('build');
  const [fillBusy, setFillBusy] = useState(false);
  const memoryMigrated = useRef(false);

  useEffect(() => {
    if (memoryMigrated.current || offline) return;
    memoryMigrated.current = true;
    void migrateLocalLearningOnce();
  }, [offline]);

  useEffect(() => {
    if (stagingActive && isMobile) {
      setMobileStep('match');
    }
  }, [stagingActive, isMobile]);

  const applyAutoPlaylistName = useCallback((label: string | null) => {
    const suggested =
      label ??
      inferPlaylistDisplayName({
        parasha: parashaContext?.targetParasha ?? null,
      });
    const next = resolveAutoPlaylistName(playlist.playlistName, suggested);
    if (next !== playlist.playlistName) playlist.setPlaylistName(next);
  }, [parashaContext?.targetParasha, playlist.playlistName, playlist.setPlaylistName]);

  const handleApproveStaging = useCallback((songs: MsHit[]) => {
    playlist.addSongs(songs);
    applyAutoPlaylistName(stagingBuildLabel);
    clearStaging();
    setActiveParashaExportContext(null, null, null);
    if (isMobile) setMobileStep('playlist');
  }, [playlist.addSongs, applyAutoPlaylistName, stagingBuildLabel, clearStaging, isMobile]);

  const handleSmartFill = useCallback(async () => {
    if (!playlist.songs.length) return;
    setFillBusy(true);
    const toastId = toast.loading('משלים פלייליסט…');
    try {
      const existingLines = playlist.songs.map((s) => `${s.artist} - ${s.song_name}`);
      const fillTarget = computeFillTarget(existingLines.length);
      const topic = inferFillTopic(playlist.playlistName, playlist.songs);
      const { lines, meta } = await fillCuratorPlaylist({
        topic,
        targetSize: fillTarget,
        existingLines,
      });
      if (!lines.length) {
        toast.info(
          meta?.reason ??
            (existingLines.length >= PLAYLIST_MAX
              ? 'הפלייליסט הגיע למקסימום'
              : 'לא נמצאו שירים נוספים מתאימים'),
          { id: toastId },
        );
        return;
      }
      startStaging(
        lines.map((line) => ({ id: crypto.randomUUID(), query: line, status: 'pending' as const })),
        null,
        isDefaultPlaylistName(playlist.playlistName)
          ? inferPlaylistDisplayName({ prompt: topic })
          : playlist.playlistName.trim(),
        topic,
      );
      toast.success(`נוספו ${lines.length} שירים להתאמה`, { id: toastId });
    } catch {
      toast.error('שגיאה בהשלמת פלייליסט', { id: toastId });
    } finally {
      setFillBusy(false);
    }
  }, [playlist, startStaging]);

  const fillTarget = computeFillTarget(playlist.songs.length);

  const canvasProps = useMemo(() => ({
    playlistName: playlist.playlistName,
    setPlaylistName: playlist.setPlaylistName,
    songs: playlist.songs,
    removeSong: playlist.removeSong,
    removeSongsById: playlist.removeSongsById,
    reorderSongs: playlist.reorderSongs,
    replaceSongs: playlist.replaceSongs,
    clearPlaylist: playlist.clearPlaylist,
    isDirty: playlist.isDirty,
    committing: playlist.committing,
    onCommit: playlist.commitPlaylist,
    targetSize: fillTarget,
    onSmartFill: handleSmartFill,
    smartFillBusy: fillBusy,
    className: 'h-full min-h-0',
  }), [
    playlist.playlistName,
    playlist.setPlaylistName,
    playlist.songs,
    playlist.removeSong,
    playlist.removeSongsById,
    playlist.reorderSongs,
    playlist.replaceSongs,
    playlist.clearPlaylist,
    playlist.isDirty,
    playlist.committing,
    playlist.commitPlaylist,
    fillTarget,
    handleSmartFill,
    fillBusy,
  ]);

  return (
    <div
      className="app-shell-bg flex flex-col h-[100svh] h-[100dvh] w-full overflow-hidden text-foreground selection:bg-primary/20"
      dir="rtl"
    >
      <header className="ws-header flex-shrink-0 z-40">
        <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-2 px-3 lg:px-4 py-2">
          <div className="flex items-center gap-3 min-w-0">
            <JusicLogo framed markClassName="ws-header__logo" />
            <div className="min-w-0">
              <span className="font-display text-sm font-bold j-text-gradient">{APP_SHORT_NAME}</span>
              <p className="text-[10px] text-secondary truncate max-w-[14rem]" title={operatorName}>
                {operatorName}
                {offline ? ' · לא מקוון' : ''}
              </p>
            </div>
          </div>
          <WorkspaceToolsMenu compact={isMobile} />
        </div>

        {isMobile ? (
          <div className="px-3 pb-2 space-y-2">
            <WorkspaceFilterChips />
            <ErrorBoundary label="חיפוש">
              <SearchBar onAddSong={playlist.addSong} />
            </ErrorBoundary>
          </div>
        ) : null}
      </header>

      <main className="flex-1 flex flex-col overflow-hidden min-h-0 touch-manipulation">
        {isStudio ? (
          <div className="ws-studio flex-1 min-h-0">
            <ErrorBoundary label="קטלוג">
              <CatalogPanel onAddSong={playlist.addSong} className="min-h-0" />
            </ErrorBoundary>

            <section className="ws-col ws-col--stage min-h-0" aria-label="החזקה ו-AI">
              <header className="ws-col__header">
                <h2 className="ws-col__title">Curator</h2>
              </header>
              <WorkspaceSmartActions
                songs={playlist.songs}
                playlistName={playlist.playlistName}
                onApplyArrangement={playlist.replaceSongs}
                onSmartFill={handleSmartFill}
                className="shrink-0"
              />
              <ErrorBoundary label="Smart Composer">
                <SmartComposer
                  variant="studio"
                  onAddSongs={playlist.addSongs}
                  onApplyAutoPlaylistName={applyAutoPlaylistName}
                  draftHistory={playlist.draftHistory}
                  onRememberDraft={playlist.rememberCurrentDraft}
                  onLoadDraft={playlist.loadDraft}
                  onDeleteDraft={playlist.deleteDraft}
                  hideStaging
                  className="flex-1 min-h-0"
                />
              </ErrorBoundary>
              {stagingActive ? (
                <div className="ws-staging-embed flex-1 min-h-0 flex flex-col border-t border-border/30">
                  <StagingArea
                    key={stagingBatchId}
                    items={stagingItems}
                    setItems={setStagingItems}
                    onApproveAll={handleApproveStaging}
                    onCancel={() => {
                      clearStaging();
                      setActiveParashaExportContext(null, null, null);
                    }}
                    searchFilters={filters}
                    parashaContext={parashaContext}
                    topicContext={stagingTopic}
                    compact
                  />
                </div>
              ) : null}
            </section>

            <PlaylistCanvas {...canvasProps} />
          </div>
        ) : (
          <>
            <div
              className={cn(
                'flex min-h-0 flex-1 flex-col ws-mobile-scroll-pad',
                mobileStep === 'match' && 'hidden',
              )}
            >
              {mobileStep === 'build' ? (
                <SmartComposer
                  onAddSongs={playlist.addSongs}
                  onApplyAutoPlaylistName={applyAutoPlaylistName}
                  draftHistory={playlist.draftHistory}
                  onRememberDraft={playlist.rememberCurrentDraft}
                  onLoadDraft={playlist.loadDraft}
                  onDeleteDraft={playlist.deleteDraft}
                  mobileFullScreen
                  mobileVisible
                  hideStaging
                  onMatchStepRequest={() => setMobileStep('match')}
                  className="flex-1 min-h-0"
                />
              ) : null}
              {mobileStep === 'playlist' ? <PlaylistCanvas {...canvasProps} /> : null}
            </div>

            {mobileStep === 'match' ? (
              <section className="flex flex-1 flex-col min-h-0 overflow-hidden p-2 ws-mobile-scroll-pad">
                {stagingActive ? (
                  <StagingArea
                    key={stagingBatchId}
                    items={stagingItems}
                    setItems={setStagingItems}
                    onApproveAll={handleApproveStaging}
                    onCancel={() => {
                      clearStaging();
                      setMobileStep('build');
                    }}
                    searchFilters={filters}
                    parashaContext={parashaContext}
                    topicContext={stagingTopic}
                    mobileLayout
                  />
                ) : (
                  <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground p-6 text-center">
                    אין התאמה פעילה. חזור לשלב &quot;בנה&quot;.
                  </div>
                )}
              </section>
            ) : null}
          </>
        )}
      </main>

      {isMobile ? (
        <MobileWorkspaceNav
          step={mobileStep}
          onStepChange={setMobileStep}
          songCount={playlist.songs.length}
          stagingActive={stagingActive}
        />
      ) : null}
    </div>
  );
}

const WorkspaceBodyMemo = memo(WorkspaceBody);

export default function Workspace(props: WorkspaceProps) {
  return <WorkspaceBodyMemo {...props} />;
}
