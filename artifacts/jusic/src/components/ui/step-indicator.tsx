import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export type WorkspaceStep = {
  id: string;
  label: string;
};

export function StepIndicator({
  steps,
  currentId,
  className,
  onStepClick,
}: {
  steps: WorkspaceStep[];
  currentId: string;
  className?: string;
  onStepClick?: (id: string) => void;
}) {
  const currentIndex = steps.findIndex((s) => s.id === currentId);

  return (
    <nav
      className={cn('flex items-center justify-center gap-1 sm:gap-2', className)}
      aria-label="שלבי עבודה"
    >
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const active = step.id === currentId;
        const clickable = Boolean(onStepClick);

        return (
          <button
            key={step.id}
            type="button"
            disabled={!clickable}
            onClick={() => onStepClick?.(step.id)}
            className={cn(
              'flex flex-col items-center gap-0.5 min-w-[4.5rem] px-1 py-1 rounded-xl transition-colors',
              clickable && 'hover:bg-muted/50 cursor-pointer',
              !clickable && 'cursor-default',
              active && 'text-primary',
              !active && !done && 'text-muted-foreground',
              done && 'text-emerald-600 dark:text-emerald-400',
            )}
            aria-current={active ? 'step' : undefined}
          >
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold',
                active && 'border-primary bg-primary text-primary-foreground',
                done && 'border-emerald-500/40 bg-emerald-500/15',
                !active && !done && 'border-border bg-card',
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
            </span>
            <span className="text-[10px] font-semibold leading-tight">{step.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
