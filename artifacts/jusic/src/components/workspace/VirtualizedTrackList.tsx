import { memo, useCallback, useRef, type CSSProperties, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { TRACK_ROW_HEIGHT } from './TrackRow';

export type VirtualizedTrackListProps<T> = {
  items: T[];
  estimateSize?: number;
  overscan?: number;
  getItemKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number, style: CSSProperties) => ReactNode;
  className?: string;
  listClassName?: string;
  emptyState?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  'data-testid'?: string;
};

function VirtualizedTrackListInner<T>({
  items,
  estimateSize = TRACK_ROW_HEIGHT,
  overscan = 12,
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

  const getScrollElement = useCallback(() => parentRef.current, []);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: (index) => getItemKey(items[index]!, index),
    measureElement:
      typeof window !== 'undefined' && 'ResizeObserver' in window
        ? (el) => el.getBoundingClientRect().height
        : undefined,
    scrollMargin: 0,
    lanes: 1,
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
      <div
        ref={parentRef}
        className={cn(
          'flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar contain-strict',
          listClassName,
        )}
      >
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px`, contain: 'layout style' }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = items[virtualRow.index]!;
            const itemStyle: CSSProperties = {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
              height: estimateSize,
            };
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={itemStyle}
              >
                {renderItem(item, virtualRow.index, itemStyle)}
              </div>
            );
          })}
        </div>
      </div>
      {footer}
    </div>
  );
}

export const VirtualizedTrackList = memo(VirtualizedTrackListInner) as typeof VirtualizedTrackListInner;
