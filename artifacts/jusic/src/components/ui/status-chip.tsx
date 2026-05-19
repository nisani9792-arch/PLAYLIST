import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export type StatusChipTone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'muted';

const toneClass: Record<StatusChipTone, string> = {
  default: 'bg-muted/50 text-foreground border-border/60',
  primary: 'bg-primary/12 text-primary border-primary/25',
  success: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
  warning: 'bg-amber-500/12 text-amber-800 dark:text-amber-300 border-amber-500/25',
  danger: 'bg-destructive/10 text-destructive border-destructive/25',
  muted: 'bg-muted/30 text-muted-foreground border-border/50',
};

export function StatusChip({
  children,
  tone = 'default',
  className,
  icon,
}: {
  children: ReactNode;
  tone?: StatusChipTone;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-semibold shrink-0',
        toneClass[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
