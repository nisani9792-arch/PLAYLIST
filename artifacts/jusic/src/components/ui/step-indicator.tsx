import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { springSnappy } from '@/lib/motion-presets';
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
          <motion.button
            key={step.id}
            type="button"
            disabled={!clickable}
            onClick={() => onStepClick?.(step.id)}
            whileTap={clickable ? { scale: 0.96 } : undefined}
            transition={springSnappy}
            className={cn(
              'flex flex-col items-center gap-0.5 min-w-[4.5rem] px-1 py-1 rounded-2xl transition-colors',
              clickable && 'hover:bg-primary/6 cursor-pointer',
              !clickable && 'cursor-default',
              active && 'text-primary',
              !active && !done && 'text-secondary',
              done && 'text-emerald-600 dark:text-emerald-400',
            )}
            aria-current={active ? 'step' : undefined}
          >
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-colors',
                active && 'border-primary bg-primary text-primary-foreground j-glow-primary',
                done && 'border-emerald-500/35 bg-emerald-500/12',
                !active && !done && 'border-border/60 bg-card/70',
              )}
            >              {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
            </span>
            <span className="text-[10px] font-semibold leading-tight">{step.label}</span>
          </motion.button>
        );      })}
    </nav>
  );
}
