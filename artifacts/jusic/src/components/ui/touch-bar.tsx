import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Large touch targets for mobile dock / footer actions. */
export function TouchBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-stretch gap-2 p-2 sm:p-3 border-t border-border/50 bg-card/95',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TouchBarButton({
  children,
  className,
  variant = 'default',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost';
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex-1 min-h-[var(--bp-touch-min)] rounded-xl px-4 text-sm font-semibold transition-colors',
        variant === 'primary' &&
          'bg-primary text-primary-foreground shadow-md shadow-primary/20',
        variant === 'default' && 'bg-muted/60 text-foreground border border-border/60',
        variant === 'ghost' && 'text-muted-foreground hover:bg-muted/40',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
