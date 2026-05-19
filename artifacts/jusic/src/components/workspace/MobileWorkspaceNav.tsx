import { StepIndicator, type WorkspaceStep } from '@/components/ui/step-indicator';
import { cn } from '@/lib/utils';
import { ListMusic, Search, Sparkles } from 'lucide-react';

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
    <nav
      className={cn(
        'flex-shrink-0 border-t border-border/60 bg-card/95 backdrop-blur-md pb-[max(env(safe-area-inset-bottom,0px),0.35rem)] pt-2 px-2',
        className,
      )}
      aria-label="ניווט עבודה"
    >
      <StepIndicator
        steps={STEPS}
        currentId={step}
        onStepClick={(id) => onStepChange(id as MobileWorkspaceStep)}
        className="mb-1"
      />
      <div className="flex justify-center gap-4 text-[10px] text-muted-foreground font-medium">
        <span className="inline-flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          {stagingActive ? 'התאמה פעילה' : 'מלחין'}
        </span>
        <span className="inline-flex items-center gap-1">
          <ListMusic className="h-3 w-3" />
          {songCount} שירים
        </span>
        <span className="inline-flex items-center gap-1">
          <Search className="h-3 w-3" />
          חיפוש בכותרת
        </span>
      </div>
    </nav>
  );
}
