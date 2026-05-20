import { Link } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JusicLogo } from "@/components/ui/jusic-logo";
import { APP_SHORT_NAME } from "@/lib/brand";
import { Compass } from "lucide-react";
import { fadeUpVariants, springSoft } from "@/lib/motion-presets";

export default function NotFound() {
  return (
    <div className="app-shell-bg min-h-[100dvh] w-full flex items-center justify-center p-4" dir="rtl">
      <motion.div
        variants={fadeUpVariants}
        initial="hidden"
        animate="visible"
        transition={springSoft}
        className="w-full max-w-md"
      >
        <Card className="w-full j-glass-panel j-gradient-border border-primary/15 overflow-hidden rounded-[1.5rem]">
          <CardContent className="pt-8 pb-8 px-6 space-y-5 text-center">
            <div className="flex justify-center">
              <JusicLogo size={72} />
            </div>
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-bold tracking-tight j-text-gradient">
                {APP_SHORT_NAME}
              </h1>
              <p className="text-secondary text-sm leading-relaxed">
                העמוד שחיפשת לא קיים או שהקישור ישן. חזרו לעמדת העריכה כדי להמשיך בעבודה.
              </p>
            </div>
            <p className="text-xs text-secondary tabular-nums font-mono rounded-2xl bg-muted/45 py-2 px-3 border border-border/45">
              404 — העמוד לא נמצא
            </p>
            <Button asChild className="w-full rounded-full h-11 font-semibold">
              <Link href="/" className="inline-flex items-center justify-center gap-2">
                <Compass className="h-4 w-4" />
                חזרה לעמוד הראשי
              </Link>
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
