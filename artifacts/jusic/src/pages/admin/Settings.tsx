import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Save,
  XCircle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

const SETTINGS_KEYS = [
  "ai_custom_instructions",
  "active_api_url",
  "gemini_base_url",
  "gemini_api_key",
  "meilisearch_url",
  "meilisearch_api_key",
  "meilisearch_index",
] as const;

type SettingKey = (typeof SETTINGS_KEYS)[number];

type ServiceCheck =
  | { ok: true; checkedAt: string; latencyMs?: number }
  | { ok: false; error: string; checkedAt: string; latencyMs?: number };

type MeilisearchDiag =
  | {
      ok: true;
      checkedAt: string;
      index: string;
      numberOfDocuments: number | null;
      isIndexing: boolean | null;
    }
  | {
      ok: false;
      checkedAt: string;
      error: string;
      detail?: string;
      index?: string;
    };

type DiagnosticsResponse = {
  checkedAt: string;
  database: ServiceCheck;
  meilisearch: MeilisearchDiag;
  gemini: ServiceCheck;
  environment: Record<string, { exists: boolean }>;
};

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex h-2.5 w-2.5 rounded-full shrink-0 ${ok ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]"}`}
      aria-hidden
    />
  );
}

function formatCheckedAt(iso: string | undefined) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("he-IL", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function settingsToForm(s: Record<string, string> | undefined) {
  const row = (k: SettingKey) => s?.[k] ?? "";
  return {
    ai_custom_instructions: row("ai_custom_instructions"),
    active_api_url: row("active_api_url"),
    gemini_base_url: row("gemini_base_url"),
    gemini_api_key: row("gemini_api_key"),
    meilisearch_url: row("meilisearch_url"),
    meilisearch_api_key: row("meilisearch_api_key"),
    meilisearch_index: row("meilisearch_index"),
  };
}

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("health");

  const diagnosticsQuery = useQuery({
    queryKey: ["admin", "diagnostics"],
    queryFn: async (): Promise<DiagnosticsResponse> => {
      const res = await fetch("/api/admin/diagnostics");
      if (!res.ok) {
        throw new Error(`Diagnostics failed: ${res.status}`);
      }
      return res.json() as Promise<DiagnosticsResponse>;
    },
    staleTime: 30_000,
  });

  const settingsQuery = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      const data = (await res.json()) as { settings: Record<string, string> };
      return data.settings;
    },
  });

  const [form, setForm] = useState(() => settingsToForm(undefined));

  useEffect(() => {
    if (settingsQuery.data) {
      setForm(settingsToForm(settingsQuery.data));
    }
  }, [settingsQuery.data]);

  const patchMutation = useMutation({
    mutationFn: async (payload: Record<string, string>) => {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: payload }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? res.statusText);
      }
      return res.json() as Promise<{ settings: Record<string, string> }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "diagnostics"] });
      toast.success("הגדרות נשמרו");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveApiConfig = useCallback(() => {
    patchMutation.mutate({
      active_api_url: form.active_api_url,
      gemini_base_url: form.gemini_base_url,
      gemini_api_key: form.gemini_api_key,
      meilisearch_url: form.meilisearch_url,
      meilisearch_api_key: form.meilisearch_api_key,
      meilisearch_index: form.meilisearch_index,
    });
  }, [form, patchMutation]);

  const saveAiInstructions = useCallback(() => {
    patchMutation.mutate({
      ai_custom_instructions: form.ai_custom_instructions,
    });
  }, [form.ai_custom_instructions, patchMutation]);

  const d = diagnosticsQuery.data;
  const diagLoading = diagnosticsQuery.isFetching;

  return (
    <div className="dark min-h-[100dvh] text-foreground" dir="rtl">
      <div
        className="min-h-[100dvh] flex flex-col"
        style={{
          background:
            "radial-gradient(ellipse at 15% 10%, rgba(14,165,233,0.08) 0%, transparent 45%), radial-gradient(ellipse at 85% 90%, rgba(99,102,241,0.06) 0%, transparent 40%), hsl(var(--background))",
        }}
      >
        <header className="flex-shrink-0 bp-glass-strip border-b px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Button variant="ghost" size="sm" asChild className="gap-2 shrink-0">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                חזרה לעמדה
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-8 hidden sm:block bg-border/60" />
            <div className="min-w-0">
              <h1 className="font-display text-lg font-black tracking-tight truncate bg-gradient-to-l from-primary to-indigo-400 bg-clip-text text-transparent">
                אבחון ותצורת מערכת
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">JUSIC PLAY Admin — בריאות שירותים, API והנחיות AI</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 shrink-0 border-border/80"
            onClick={() => diagnosticsQuery.refetch()}
            disabled={diagLoading}
          >
            {diagLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            ריענון בדיקות
          </Button>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6 max-w-5xl mx-auto w-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 h-auto sm:h-10 p-1 bg-muted/60">
              <TabsTrigger value="health" className="text-xs sm:text-sm">
                בריאות מערכת
              </TabsTrigger>
              <TabsTrigger value="api" className="text-xs sm:text-sm">
                תצורת API
              </TabsTrigger>
              <TabsTrigger value="ai" className="text-xs sm:text-sm">
                הנחיות AI
              </TabsTrigger>
            </TabsList>

            <TabsContent value="health" className="space-y-4 mt-6 outline-none">
              {diagnosticsQuery.isLoading && !d ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="border-border/60 bg-card/50">
                      <CardHeader className="pb-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-full mt-2" />
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-8 w-24" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : diagnosticsQuery.isError ? (
                <Card className="border-destructive/40 bg-destructive/5">
                  <CardHeader>
                    <CardTitle className="text-destructive text-base">שגיאה בטעינת האבחון</CardTitle>
                    <CardDescription>{(diagnosticsQuery.error as Error).message}</CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-lg">
                      <CardHeader className="pb-2 space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          <StatusDot ok={d!.database.ok} />
                          מסד נתונים (PostgreSQL)
                          {d!.database.ok ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mr-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 mr-auto" />
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {d!.database.ok
                            ? d!.database.latencyMs != null
                              ? `זמן תגובה: ${d!.database.latencyMs} ms`
                              : "החיבור תקין"
                            : d!.database.error}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="text-xs text-muted-foreground">
                        נבדק לאחרונה: {formatCheckedAt(d!.database.checkedAt)}
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-lg">
                      <CardHeader className="pb-2 space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          <StatusDot ok={d!.meilisearch.ok} />
                          Meilisearch
                          {d!.meilisearch.ok ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mr-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 mr-auto" />
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {d!.meilisearch.ok
                            ? `אינדקס: ${d!.meilisearch.index} · מסמכים: ${d!.meilisearch.numberOfDocuments ?? "—"}${d!.meilisearch.isIndexing ? " · מסדר אינדקס…" : ""}`
                            : d!.meilisearch.error}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="text-xs text-muted-foreground">
                        נבדק לאחרונה: {formatCheckedAt(d!.meilisearch.checkedAt)}
                      </CardContent>
                    </Card>

                    <Card className="border-border/60 bg-card/60 backdrop-blur-sm shadow-lg sm:col-span-2">
                      <CardHeader className="pb-2 space-y-1">
                        <CardTitle className="text-base flex items-center gap-2">
                          <StatusDot ok={d!.gemini.ok} />
                          Gemini AI
                          {d!.gemini.ok ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mr-auto" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 mr-auto" />
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {d!.gemini.ok ? "בדיקת חיבור (בקשת ייצור קצרה) הצליחה" : d!.gemini.error}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="text-xs text-muted-foreground">
                        נבדק לאחרונה: {formatCheckedAt(d!.gemini.checkedAt)}
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border-border/60 bg-card/40">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">משתני סביבה (קיום בלבד)</CardTitle>
                      <CardDescription className="text-xs">הערכים עצמם לא מוצגים מטעמי אבטחה</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="grid gap-2 sm:grid-cols-2 text-xs font-mono">
                        {Object.entries(d!.environment).map(([name, { exists }]) => (
                          <li
                            key={name}
                            className="flex items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2 bg-background/40"
                          >
                            <span className="truncate" title={name}>
                              {name}
                            </span>
                            <span className={exists ? "text-emerald-400" : "text-red-400"}>
                              {exists ? "קיים" : "חסר"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            <TabsContent value="api" className="space-y-6 mt-6 outline-none">
              {settingsQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full max-w-xs" />
                </div>
              ) : (
                <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-base">כתובות ומפתחות</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                      ערכים ריקים משאירים את ברירת המחדל מקובץ הסביבה. שמירה כאן גוברת על התצורה בזמן ריצה (ל-API ולחיפוש). מפתחות רגישים — שמרו את דף הניהול פרטי.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="active_api_url">כתובת API פעילה (לקוח)</Label>
                      <Input
                        id="active_api_url"
                        dir="ltr"
                        className="font-mono text-sm bg-background/60"
                        placeholder="https://example.com או ריק ל־same-origin"
                        value={form.active_api_url}
                        onChange={(e) => setForm((f) => ({ ...f, active_api_url: e.target.value }))}
                      />
                    </div>
                    <Separator className="bg-border/50" />
                    <div className="space-y-2">
                      <Label htmlFor="gemini_base_url">Gemini — Base URL</Label>
                      <Input
                        id="gemini_base_url"
                        dir="ltr"
                        className="font-mono text-sm bg-background/60"
                        placeholder="AI_INTEGRATIONS_GEMINI_BASE_URL"
                        value={form.gemini_base_url}
                        onChange={(e) => setForm((f) => ({ ...f, gemini_base_url: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gemini_api_key">Gemini — API Key</Label>
                      <Input
                        id="gemini_api_key"
                        dir="ltr"
                        type="password"
                        autoComplete="off"
                        className="font-mono text-sm bg-background/60"
                        placeholder="ריק = שימוש ב־AI_INTEGRATIONS_GEMINI_API_KEY"
                        value={form.gemini_api_key}
                        onChange={(e) => setForm((f) => ({ ...f, gemini_api_key: e.target.value }))}
                      />
                    </div>
                    <Separator className="bg-border/50" />
                    <div className="space-y-2">
                      <Label htmlFor="meilisearch_url">Meilisearch — URL</Label>
                      <Input
                        id="meilisearch_url"
                        dir="ltr"
                        className="font-mono text-sm bg-background/60"
                        placeholder="MEILISEARCH_URL"
                        value={form.meilisearch_url}
                        onChange={(e) => setForm((f) => ({ ...f, meilisearch_url: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="meilisearch_api_key">Meilisearch — API Key</Label>
                      <Input
                        id="meilisearch_api_key"
                        dir="ltr"
                        type="password"
                        autoComplete="off"
                        className="font-mono text-sm bg-background/60"
                        placeholder="MEILISEARCH_API_KEY"
                        value={form.meilisearch_api_key}
                        onChange={(e) => setForm((f) => ({ ...f, meilisearch_api_key: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="meilisearch_index">Meilisearch — Index UID</Label>
                      <Input
                        id="meilisearch_index"
                        dir="ltr"
                        className="font-mono text-sm bg-background/60"
                        placeholder="music"
                        value={form.meilisearch_index}
                        onChange={(e) => setForm((f) => ({ ...f, meilisearch_index: e.target.value }))}
                      />
                    </div>
                    <Button className="gap-2" onClick={saveApiConfig} disabled={patchMutation.isPending}>
                      {patchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      שמור תצורת API
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="ai" className="space-y-6 mt-6 outline-none">
              {settingsQuery.isLoading ? (
                <Skeleton className="h-64 w-full rounded-xl" />
              ) : (
                <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-base">הנחיות מערכת (System Instructions)</CardTitle>
                    <CardDescription className="text-xs leading-relaxed max-w-prose">
                      הטקסט כאן נשלח ל־Gemini כ־system prompt בכל בקשת פלייליסט (כולל סטרימינג). ניתן לשנות התנהגות בזמן אמת — לדוגמה פורמט פלט, עדיפויות סגנון, או הנחיות שפה — בלי לפרוס מחדש קוד.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      dir="auto"
                      className="min-h-[280px] text-sm leading-relaxed font-mono bg-background/60 resize-y"
                      placeholder="לדוגמה: תמיד החזר JSON עם מפתח 'songs'. הערות עדיפות: ווקאל גברי, טמפו בינוני…"
                      value={form.ai_custom_instructions}
                      onChange={(e) => setForm((f) => ({ ...f, ai_custom_instructions: e.target.value }))}
                    />
                    <Button className="gap-2" onClick={saveAiInstructions} disabled={patchMutation.isPending}>
                      {patchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      שמור הנחיות
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
