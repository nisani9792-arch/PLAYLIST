import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { migrateLocalLearningOnce } from '@/lib/memory-api';
import { usePlaylist } from '../hooks/use-playlist';
import { useIsMobile } from '../hooks/use-mobile';
import { SearchBar } from '../components/workspace/SearchBar';
import { InspirationPanel } from '../components/workspace/InspirationPanel';
import { PlaylistCanvas } from '../components/workspace/PlaylistCanvas';
import { SmartComposer } from '../components/workspace/SmartComposer';
import { StagingDrawer } from '../components/workspace/StagingDrawer';
import { StagingArea } from '../components/workspace/StagingArea';
import { MobileSwipeReview } from '../components/workspace/MobileSwipeReview';
import { MobileWorkspaceNav, type MobileWorkspaceStep } from '../components/workspace/MobileWorkspaceNav';
import { WorkspaceToolsMenu } from '../components/workspace/WorkspaceToolsMenu';
import { JusicLogo } from '@/components/ui/jusic-logo';
import { useStagingSession } from '@/contexts/StagingSessionContext';
import { useSearchFilters } from '@/contexts/SearchFiltersContext';
import { setActiveParashaExportContext } from '@/lib/parasha-export-context';
import { APP_SHORT_NAME } from '@/lib/brand';
import { fillCuratorPlaylist } from '@/hooks/use-curator-build';
import { computeFillTarget, PLAYLIST_MAX } from '@workspace/curator';
import { fadeUpVariants, staggerContainer } from '@/lib/motion-presets';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { MsHit } from '../lib/meilisearch';

function inferFillTopic(name: string, songs: MsHit[]): string {
  const trimmed = name.trim();
  if (trimmed && !/^פלייליסט(\s|$)/i.test(trimmed)) return trimmed;
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
  const { filters } = useSearchFilters();
  const {
    stagingItems,
    setStagingItems,
    stagingBatchId,
    parashaContext,
    stagingActive,
    clearStaging,
    startStaging,
  } = useStagingSession();

  const [mobileStep, setMobileStep] = useState<MobileWorkspaceStep>('build');
  const [composerSeed, setComposerSeed] = useState('');
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

  const handleApproveStaging = (songs: MsHit[]) => {
    playlist.addSongs(songs);
    clearStaging();
    setActiveParashaExportContext(null, null, null);
    if (isMobile) setMobileStep('playlist');
  };

  const handleSmartFill = async () => {
    if (!playlist.songs.length) return;
    setFillBusy(true);
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
        );
        return;
      }
      startStaging(
        lines.map((line) => ({ id: crypto.randomUUID(), query: line, status: 'pending' as const })),
        null,
      );
      toast.success(`נוספו ${lines.length} שירים להתאמה (מטרה: ${meta?.targetSize ?? fillTarget})`);
    } catch {
      toast.error('שגיאה בהשלמת פלייליסט');
    } finally {
      setFillBusy(false);
    }
  };

  const fillTarget = computeFillTarget(playlist.songs.length);

  const showStagingDrawer = stagingActive && !isMobile;

  return (
    <div className="app-shell-bg flex flex-col h-[100dvh] w-full overflow-hidden text-foreground selection:bg-primary/20">
      <header className="j-glass-strip bp-glass-strip flex-shrink-0 flex flex-col z-40 overflow-visible pt-[max(env(safe-area-inset-top,0px),0.625rem)] sm:pt-3.5">
        <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-2 sm:gap-3 px-3 sm:px-5 lg:px-7 py-2 sm:py-2.5">
          <motion.div
            className="flex items-center gap-3 min-w-0 shrink-0"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <JusicLogo size={42} />
            <div className="flex flex-col leading-tight min-w-0 gap-0.5">
              <span className="font-display text-sm sm:text-base font-bold tracking-tight">
                <span className="j-text-gradient">{APP_SHORT_NAME}</span>
              </span>
              <span className="text-[10px] text-secondary truncate max-w-[12rem] sm:max-w-[18rem]" title={operatorName}>
                {operatorName}
                {offline ? ' · לא מקוון' : ''}
              </span>
            </div>
          </motion.div>
          <WorkspaceToolsMenu compact={isMobile} />
        </div>
        <div className="px-3 sm:px-5 lg:px-7 pb-2.5 sm:pb-3 relative z-[80] max-w-5xl mx-auto w-full">
          <SearchBar onAddSong={playlist.addSong} />
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden min-h-0 relative z-10 touch-manipulation">
        <motion.div
          className={cn(
            'flex flex-1 min-h-0 gap-3 p-2 lg:p-4',
            isMobile && 'p-0 gap-0',
          )}
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {!isMobile ? (
            <motion.div variants={fadeUpVariants} className="hidden lg:flex lg:flex-[2] min-w-[14rem] max-w-[18rem] min-h-0">
              <InspirationPanel
                className="w-full"
                onPickTopic={(title) => setComposerSeed(title)}
              />
            </motion.div>
          ) : null}

          <motion.div
            variants={fadeUpVariants}
            className={cn(
              'min-h-0 flex-1',
              isMobile && mobileStep !== 'playlist' && 'hidden',
              !isMobile && 'lg:flex-[5]',
            )}
          >
            <PlaylistCanvas
              playlistName={playlist.playlistName}
              setPlaylistName={playlist.setPlaylistName}
              songs={playlist.songs}
              removeSong={playlist.removeSong}
              reorderSongs={playlist.reorderSongs}
              clearPlaylist={playlist.clearPlaylist}
              targetSize={fillTarget}
              onSmartFill={handleSmartFill}
              smartFillBusy={fillBusy}
              className="h-full"
            />
          </motion.div>

          <motion.div
            variants={fadeUpVariants}
            className={cn(
              isMobile && mobileStep !== 'build' && 'hidden',
              !isMobile && 'lg:flex-[3] min-w-[16rem] max-w-[24rem] min-h-0',
            )}
          >
            <SmartComposer
              onAddSongs={playlist.addSongs}
              draftHistory={playlist.draftHistory}
              onRememberDraft={playlist.rememberCurrentDraft}
              onLoadDraft={playlist.loadDraft}
              onDeleteDraft={playlist.deleteDraft}
              mobileFullScreen={isMobile}
              mobileVisible={!isMobile || mobileStep === 'build'}
              hideStaging
              seedPrompt={composerSeed}
              onMatchStepRequest={() => setMobileStep('match')}
              className="h-full"
            />
          </motion.div>
        </motion.div>

        {showStagingDrawer ? (
          <StagingDrawer
            open
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
          />
        ) : null}

        {isMobile && mobileStep === 'match' ? (
          <section className="flex-1 min-h-0 flex flex-col p-2 pb-0">
            {stagingActive ? (
              <>
                <MobileSwipeReview
                  items={stagingItems}
                  onApprove={(item) => {
                    if (item.match) playlist.addSong(item.match);
                  }}
                  onSkip={() => undefined}
                  onDone={() => setMobileStep('playlist')}
                />
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
                  mobileLayout
                />
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground p-6 text-center">
                אין התאמה פעילה. חזור לשלב &quot;בנה&quot; ובחר נושא או הדבק רשימה.
              </div>
            )}
          </section>
        ) : null}
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

export default function Workspace(props: WorkspaceProps) {
  return <WorkspaceBody {...props} />;
}
