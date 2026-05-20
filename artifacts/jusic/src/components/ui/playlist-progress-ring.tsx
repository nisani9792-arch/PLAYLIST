import { cn } from '@/lib/utils';

export function PlaylistProgressRing({
  current,
  target,
  className,
}: {
  current: number;
  target: number;
  className?: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width="44" height="44" viewBox="0 0 44 44" className="-rotate-90" aria-hidden>
        <circle cx="22" cy="22" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-border/50" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-primary transition-all duration-500"
        />
      </svg>
      <span className="absolute text-[10px] font-bold tabular-nums text-foreground">
        {current}/{target}
      </span>
    </div>
  );
}
