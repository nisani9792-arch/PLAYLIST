import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '../ui/input';
import {
  Search,
  Loader2,
  Music,
  Plus,
  Tag,
  Sparkles,
  SearchX,
  AlertCircle,
} from 'lucide-react';
import type { MsHit } from '../../lib/meilisearch';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useSearchFilters } from '@/contexts/SearchFiltersContext';
import { useSearch } from '@/hooks/use-search';
import { cn } from '@/lib/utils';

export function SearchBar({ onAddSong }: { onAddSong: (song: MsHit) => void }) {
  const { filters, genreInput, setGenre } = useSearchFilters();
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropdownRect, setDropdownRect] = useState<DOMRect | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const { results, warning, isFetching, isError, error, debouncedQuery, enabled } =
    useSearch(query, 24, filters);

  const openPanel = showDropdown && enabled;
  const hasResults = results.length > 0;
  const showEmpty = openPanel && !isFetching && !hasResults && !isError;
  const showError = openPanel && isError;

  const updateDropdownPosition = useCallback(() => {
    if (!inputWrapRef.current) return;
    setDropdownRect(inputWrapRef.current.getBoundingClientRect());
  }, []);

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
    if (!openPanel) return;
    updateDropdownPosition();
    const onScrollOrResize = () => updateDropdownPosition();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [openPanel, updateDropdownPosition]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  const dropdownPanel = openPanel && dropdownRect && (
    <>
      <div
        className="fixed inset-0 z-[90] bg-background/72 backdrop-blur-[2px] md:hidden"
        aria-hidden
        onClick={() => setShowDropdown(false)}
      />
      <motion.div
        id="search-results-listbox"
        role="listbox"
        data-testid="search-results-dropdown"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.14, ease: 'easeOut' }}
        className={cn(
          'z-[100] overflow-hidden rounded-[1rem] border border-border/80 bg-card shadow-2xl ring-1 ring-primary/10',
          'max-h-[min(24rem,52dvh)] sm:max-h-[28rem] overflow-y-auto custom-scrollbar',
          'md:absolute md:top-full md:left-0 md:right-0 md:mt-2.5',
        )}
        style={
          isMobile
            ? {
                position: 'fixed',
                top: dropdownRect.bottom + 8,
                left: Math.max(12, dropdownRect.left),
                width: Math.min(dropdownRect.width, window.innerWidth - 24),
                right: 'auto',
              }
            : {
                position: 'fixed',
                top: dropdownRect.bottom + 8,
                left: dropdownRect.left,
                width: dropdownRect.width,
              }
        }
      >
        {isFetching && !hasResults && (
          <motion.div
            className="p-6 flex flex-col items-center gap-2 text-muted-foreground bg-card"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs font-medium">מחפש במאגר…</span>
          </motion.div>
        )}

        {showError && (
          <motion.div className="p-5 flex flex-col items-center gap-2 text-center bg-card">
            <AlertCircle className="w-8 h-8 text-destructive/80" />
            <p className="text-sm font-semibold text-foreground">שגיאת חיפוש</p>
            <p className="text-xs text-muted-foreground max-w-[16rem]">
              {error?.message ?? 'ודא שהשרת רץ וש-Meilisearch מוגדר.'}
            </p>
          </motion.div>
        )}

        {showEmpty && (
          <motion.div className="p-5 flex flex-col items-center gap-2 text-center bg-card">
            <SearchX className="w-8 h-8 text-muted-foreground/70" />
            <p className="text-sm font-semibold">לא נמצאו שירים</p>
            <p className="text-xs text-muted-foreground">
              נסה מילים אחרות{genreInput.trim() ? ' או הסר את סינון הז׳אנר' : ''}.
            </p>
          </motion.div>
        )}

        {hasResults &&
          results.map((hit, i) => (
            <motion.div
              key={hit.id}
              id={`search-result-${hit.id}`}
              role="option"
              aria-selected={i === activeIndex}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02, duration: 0.12 }}
              className={cn(
                'flex flex-col p-2.5 sm:p-3.5 border-b border-border/50 last:border-0 transition-colors cursor-pointer bg-card',
                i === activeIndex
                  ? 'bg-primary/[0.08]'
                  : 'hover:bg-muted/60',
              )}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => handleAdd(hit)}
            >
              <motion.div
                className="flex items-center justify-between gap-2 sm:gap-3"
                whileHover={{ x: 2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="bg-primary/10 p-2 rounded-xl text-primary shrink-0 border border-primary/20">
                    <Music className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="font-semibold truncate text-sm text-foreground">
                      {hit.song_name}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 truncate">
                      <span className="truncate">{hit.artist}</span>
                      {hit.album && (
                        <>
                          <span className="opacity-40">·</span>
                          <span className="truncate opacity-70">{hit.album}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {hit.genre && (
                    <Badge
                      variant="secondary"
                      className="hidden sm:inline-flex bg-primary/8 text-primary border border-primary/15 rounded-lg text-[10px]"
                    >
                      {hit.genre}
                    </Badge>
                  )}
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      size="sm"
                      className="rounded-xl h-9 sm:h-8 px-3.5 text-xs font-semibold shadow-md shadow-primary/15"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAdd(hit);
                      }}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> הוסף
                    </Button>
                  </motion.div>
                </div>
              </motion.div>

              {hit.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 pr-10">
                  {hit.tags.slice(0, 6).map((tag, ti) => (
                    <motion.button
                      type="button"
                      key={`${hit.id}-${ti}-${tag}`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTagClick(tag);
                      }}
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-muted text-muted-foreground border border-border/60 hover:border-primary/35 hover:bg-primary/8 hover:text-primary transition-colors cursor-pointer font-medium"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {tag}
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          ))}

        {hasResults && (
          <p className="hidden sm:block sticky bottom-0 px-3 py-2 text-[10px] text-center text-muted-foreground bg-card border-t border-border/50">
            ↑↓ לניווט · Enter להוספה · Esc לסגירה
          </p>
        )}
      </motion.div>
    </>
  );

  return (
    <div
      className="relative w-full md:max-w-3xl md:mx-auto z-[80]"
      ref={containerRef}
    >
      <div
        className="bp-glass-panel flex flex-wrap items-center gap-2 sm:gap-3 rounded-2xl sm:rounded-[1.35rem] px-2.5 sm:px-3.5 py-2.5 shadow-sm bg-card/95"
        data-testid="search-filters-bar"
      >
        <div className="flex items-center gap-2 text-primary/80">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/10 border border-primary/15 shrink-0">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="text-[11px] font-semibold hidden sm:inline text-foreground/80">
            חיפוש שירים בלבד
          </span>
        </div>
        <div className="flex-1 min-w-[9rem] sm:max-w-xs">
          <Input
            placeholder="סינון ז׳אנר (מדויק, אופציונלי)"
            className="h-9 sm:h-8 text-base sm:text-xs rounded-xl border-border/70 bg-background shadow-inner focus-visible:ring-2 focus-visible:ring-primary/25"
            value={genreInput}
            onChange={(e) => setGenre(e.target.value)}
          />
        </div>
        <p className="text-[10px] text-muted-foreground hidden md:flex max-w-[14rem] leading-snug items-center gap-1.5 font-medium opacity-85">
          ייבוא מטקסט ו-AI משתמשים באותו סינון ז׳אנר.
        </p>
      </div>

      <div className="relative group mt-2.5 sm:mt-3" ref={inputWrapRef}>
        <Input
          ref={inputRef}
          data-testid="search-input"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="חיפוש שירים — שיר, אמן, אלבום, תגית…"
          className="h-11 sm:h-12 rounded-[1rem] sm:rounded-[1.15rem] pr-12 pl-12 text-[0.9375rem] sm:text-base font-medium bg-card border-border/70 shadow-md focus-visible:ring-2 focus-visible:ring-primary/35 placeholder:text-muted-foreground/55"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length >= 2) {
              setShowDropdown(true);
              updateDropdownPosition();
            } else {
              setShowDropdown(false);
            }
          }}
          onFocus={() => {
            if (enabled) {
              setShowDropdown(true);
              updateDropdownPosition();
            }
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
        <motion.div
          className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-primary rounded-lg bg-primary/10 p-1"
          animate={isFetching ? { rotate: [0, 8, -8, 0] } : { rotate: 0 }}
          transition={{ duration: 0.5, repeat: isFetching ? Infinity : 0 }}
        >
          <Search className="w-4 h-4" />
        </motion.div>
        <motion.div
          className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2"
          initial={false}
          animate={{ opacity: isFetching ? 1 : 0, scale: isFetching ? 1 : 0.8 }}
        >
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        </motion.div>
        {query.length > 0 && query.length < 2 && (
          <p className="absolute top-full mt-1.5 text-[10px] text-muted-foreground font-medium px-1">
            הקלד לפחות 2 תווים…
          </p>
        )}

        <AnimatePresence>
          {openPanel &&
            dropdownPanel &&
            typeof document !== 'undefined' &&
            createPortal(dropdownPanel, document.body)}
        </AnimatePresence>
      </div>
    </div>
  );
}
