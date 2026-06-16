import { motion } from 'framer-motion';
import { StepIndicator, type WorkspaceStep } from '@/components/ui/step-indicator';
import { cn } from '@/lib/utils';
import { ListMusic, Search, Sparkles } from 'lucide-react';
import { springSoft } from '@/lib/motion-presets';

export type MobileWorkspaceStep = 'build' | 'match' | 'playlist';

const STEPS: WorkspaceStep[] = [
  { id: 'build', label: 'בנה' },
  { id: 'match', label: 'התאם' },
  { id: 'playlist', label: 'פלייליסט' },
];

export function MobileWorkspaceNav({
  step,
  onStepChange,
  songCount,
  stagingActive,
  className,
}: {
  step: MobileWorkspaceStep;
  onStepChange: (step: MobileWorkspaceStep) => void;
  songCount: number;
  stagingActive: boolean;
  className?: string;
}) {
  return (
    <motion.nav
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
      className={cn(
        'ws-mobile-nav flex-shrink-0 z-[var(--z-nav)]',
        'bg-[hsl(var(--surface-1)/0.96)] backdrop-blur-xl shadow-[0_-4px_24px_hsl(215_30%_18%/0.08)]',
        'pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] pt-3 px-3',
        className,
      )}
      aria-label="ניווט עבודה"
    >
      <StepIndicator
        steps={STEPS}
        currentId={step}
        onStepClick={(id) => onStepChange(id as MobileWorkspaceStep)}
        className="mb-2"
      />
      <div className="flex justify-center gap-5 text-[11px] text-muted-foreground font-medium">
        <span className="inline-flex items-center gap-1.5 min-h-12 px-2">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{stagingActive ? 'התאמה פעילה' : 'מלחין'}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 min-h-12 px-2">
          <ListMusic className="h-3.5 w-3.5 shrink-0" />
          <span className="tabular-nums">{songCount} שירים</span>
        </span>
        <span className="inline-flex items-center gap-1.5 min-h-12 px-2">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">חיפוש בכותרת</span>
        </span>
      </div>
    </motion.nav>
  );
}
