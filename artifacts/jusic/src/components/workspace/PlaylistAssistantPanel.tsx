import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Music2, Gauge, KeyRound, Waves } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { arrangeSongs, type ArrangeMode } from '@/lib/playlist-arrange';
import type { MsHit } from '@/lib/meilisearch';
import { cn } from '@/lib/utils';
import { scaleTap } from '@/lib/motion-presets';

const ARRANGE_OPTIONS: Array<{
  mode: ArrangeMode;
  label: string;
  description: string;
  icon: typeof Sparkles;
}> = [
  {
    mode: 'bpm',
    label: 'לפי BPM',
    description: 'סידור עולה לפי קצב — מOpening איטי לסיום אנרגטי',
    icon: Gauge,
  },
  {
    mode: 'key',
    label: 'לפי מפתח',
    description: 'מעבר חלק בין מפתחות מוזיקליים (Camelot-friendly)',
    icon: KeyRound,
  },
  {
    mode: 'vibe',
    label: 'לפי וייב',
    description: 'מBallad ועד Dance — עקומת אווירה',
    icon: Waves,
  },
  {
    mode: 'energy',
    label: 'עקומת אנרגיה',
    description: 'שילוב BPM + וייב לזרימה דינמית',
    icon: Music2,
  },
];

type PlaylistAssistantPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  songs: MsHit[];
  onApplyArrangement: (songs: MsHit[]) => void;
};

function AssistantBody({
  songs,
  onApply,
  onClose,
}: {
  songs: MsHit[];
  onApply: (songs: MsHit[]) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<ArrangeMode | null>(null);

  const handleArrange = async (mode: ArrangeMode) => {
    if (!songs.length) return;
    setBusy(mode);
    await new Promise((r) => setTimeout(r, 280));
    onApply(arrangeSongs(songs, mode));
    setBusy(null);
    onClose();
  };

  return (
    <motion.div
      className="flex flex-col gap-4 p-1"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <p className="text-sm text-muted-foreground leading-relaxed">
        בחרו אופן סידור — השינוי יחול מיידית ותוכלו לשמור עם Commit.
      </p>
      <motion.div className="grid gap-2.5">
        {ARRANGE_OPTIONS.map(({ mode, label, description, icon: Icon }) => (
          <motion.div key={mode} {...scaleTap}>
            <Button
              variant="outline"
              className={cn(
                'h-auto w-full justify-start gap-3 rounded-2xl border-border/60 bg-card/80 px-4 py-3.5 text-right hover:border-primary/35 hover:bg-primary/5',
                busy === mode && 'border-primary/40 bg-primary/8',
              )}
              disabled={!songs.length || busy !== null}
              onClick={() => void handleArrange(mode)}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {busy === mode ? (
                  <Sparkles className="h-4 w-4 animate-pulse" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </span>
              <span className="flex flex-col items-start gap-0.5 min-w-0">
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-[11px] text-muted-foreground font-normal leading-snug">
                  {description}
                </span>
              </span>
            </Button>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

export function PlaylistAssistantPanel({
  open,
  onOpenChange,
  songs,
  onApplyArrangement,
}: PlaylistAssistantPanelProps) {
  const isMobile = useIsMobile();
  const close = () => onOpenChange(false);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85dvh] rounded-t-[1.25rem] border-border/50 bg-background/95 backdrop-blur-xl">
          <DrawerHeader className="text-right pb-2">
            <DrawerTitle className="font-display flex items-center gap-2 justify-end">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Assistant
            </DrawerTitle>
            <DrawerDescription>
              סידור אוטומטי לפי מפתח, BPM או וייב — {songs.length} שירים
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-[max(env(safe-area-inset-bottom,0px),1rem)] overflow-y-auto">
            <AssistantBody
              songs={songs}
              onApply={onApplyArrangement}
              onClose={close}
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md border-l border-border/50 bg-background/95 backdrop-blur-xl j-glass-panel"
      >
        <SheetHeader className="text-right">
          <SheetTitle className="font-display flex items-center gap-2 justify-end">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Assistant
          </SheetTitle>
          <SheetDescription>
            סידור אוטומטי לפי מפתח, BPM או וייב — {songs.length} שירים
          </SheetDescription>
        </SheetHeader>
        <AssistantBody
          songs={songs}
          onApply={onApplyArrangement}
          onClose={close}
        />
      </SheetContent>
    </Sheet>
  );
}

export function PlaylistAssistantTrigger({
  onClick,
  disabled,
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <motion.div {...scaleTap} className={className}>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-9 rounded-full px-4 text-[11px] font-semibold border-primary/20 bg-primary/8 hover:bg-primary/12 gap-1.5"
        disabled={disabled}
        onClick={onClick}
      >
        <Sparkles className="w-3.5 h-3.5" />
        AI סידור
      </Button>
    </motion.div>
  );
}
