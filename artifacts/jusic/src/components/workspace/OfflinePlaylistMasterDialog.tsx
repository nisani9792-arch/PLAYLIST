import { useEffect, useMemo, useState } from 'react';
import { Upload, FileSpreadsheet, WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { runOfflinePlaylistMaster, type OfflineMasterResult } from '@/lib/offline-playlist-master';
import { toast } from 'sonner';

export function OfflinePlaylistMasterDialog() {
  const [playlistName, setPlaylistName] = useState('');
  const [requestText, setRequestText] = useState('');
  const [dbFile, setDbFile] = useState<File | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [result, setResult] = useState<OfflineMasterResult | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string>('');

  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  const canRun = useMemo(
    () => Boolean(dbFile && playlistName.trim() && requestText.trim()),
    [dbFile, playlistName, requestText],
  );

  const handleFileChange = (file: File | null) => {
    setDbFile(file);
    setResult(null);
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl('');
    }
  };

  const handleRun = async () => {
    if (!dbFile || !playlistName.trim() || !requestText.trim()) return;
    setIsBusy(true);
    try {
      const processed = await runOfflinePlaylistMaster({
        file: dbFile,
        playlistName: playlistName.trim(),
        requestText,
      });
      setResult(processed);

      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
      const blob = new Blob([processed.csvContent], { type: 'text/csv;charset=utf-8;' });
      const nextUrl = URL.createObjectURL(blob);
      setDownloadUrl(nextUrl);

      toast.success(`העיבוד הסתיים: ${processed.matched.length} נמצאו, ${processed.notFound.length} לא נמצאו`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'שגיאה בעיבוד הקובץ';
      toast.error(msg);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full text-xs font-semibold border-border/60 bg-card/70 shadow-sm hover:shadow-md hover:border-primary/35">
          <WandSparkles className="w-3.5 h-3.5 mr-1.5" />
          <span className="hidden sm:inline">Offline Playlist Master</span>
          <span className="sm:hidden">Offline</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] max-w-[min(48rem,calc(100vw-1rem))] overflow-y-auto p-4 sm:p-6 bp-glass-panel border-primary/18 shadow-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">BUILD PLAY Playlist Generator</DialogTitle>
          <DialogDescription className="text-right">
            העלה מאגר CSV/Excel, הזן שם פלייליסט ורשימת שירים. המערכת תסנן לשירים בלבד, תבצע התאמה עם סף 80 ותפיק CSV מוכן לאודו.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="text-sm font-medium">שם הפלייליסט</label>
            <Input
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              placeholder='למשל: "פרשת אמור"'
            />

            <label className="text-sm font-medium">קובץ מאגר (CSV / Excel)</label>
            <div className="border border-dashed rounded-xl p-3 bg-muted/20">
              <Input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
              <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                {dbFile ? dbFile.name : 'לא נבחר קובץ'}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium">רשימת שירים (שורה לכל שיר)</label>
            <Textarea
              value={requestText}
              onChange={(e) => setRequestText(e.target.value)}
              className="h-48"
              placeholder={'אברהם פריד - מראה כהן\nליפא שמלצר - ונקדשתי'}
            />

            <Button onClick={handleRun} disabled={!canRun || isBusy} className="w-full">
              <Upload className="w-4 h-4 mr-2" />
              {isBusy ? 'מעבד...' : 'עבד והפק CSV'}
            </Button>
          </div>
        </div>

        {result && (
          <div className="border rounded-xl p-4 bg-muted/20 space-y-4">
            {downloadUrl && (
              <a
                href={downloadUrl}
                download="lomdaat_music.playlist.csv"
                className="inline-flex text-sm font-medium underline underline-offset-4"
              >
                הורדת קובץ CSV
              </a>
            )}

            <div className="space-y-2">
              <div className="font-semibold text-sm">✅ שירים שהוכנסו בהצלחה: ({result.matched.length})</div>
              <div className="text-sm text-muted-foreground max-h-28 overflow-auto">
                {result.matched.length ? (
                  result.matched.map((item) => (
                    <div key={`${item.request}_${item.song}`}>- {item.artist} - {item.song}</div>
                  ))
                ) : (
                  <div>לא נמצאו שירים מתאימים.</div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-semibold text-sm">❌ שירים שלא נמצאו במאגר: ({result.notFound.length})</div>
              <div className="text-sm text-muted-foreground max-h-28 overflow-auto">
                {result.notFound.length ? (
                  result.notFound.map((item) => (
                    <div key={`${item.request}_${item.bestScore}`}>
                      - {item.request} ({item.reason})
                    </div>
                  ))
                ) : (
                  <div>כל השירים נמצאו בהצלחה.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
