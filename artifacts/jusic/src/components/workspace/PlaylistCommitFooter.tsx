import { motion } from 'framer-motion';
import { Check, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { scaleTap } from '@/lib/motion-presets';

type PlaylistCommitFooterProps = {
  isDirty: boolean;
  committing: boolean;
  songCount: number;
  onCommit: () => void;
  className?: string;
  /** Reserve space above mobile tab bar */
  mobileNavOffset?: boolean;
};

export function PlaylistCommitFooter({
  isDirty,
  committing,
  songCount,
  onCommit,
  className,
  mobileNavOffset = false,
}: PlaylistCommitFooterProps) {
  const locked = !isDirty || !songCount;

  return (
    <footer
      className={cn(
        'bp-playlist-commit flex-shrink-0 z-30',
        mobileNavOffset && 'bp-playlist-commit--mobile-nav',
        className,
      )}
      data-testid="playlist-commit-footer"
    >
      <div className="bp-playlist-commit__inner">
        <div className="flex flex-col gap-0.5 min-w-0 flex-1 text-right">
          <span className="text-xs font-semibold text-foreground/90">
            {locked ? 'אין שינויים לשמירה' : 'יש שינויים שלא נשמרו'}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {songCount} שירים · Commit שומר טיוטה ומנעל את הסדר
          </span>
        </div>
        <motion.div {...scaleTap}>
          <Button
            data-testid="commit-playlist-button"
            size="lg"
            disabled={locked || committing}
            onClick={onCommit}
            className={cn(
              'min-h-[var(--bp-touch-min)] rounded-full px-6 font-semibold gap-2 shadow-md transition-all',
              locked
                ? 'bg-muted text-muted-foreground shadow-none'
                : 'bg-primary hover:bg-primary/90 j-glow-primary',
            )}
          >
            {committing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : locked ? (
              <Lock className="h-4 w-4" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Commit
          </Button>
        </motion.div>
      </div>
    </footer>
  );
}
