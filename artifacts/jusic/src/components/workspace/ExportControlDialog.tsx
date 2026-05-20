import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { StatusChip } from '@/components/ui/status-chip';
import {
  buildExportPreview,
  validateExportBlocking,
  type ExportPreviewRow,
} from '@/lib/export-preview';
import {
  downloadCsvInBrowser,
  LOMDAAT_PLAYLIST_FILENAME,
} from '@/lib/export';
import { fetchOperatorPreferences, savePlaylistToServer } from '@/lib/memory-api';
import { recordPlaylistExport } from '@/lib/playlist-learning';
import { resolveParashaNameFromClient } from '@/lib/parasha-export-context';
import type { MsHit } from '@/lib/meilisearch';
import { Loader2, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

function statusTone(status: ExportPreviewRow['status']) {
  switch (status) {
    case 'catalog':
      return 'success' as const;
    case 'duplicate':
      return 'warning' as const;
    default:
      return 'danger' as const;
  }
}

function statusLabel(status: ExportPreviewRow['status']) {
  switch (status) {
    case 'catalog':
      return 'מאגר';
    case 'duplicate':
      return 'כפילות';
    case 'empty':
      return 'ריק';
    default:
      return 'חסר';
  }
}

export function ExportControlDialog({
  open,
  onOpenChange,
  playlistName,
  songs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlistName: string;
  songs: MsHit[];
}) {
  const [name, setName] = useState(playlistName);
  const [catalogOnly, setCatalogOnly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof buildExportPreview>> | null>(
    null,
  );

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const parashaContext = resolveParashaNameFromClient(name);
      const block = validateExportBlocking(songs, parashaContext);
      if (block) {
        toast.error(block);
        return;
      }
      const result = await buildExportPreview(name, songs, {
        catalogOnly,
        parashaContext,
      });
      setPreview(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בתצוגה מקדימה');
    } finally {
      setBusy(false);
    }
  }, [name, songs, catalogOnly]);

  useEffect(() => {
    if (open) {
      setName(playlistName);
      void fetchOperatorPreferences().then((prefs) => {
        if (prefs.exportStrict !== undefined) setCatalogOnly(prefs.exportStrict);
      });
    }
  }, [open, playlistName]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const handleDownload = async () => {
    if (!preview?.csv) return;
    downloadCsvInBrowser(preview.csv, LOMDAAT_PLAYLIST_FILENAME);
    recordPlaylistExport(name, songs);
    const parasha = resolveParashaNameFromClient(name)?.targetParasha;
    void savePlaylistToServer({ name, songs, parasha });
    toast.success(`הורד ${preview.summary.catalog} שירים לאודו`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] flex flex-col gap-0 p-0 overflow-hidden rounded-2xl border-border/50 bg-card/90 backdrop-blur-2xl">
        <DialogHeader className="p-4 pb-2 border-b border-border/50">
          <DialogTitle>ייצוא לאודו — בקרה מלאה</DialogTitle>
          <DialogDescription className="text-right">
            בדיקת התאמה למאגר, סינון כפילויות והורדת CSV לייבוא ב-Odoo
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar flex-1">
          <div className="space-y-2">
            <Label htmlFor="export-playlist-name">שם פלייליסט בקובץ</Label>
            <Input
              id="export-playlist-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              dir="rtl"
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
            <div>
              <p className="text-sm font-medium">מאגר בלבד (מומלץ)</p>
              <p className="text-[11px] text-muted-foreground">
                רק שורות עם התאמה מדויקת ב-Meilisearch ייכנסו ל-CSV
              </p>
            </div>
            <Switch checked={catalogOnly} onCheckedChange={setCatalogOnly} />
          </div>

          {preview ? (
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <div className="flex flex-wrap gap-2 p-2 bg-muted/40 text-[11px]">
                <StatusChip tone="success">{preview.summary.catalog} מאגר</StatusChip>
                <StatusChip tone="danger">{preview.summary.missing} חסרים</StatusChip>
                {preview.summary.duplicate > 0 ? (
                  <StatusChip tone="warning">{preview.summary.duplicate} כפילות</StatusChip>
                ) : null}
                <span className="text-muted-foreground mr-auto">סה״כ {preview.summary.total}</span>
              </div>
              <ul className="max-h-[40vh] overflow-y-auto custom-scrollbar divide-y divide-border/40 text-[11px]">
                {preview.rows.map((row, i) => (
                  <li key={i} className="p-2 flex gap-2 items-start">
                    <StatusChip tone={statusTone(row.status)}>{statusLabel(row.status)}</StatusChip>
                    <div className="min-w-0 flex-1 text-right" dir="rtl">
                      <p className="font-medium truncate">
                        {row.row
                          ? `${row.row.artist} · ${row.row.song_name}`
                          : `${row.source.artist} · ${row.source.song_name}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter className="p-4 border-t border-border/50 gap-2 flex-row">
          <Button variant="outline" onClick={() => void refresh()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            רענן
          </Button>
          <Button onClick={() => void handleDownload()} disabled={busy || !preview?.summary.catalog}>
            <Download className="h-4 w-4 ml-1" />
            הורד CSV ({preview?.summary.catalog ?? 0})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
