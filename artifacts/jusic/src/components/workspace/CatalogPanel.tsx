import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckSquare, Layers, Loader2, Search, SearchX, Square } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSearch } from '@/hooks/use-search';
import { useSearchFilters } from '@/contexts/SearchFiltersContext';
import { cn } from '@/lib/utils';
import type { MsHit } from '@/lib/meilisearch';
import { trackRowKey } from '@/lib/track-format';
import { TrackRow } from './TrackRow';
import { VirtualizedTrackList } from './VirtualizedTrackList';
import { WorkspaceFilterChips } from './WorkspaceFilterChips';
import { createStagingItem, useStagingSession } from '@/contexts/StagingSessionContext';
import { toast } from 'sonner';

type CatalogPanelProps = {
  onAddSong: (song: MsHit) => void;
  className?: string;
};

function CatalogPanelInner({ onAddSong, className }: CatalogPanelProps) {
  const { filters } = useSearchFilters();
  const { startStaging } = useStagingSession();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  const { results, warning, isFetching, isError, error, debouncedQuery, enabled } = useSearch(
    query,
    80,
    filters,
  );

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

  const toggleSelect = useCallback((song: MsHit) => {
    const key = trackRowKey(song);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedKeys(new Set());
  }, []);

  const selectedSongs = useMemo(
    () => results.filter((hit) => selectedKeys.has(trackRowKey(hit))),
    [results, selectedKeys],
  );

  const handleBulkToStaging = useCallback(() => {
    if (!selectedSongs.length) return;
    const lines = selectedSongs.map((s) => `${s.artist} - ${s.song_name}`);
    startStaging(
      lines.map((line) => createStagingItem(line)),
      null,
      null,
      query.trim() || null,
    );
    toast.success(`${selectedSongs.length} שירים נשלחו לאזור התאמה`);
    exitSelectionMode();
  }, [selectedSongs, startStaging, query, exitSelectionMode]);

  const handleBulkToPlaylist = useCallback(() => {
    if (!selectedSongs.length) return;
    for (const song of selectedSongs) onAddSong(song);
    toast.success(`נוספו ${selectedSongs.length} שירים לפלייליסט`);
    exitSelectionMode();
  }, [selectedSongs, onAddSong, exitSelectionMode]);

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      if (selectionMode) toggleSelect(results[activeIndex]);
      else handleAdd(results[activeIndex]);
    }
  };

  const renderRow = useCallback(
    (hit: MsHit, i: number) => {
      const key = trackRowKey(hit);
      const isSelected = selectedKeys.has(key);
      return (
        <TrackRow
          song={hit}
          showIndex={false}
          isSelected={selectionMode ? isSelected : i === activeIndex}
          selectionMode={selectionMode}
          onToggleSelect={() => toggleSelect(hit)}
          onAdd={selectionMode ? undefined : () => handleAdd(hit)}
          data-testid={`catalog-row-${hit.id}`}
          className={cn(
            (selectionMode ? isSelected : i === activeIndex) && 'bg-primary/8 j-cyan-rim-active',
          )}
        />
      );
    },
    [activeIndex, handleAdd, selectionMode, selectedKeys, toggleSelect],
  );

  return (
    <section className={cn('ws-col ws-col--catalog', className)} aria-label="קטלוג וחיפוש">
      <header className="ws-col__header">
        <h2 className="ws-col__title">קטלוג</h2>
        <span className="ws-col__meta tabular-nums">{hasResults ? results.length : '—'}</span>
      </header>

      <WorkspaceFilterChips />

      <div className="ws-col__toolbar px-2 pb-1.5">
        <div className="relative">
          <Input
            ref={inputRef}
            data-testid="search-input"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="חיפוש שיר, אמן, תגית…"
            className="ws-search-input h-8 rounded-lg pr-9 pl-2 text-xs bg-[hsl(var(--surface-1)/0.55)] border-border/40 j-cinematic-glass"
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
        {hasResults ? (
          <div className="flex items-center gap-1 mt-1.5">
            <Button
              type="button"
              variant={selectionMode ? 'default' : 'outline'}
              size="sm"
              className="h-6 text-[9px] rounded-md px-2"
              onClick={() => (selectionMode ? exitSelectionMode() : setSelectionMode(true))}
            >
              {selectionMode ? <CheckSquare className="h-3 w-3 ml-0.5" /> : <Square className="h-3 w-3 ml-0.5" />}
              {selectionMode ? `נבחרו ${selectedKeys.size}` : 'בחירה מרובה'}
            </Button>
            {selectionMode && selectedKeys.size > 0 ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  className="h-6 text-[9px] rounded-md px-2"
                  onClick={handleBulkToStaging}
                >
                  <Layers className="h-3 w-3 ml-0.5" />
                  להחזקה ({selectedKeys.size})
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-6 text-[9px] rounded-md px-2"
                  onClick={handleBulkToPlaylist}
                >
                  לפלייליסט ({selectedKeys.size})
                </Button>
              </>
            ) : null}
          </div>
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
        renderItem={(hit, i) => renderRow(hit, i)}
      />

      {hasResults ? (
        <p className="ws-col__hint shrink-0">
          {selectionMode ? 'לחץ לבחירה · להחזקה/פלייליסט בכפתורים למעלה' : '↑↓ · Enter להוספה'}
        </p>
      ) : null}
    </section>
  );
}

export const CatalogPanel = memo(CatalogPanelInner);
