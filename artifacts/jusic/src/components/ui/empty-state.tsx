import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center gap-3 py-10 px-6 rounded-2xl border border-dashed border-border/70 bg-card/50',
        className,
      )}
    >
      {icon ? (
        <div className="text-muted-foreground/80 [&_svg]:h-10 [&_svg]:w-10">{icon}</div>
      ) : null}
      <div className="space-y-1 max-w-sm">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
