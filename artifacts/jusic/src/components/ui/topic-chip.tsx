import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';
import { scaleTap } from '@/lib/motion-presets';

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
    <motion.button
      type="button"
      onClick={onClick}
      {...scaleTap}
      className={cn(
        'text-right w-full rounded-2xl border border-border/55 bg-card/65 backdrop-blur-sm p-3.5',
        'hover:border-primary/35 hover:bg-primary/6 transition-colors',
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
    </motion.button>
  );
}
