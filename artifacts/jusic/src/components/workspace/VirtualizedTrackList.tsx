import { useRef, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { TRACK_ROW_HEIGHT } from './TrackRow';

export type VirtualizedTrackListProps<T> = {
  items: T[];
  estimateSize?: number;
  overscan?: number;
  getItemKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number, style: React.CSSProperties) => ReactNode;
  className?: string;
  listClassName?: string;
  emptyState?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  'data-testid'?: string;
};

export function VirtualizedTrackList<T>({
  items,
  estimateSize = TRACK_ROW_HEIGHT,
  overscan = 16,
  getItemKey,
  renderItem,
  className,
  listClassName,
  emptyState,
  header,
  footer,
  'data-testid': testId,
}: VirtualizedTrackListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: (index) => getItemKey(items[index]!, index),
  });

  if (!items.length && emptyState) {
    return (
      <div className={cn('flex flex-col min-h-0 flex-1', className)} data-testid={testId}>
        {header}
        <div className="flex flex-1 items-center justify-center p-4">{emptyState}</div>
        {footer}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col min-h-0 flex-1', className)} data-testid={testId}>
      {header}
      <div ref={parentRef} className={cn('flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar', listClassName)}>
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = items[virtualRow.index]!;
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className="absolute top-0 left-0 w-full"
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {renderItem(item, virtualRow.index, {})}
              </div>
            );
          })}
        </div>
      </div>
      {footer}
    </div>
  );
}
