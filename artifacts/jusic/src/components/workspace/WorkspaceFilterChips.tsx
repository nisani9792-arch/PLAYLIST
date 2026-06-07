import { memo } from 'react';
import { Shield, Zap, Heart, PartyPopper, Wind, Blend } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspaceStore, type VibeFilter } from '@/stores/workspace-store';

const VIBE_OPTIONS: Array<{ id: VibeFilter; label: string; icon: typeof Zap }> = [
  { id: 'energetic', label: 'אנרגטי', icon: Zap },
  { id: 'quiet', label: 'שקט', icon: Wind },
  { id: 'emotional', label: 'רגשי', icon: Heart },
  { id: 'celebratory', label: 'חגיגי', icon: PartyPopper },
  { id: 'mixed', label: 'מעורב', icon: Blend },
];

export const WorkspaceFilterChips = memo(function WorkspaceFilterChips({
  className,
}: {
  className?: string;
}) {
  const vibeFilter = useWorkspaceStore((s) => s.vibeFilter);
  const hashkafaShield = useWorkspaceStore((s) => s.hashkafaShield);
  const setVibeFilter = useWorkspaceStore((s) => s.setVibeFilter);
  const toggleHashkafaShield = useWorkspaceStore((s) => s.toggleHashkafaShield);

  return (
    <div className={cn('ws-filter-chips', className)} role="toolbar" aria-label="סינון מהיר">
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground self-center px-0.5">
        וייב
      </span>
      {VIBE_OPTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={cn('ws-filter-chip inline-flex items-center gap-1', vibeFilter === id && 'ws-filter-chip--active')}
          aria-pressed={vibeFilter === id}
          onClick={() => setVibeFilter(vibeFilter === id ? null : id)}
        >
          <Icon className="h-3 w-3" />
          {label}
        </button>
      ))}
      <span className="w-px h-4 bg-border/50 self-center mx-0.5" aria-hidden />
      <button
        type="button"
        className={cn(
          'ws-filter-chip inline-flex items-center gap-1',
          hashkafaShield && 'ws-filter-chip--active',
        )}
        aria-pressed={hashkafaShield}
        onClick={toggleHashkafaShield}
        title="מסנן אמנים חילוניים ותוכן לא מתאים"
      >
        <Shield className="h-3 w-3" />
        השקפה
      </button>
    </div>
  );
});
