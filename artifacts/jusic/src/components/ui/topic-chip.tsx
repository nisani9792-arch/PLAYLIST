import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

export function TopicChip({
  title,
  description,
  estimatedCount,
  vibe,
  onClick,
  className,
}: {
  title: string;
  description?: string;
  estimatedCount?: number;
  vibe?: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-right rounded-xl border border-border/70 bg-card/95 p-3',
        'hover:border-primary/40 hover:bg-primary/5 transition-all hover:shadow-md',
        'min-h-[var(--bp-touch-min,2.75rem)] touch-manipulation',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        {estimatedCount != null ? (
          <span className="text-[10px] font-bold text-primary tabular-nums">~{estimatedCount}</span>
        ) : null}
      </div>
      <p className="text-xs font-bold text-foreground mt-1">{title}</p>
      {description ? (
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{description}</p>
      ) : null}
      {vibe ? (
        <p className="text-[10px] text-primary/70 mt-1 font-medium">{vibe}</p>
      ) : null}
    </button>
  );
}
