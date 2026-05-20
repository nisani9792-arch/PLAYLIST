import { StagingArea, type StagingItem } from './StagingArea';
import type { SearchFilterOptions } from '@/lib/search-filters';
import type { StagingParashaContext } from '@/lib/staging-context';
import type { MsHit } from '@/lib/meilisearch';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type StagingDrawerProps = {
  open: boolean;
  items: StagingItem[];
  setItems: React.Dispatch<React.SetStateAction<StagingItem[]>>;
  onApproveAll: (songs: MsHit[]) => void;
  onCancel: () => void;
  searchFilters: SearchFilterOptions;
  parashaContext: StagingParashaContext | null;
  mobileLayout?: boolean;
  className?: string;
};

export function StagingDrawer({
  open,
  className,
  onCancel,
  ...stagingProps
}: StagingDrawerProps) {
  if (!open) return null;

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 md:relative md:inset-auto',
        'md:col-span-full md:mt-2',
        className,
      )}
    >
      <div className="md:hidden h-2 bg-gradient-to-t from-black/10 to-transparent" aria-hidden />
      <section
        className={cn(
          'flex flex-col bp-surface-card overflow-hidden',
          'max-h-[70dvh] md:max-h-[40vh] rounded-t-[1.25rem] md:rounded-[1.25rem]',
          'border border-border/60 shadow-2xl md:shadow-lg',
        )}
        aria-label="אזור התאמה"
      >
        <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-border/40 md:hidden">
          <span className="text-xs font-bold">התאמה</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <StagingArea {...stagingProps} onCancel={onCancel} />
      </section>
    </div>
  );
}
