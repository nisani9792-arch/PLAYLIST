import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, Trash2 } from 'lucide-react';
import {
  fetchOperatorPreferences,
  saveOperatorPreferences,
  type OperatorPreferencesJson,
} from '@/lib/memory-api';
import { clearBuildSignals, downloadTrainingJson } from '@/lib/playlist-learning';

export function OperatorWorkspaceSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState<OperatorPreferencesJson>({
    exportStrict: true,
    preferredGenres: [],
    geminiStyleNotes: '',
    defaultPlaylistNamePattern: '',
  });
  const [genreInput, setGenreInput] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const data = await fetchOperatorPreferences();
      if (!cancelled) {
        setPrefs(data);
        setGenreInput((data.preferredGenres ?? []).join(', '));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const genres = genreInput
        .split(/[,،]/)
        .map((g) => g.trim())
        .filter(Boolean);
      const next: OperatorPreferencesJson = {
        ...prefs,
        preferredGenres: genres,
      };
      await saveOperatorPreferences(next);
      setPrefs(next);
      toast.success('העדפות נשמרו');
    } catch {
      toast.error('שמירת העדפות נכשלה');
    } finally {
      setSaving(false);
    }
  };

  const handleClearLearning = () => {
    clearBuildSignals();
    toast.success('זיכרון מקומי נוקה');
  };

  const handleExportLearning = () => {
    downloadTrainingJson();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bp-surface-card">
        <CardHeader>
          <CardTitle className="text-base">ייצוא לאודו</CardTitle>
          <CardDescription>ברירות מחדל לפני הורדת CSV</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="export-strict" className="text-sm">
              מאגר בלבד (מומלץ)
            </Label>
            <Switch
              id="export-strict"
              checked={prefs.exportStrict !== false}
              onCheckedChange={(v) => setPrefs((p) => ({ ...p, exportStrict: v }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name-pattern">תבנית שם פלייליסט</Label>
            <Input
              id="name-pattern"
              placeholder="לדוגמה: פרשת {parasha}"
              value={prefs.defaultPlaylistNamePattern ?? ''}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, defaultPlaylistNamePattern: e.target.value }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bp-surface-card">
        <CardHeader>
          <CardTitle className="text-base">AI מוזיקלי</CardTitle>
          <CardDescription>הנחיות אישיות לקuratור (נשמר בשרת)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            rows={4}
            placeholder="לדוגמה: יותר מזרחי עדין, פחות ותיקים"
            value={prefs.geminiStyleNotes ?? ''}
            onChange={(e) => setPrefs((p) => ({ ...p, geminiStyleNotes: e.target.value }))}
          />
          <div className="space-y-2">
            <Label htmlFor="genres">ז&apos;אנרים מועדפים (מופרדים בפסיק)</Label>
            <Input
              id="genres"
              value={genreInput}
              onChange={(e) => setGenreInput(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bp-surface-card">
        <CardHeader>
          <CardTitle className="text-base">זיכרון מקומי</CardTitle>
          <CardDescription>סטטיסטיקות לפני מעבר מלא לשרת</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleExportLearning}>
            ייצוא JSON
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleClearLearning}
          >
            <Trash2 className="h-3.5 w-3.5 ml-1" />
            נקה היסטוריה
          </Button>
        </CardContent>
      </Card>

      <Button type="button" className="w-full sm:w-auto" disabled={saving} onClick={() => void handleSave()}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Save className="h-4 w-4 ml-2" />}
        שמור העדפות
      </Button>
    </div>
  );
}
