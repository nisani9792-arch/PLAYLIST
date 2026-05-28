import { useState } from 'react';
import { BarChart3, Sparkles, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MsHit } from '@/lib/meilisearch';
import { arrangeSongs } from '@/lib/playlist-arrange';
import { fillCuratorPlaylist } from '@/hooks/use-curator-build';
import { computeFillTarget, parseVibeFromPrompt, PLAYLIST_MAX } from '@workspace/curator';
import { createStagingItem, useStagingSession } from '@/contexts/StagingSessionContext';

type WorkspaceSmartActionsProps = {
  songs: MsHit[];
  playlistName: string;
  onApplyArrangement: (songs: MsHit[]) => void;
  onSmartFill?: () => void;
  className?: string;
};

function inferTopic(name: string, songs: MsHit[]): string {
  const trimmed = name.trim();
  if (trimmed && trimmed !== 'פלייליסט חדש') return trimmed;
  const titles = songs.slice(0, 3).map((s) => s.song_name).filter(Boolean);
  if (titles.length) return `בסגנון: ${titles.join(', ')}`;
  return 'מוזיקה חרדית מגוונת';
}

export function WorkspaceSmartActions({
  songs,
  playlistName,
  onApplyArrangement,
  onSmartFill,
  className,
}: WorkspaceSmartActionsProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const { startStaging, stagingTopic } = useStagingSession();

  const run = async (id: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(id);
    const toastId = toast.loading('מעבד…');
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'שגיאה', { id: toastId });
    } finally {
      toast.dismiss(toastId);
      setBusy(null);
    }
  };

  const handleAutoVibe = () => {
    void run('vibe', async () => {
      const topic = stagingTopic || inferTopic(playlistName, songs);
      const vibe = parseVibeFromPrompt(topic);
      toast.success(vibe ? `וייב מזוהה: ${vibe}` : 'לא זוהה וייב ברור — נסה ניסוח מפורט יותר');
    });
  };

  const handleSuggestSimilar = () => {
    if (!songs.length) {
      toast.info('הוסף שירים לפני הצעות דומות');
      return;
    }
    void run('similar', async () => {
      const anchor = songs[songs.length - 1]!;
      const topic = `${anchor.artist} - ${anchor.song_name}, ${inferTopic(playlistName, songs)}`;
      const existingLines = songs.map((s) => `${s.artist} - ${s.song_name}`);
      const fillTarget = Math.min(12, computeFillTarget(existingLines.length));
      const { lines, meta } = await fillCuratorPlaylist({
        topic,
        targetSize: fillTarget,
        existingLines,
      });
      if (!lines.length) {
        toast.info(meta?.reason ?? 'לא נמצאו הצעות נוספות');
        return;
      }
      startStaging(
        lines.map((line) => createStagingItem(line)),
        null,
        playlistName,
        topic,
      );
      toast.success(`${lines.length} שירים בהחזקה להתאמה`);
    });
  };

  const handleAnalyzeFlow = () => {
    if (songs.length < 3) {
      toast.info('נדרשים לפחות 3 שירים לניתוח זרימה');
      return;
    }
    void run('flow', async () => {
      const arranged = arrangeSongs(songs, 'energy');
      onApplyArrangement(arranged);
      toast.success('סודר לפי עקומת אנרגיה — בדוק את הרצף');
    });
  };

  const handleFill = () => {
    if (!onSmartFill || !songs.length) return;
    onSmartFill();
  };

  const disabled = !songs.length;
  const atMax = songs.length >= PLAYLIST_MAX;

  return (
    <div className={cn('ws-smart-actions', className)} role="toolbar" aria-label="פעולות AI">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="ws-smart-actions__btn"
        disabled={!!busy}
        onClick={handleAutoVibe}
      >
        <Wand2 className="h-3.5 w-3.5" />
        מילוי וייב
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="ws-smart-actions__btn"
        disabled={!!busy || disabled}
        onClick={handleSuggestSimilar}
      >
        <Sparkles className="h-3.5 w-3.5" />
        דומים לבחירה
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="ws-smart-actions__btn"
        disabled={!!busy || disabled}
        onClick={handleAnalyzeFlow}
      >
        <BarChart3 className="h-3.5 w-3.5" />
        ניתוח זרימה
      </Button>
      {onSmartFill ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ws-smart-actions__btn"
          disabled={!!busy || disabled || atMax}
          onClick={handleFill}
        >
          <Sparkles className="h-3.5 w-3.5" />
          השלם פלייליסט
        </Button>
      ) : null}
    </div>
  );
}
