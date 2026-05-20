import { Link } from "wouter";
import { APP_SHORT_NAME } from "@/lib/brand";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Music2, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="app-shell-bg min-h-[100dvh] w-full flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md bp-glass-panel border-primary/20 shadow-2xl overflow-hidden rounded-[1.35rem]">
        <CardContent className="pt-8 pb-8 px-6 space-y-5 text-center">
          <div className="flex justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-emerald-500 to-primary text-primary-foreground shadow-lg shadow-primary/35 ring-4 ring-primary/15">
              <Music2 className="h-8 w-8" aria-hidden />
            </span>
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-black tracking-[0.14em] bg-gradient-to-l from-primary via-emerald-500 to-indigo-500 bg-clip-text text-transparent uppercase">
              {APP_SHORT_NAME}
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              העמוד שחיפשת לא קיים או שהקישור ישן. חזרו לעמדת העריכה כדי להמשיך בעבודה.
            </p>
          </div>
          <p className="text-xs text-muted-foreground/80 tabular-nums font-mono rounded-xl bg-muted/50 py-2 px-3 border border-border/60">
            404 — העמוד לא נמצא
          </p>
          <Button asChild className="w-full rounded-xl h-11 font-semibold shadow-lg shadow-primary/20">
            <Link href="/" className="inline-flex items-center justify-center gap-2">
              <Compass className="h-4 w-4" />
              חזרה לעמוד הראשי
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
