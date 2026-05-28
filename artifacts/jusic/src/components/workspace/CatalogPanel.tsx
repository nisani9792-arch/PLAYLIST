import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Search, SearchX } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useSearch } from '@/hooks/use-search';
import { useSearchFilters } from '@/contexts/SearchFiltersContext';
import { cn } from '@/lib/utils';
import type { MsHit } from '@/lib/meilisearch';
import { trackRowKey } from '@/lib/track-format';
import { TrackRow } from './TrackRow';
import { VirtualizedTrackList } from './VirtualizedTrackList';
import { toast } from 'sonner';

type CatalogPanelProps = {
  onAddSong: (song: MsHit) => void;
  className?: string;
};

export function CatalogPanel({ onAddSong, className }: CatalogPanelProps) {
  const { filters } = useSearchFilters();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { results, warning, isFetching, isError, error, debouncedQuery, enabled } = useSearch(query, 80, filters);

  const hasResults = results.length > 0;
  const showEmpty = enabled && !isFetching && !hasResults && !isError;
  const showError = enabled && isError;

  useEffect(() => {
    setActiveIndex(0);
  }, [results, debouncedQuery]);

  useEffect(() => {
    if (warning) {
      toast.warning(warning, { id: 'search-filter-warning', duration: 5000 });
    }
  }, [warning]);

  useEffect(() => {
    if (isError && error) {
      toast.error(error.message, { id: 'search-error' });
    }
  }, [isError, error]);

  const handleAdd = useCallback(
    (song: MsHit) => {
      onAddSong(song);
      toast.success('נוסף לפלייליסט', { duration: 1800 });
    },
    [onAddSong],
  );

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      handleAdd(results[activeIndex]);
    }
  };

  return (
    <section className={cn('ws-col ws-col--catalog', className)} aria-label="קטלוג וחיפוש">
      <header className="ws-col__header">
        <h2 className="ws-col__title">קטלוג</h2>
        <span className="ws-col__meta tabular-nums">{hasResults ? results.length : '—'}</span>
      </header>

      <div className="ws-col__toolbar px-2 pb-1.5">
        <div className="relative">
          <Input
            ref={inputRef}
            data-testid="search-input"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="חיפוש שיר, אמן, תגית…"
            className="ws-search-input h-8 rounded-lg pr-9 pl-2 text-xs bg-[hsl(var(--surface-1))] border-border/40"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            dir="rtl"
          />
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary/80 pointer-events-none" />
          {isFetching ? (
            <Loader2 className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-primary" />
          ) : null}
        </div>
        {query.length > 0 && query.length < 2 ? (
          <p className="mt-1 px-0.5 text-[10px] text-muted-foreground">לפחות 2 תווים</p>
        ) : null}
      </div>

      <VirtualizedTrackList
        items={results}
        getItemKey={(hit) => trackRowKey(hit)}
        className="flex-1 min-h-0"
        listClassName="ws-track-list"
        emptyState={
          !enabled ? (
            <p className="text-xs text-muted-foreground text-center">הקלד לחיפוש במאגר</p>
          ) : showError ? (
            <div className="flex flex-col items-center gap-2 text-center px-3">
              <AlertCircle className="h-6 w-6 text-destructive/80" />
              <p className="text-xs font-medium">שגיאת חיפוש</p>
              <p className="text-[10px] text-muted-foreground">{error?.message}</p>
            </div>
          ) : showEmpty ? (
            <div className="flex flex-col items-center gap-2 text-center px-3">
              <SearchX className="h-6 w-6 text-muted-foreground/70" />
              <p className="text-xs font-medium">לא נמצאו תוצאות</p>
            </div>
          ) : isFetching ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              מחפש…
            </div>
          ) : null
        }
        renderItem={(hit, i) => (
          <TrackRow
            song={hit}
            showIndex={false}
            isSelected={i === activeIndex}
            onAdd={() => handleAdd(hit)}
            data-testid={`catalog-row-${hit.id}`}
            className={cn(i === activeIndex && 'bg-primary/8')}
          />
        )}
      />

      {hasResults ? (
        <p className="ws-col__hint shrink-0">↑↓ · Enter להוספה</p>
      ) : null}
    </section>
  );
}
