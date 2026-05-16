import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Input } from '../ui/input';
import {
  Search,
  Loader2,
  Music,
  Plus,
  Tag,
  SearchX,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import type { MsHit } from '../../lib/meilisearch';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { useSearchFilters } from '@/contexts/SearchFiltersContext';
import { useSearch } from '@/hooks/use-search';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export function SearchBar({ onAddSong }: { onAddSong: (song: MsHit) => void }) {
  const { filters, genreInput, setGenre } = useSearchFilters();
  const isMobile = useIsMobile();
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showGenreFilter, setShowGenreFilter] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { results, warning, isFetching, isError, error, debouncedQuery, enabled } =
    useSearch(query, 24, filters);

  const openPanel = showDropdown && enabled;
  const hasResults = results.length > 0;
  const showEmpty = openPanel && !isFetching && !hasResults && !isError;
  const showError = openPanel && isError;

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

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      setShowDropdown(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const handleAdd = useCallback(
    (song: MsHit) => {
      onAddSong(song);
      setShowDropdown(false);
      setQuery('');
      inputRef.current?.focus();
    },
    [onAddSong],
  );

  const handleTagClick = (tag: string) => {
    setQuery(tag);
    setShowDropdown(true);
    inputRef.current?.focus();
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!openPanel && e.key === 'ArrowDown' && results.length > 0) {
      setShowDropdown(true);
      return;
    }
    if (!openPanel) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      handleAdd(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  useLayoutEffect(() => {
    if (!openPanel || !hasResults) return;
    const hit = results[activeIndex];
    if (!hit) return;
    document.getElementById(`search-result-${hit.id}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, openPanel, hasResults, results]);

  return (
    <div
      className="relative w-full z-[80]"
      ref={containerRef}
    >
      {isMobile && openPanel && (
        <div
          className="fixed inset-0 z-[60] bg-background/75"
          aria-hidden
          onClick={() => setShowDropdown(false)}
        />
      )}

      <div className="relative z-[70]">
        {isMobile ? (
          <button
            type="button"
            className="mb-2 flex w-full items-center justify-between rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground"
            onClick={() => setShowGenreFilter((v) => !v)}
          >
            <span>
              סינון ז׳אנר{genreInput.trim() ? `: ${genreInput.trim()}` : ' (אופציונלי)'}
            </span>
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', showGenreFilter && 'rotate-180')}
            />
          </button>
        ) : null}

        {(showGenreFilter || !isMobile) && (
          <div
            className={cn(
              'bp-glass-panel flex flex-wrap items-center gap-2 sm:gap-3 rounded-2xl px-2.5 sm:px-3.5 py-2 shadow-sm bg-card/95',
              isMobile && 'mb-2',
            )}
            data-testid="search-filters-bar"
          >
            {!isMobile && (
              <span className="text-[11px] font-semibold text-foreground/80 shrink-0">
                סינון ז׳אנר
              </span>
            )}
            <div className="flex-1 min-w-0">
              <Input
                placeholder="ז׳אנר מדויק (אופציונלי)"
                className="h-10 sm:h-8 text-base sm:text-xs rounded-xl border-border/70 bg-background"
                value={genreInput}
                onChange={(e) => setGenre(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="relative">
          <Input
            ref={inputRef}
            data-testid="search-input"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="חיפוש שירים — שיר, אמן, אלבום, תגית…"
            className="h-12 rounded-[1rem] pr-12 pl-12 text-base font-medium bg-card border-border/70 shadow-md focus-visible:ring-2 focus-visible:ring-primary/35"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(e.target.value.trim().length >= 2);
            }}
            onFocus={() => {
              if (enabled) setShowDropdown(true);
            }}
            onKeyDown={onInputKeyDown}
            aria-expanded={openPanel}
            aria-controls="search-results-listbox"
            aria-activedescendant={
              openPanel && results[activeIndex]
                ? `search-result-${results[activeIndex].id}`
                : undefined
            }
            role="combobox"
            aria-autocomplete="list"
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-primary rounded-lg bg-primary/10 p-1 pointer-events-none">
            <Search className="w-4 h-4" />
          </span>
          {isFetching && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            </span>
          )}
          {query.length > 0 && query.length < 2 && (
            <p className="absolute top-full mt-1 text-[10px] text-muted-foreground font-medium px-1">
              הקלד לפחות 2 תווים…
            </p>
          )}
        </div>

        {openPanel && (
          <div
            id="search-results-listbox"
            role="listbox"
            data-testid="search-results-dropdown"
            className={cn(
              'absolute left-0 right-0 top-full mt-2 z-[80] overflow-hidden rounded-[1rem] border border-border/80 bg-card shadow-2xl',
              'max-h-[min(22rem,58dvh)] sm:max-h-[26rem] overflow-y-auto custom-scrollbar',
              isMobile && 'fixed left-3 right-3 top-auto bottom-[max(0.75rem,env(safe-area-inset-bottom))] mt-0 max-h-[min(24rem,62dvh)]',
            )}
          >
            {isFetching && !hasResults && (
              <div className="p-6 flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs font-medium">מחפש במאגר…</span>
              </div>
            )}

            {showError && (
              <div className="p-5 flex flex-col items-center gap-2 text-center">
                <AlertCircle className="w-8 h-8 text-destructive/80" />
                <p className="text-sm font-semibold">שגיאת חיפוש</p>
                <p className="text-xs text-muted-foreground max-w-[16rem]">
                  {error?.message ?? 'ודא שהשרת רץ וש-Meilisearch מוגדר.'}
                </p>
              </div>
            )}

            {showEmpty && (
              <div className="p-5 flex flex-col items-center gap-2 text-center">
                <SearchX className="w-8 h-8 text-muted-foreground/70" />
                <p className="text-sm font-semibold">לא נמצאו שירים</p>
                <p className="text-xs text-muted-foreground">
                  נסה מילים אחרות{genreInput.trim() ? ' או הסר את סינון הז׳אנר' : ''}.
                </p>
              </div>
            )}

            {hasResults &&
              results.map((hit, i) => (
                <div
                  key={hit.id}
                  id={`search-result-${hit.id}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={cn(
                    'flex flex-col p-3 border-b border-border/50 last:border-0 cursor-pointer active:bg-primary/10',
                    i === activeIndex ? 'bg-primary/[0.08]' : 'hover:bg-muted/50',
                  )}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => handleAdd(hit)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="bg-primary/10 p-2 rounded-xl text-primary shrink-0">
                        <Music className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate text-sm">{hit.song_name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {hit.artist}
                          {hit.album ? ` · ${hit.album}` : ''}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="rounded-xl h-10 sm:h-9 px-4 text-xs font-semibold shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAdd(hit);
                      }}
                    >
                      <Plus className="w-4 h-4 ml-1" /> הוסף
                    </Button>
                  </div>
                  {hit.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 pr-2">
                      {hit.tags.slice(0, 5).map((tag, ti) => (
                        <button
                          type="button"
                          key={`${hit.id}-${ti}-${tag}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTagClick(tag);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-muted text-muted-foreground border border-border/60"
                        >
                          <Tag className="w-2.5 h-2.5" />
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

            {hasResults && !isMobile && (
              <p className="sticky bottom-0 px-3 py-2 text-[10px] text-center text-muted-foreground bg-card border-t border-border/50">
                ↑↓ לניווט · Enter להוספה · Esc לסגירה
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
