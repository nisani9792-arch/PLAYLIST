import { cn } from '@/lib/utils';

const VIBE_LABELS: Record<string, string> = {
  quiet: 'שקט',
  energetic: 'אנרגטי',
  mixed: 'מגוון',
  celebratory: 'חגיגי',
  emotional: 'רגש',
};

export function VibeBadge({
  vibe,
  className,
}: {
  vibe: string;
  className?: string;
}) {
  const label = VIBE_LABELS[vibe] ?? vibe;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
        'bg-primary/10 text-primary border border-primary/25',
        className,
      )}
    >
      {label}
    </span>
  );
}
