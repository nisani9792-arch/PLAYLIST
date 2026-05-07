import { useState, useEffect, useRef } from 'react';
import { Input } from '../ui/input';
import { Search, Loader2, Music, Plus, Tag, Filter } from 'lucide-react';
import { MsHit, meilisearchSearch } from '../../lib/meilisearch';
import { useDebounce } from '../../hooks/use-debounce';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useSearchFilters } from '@/contexts/SearchFiltersContext';

export function SearchBar({ onAddSong }: { onAddSong: (song: MsHit) => void }) {
  const { filters, genreInput, setSongsOnly, setGenre } = useSearchFilters();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 350);
  const [results, setResults] = useState<MsHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRequestId = useRef(0);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const id = ++searchRequestId.current;
    setIsSearching(true);

    void (async () => {
      try {
        const hits = await meilisearchSearch(debouncedQuery, 20, filters);
        if (id !== searchRequestId.current) return;
        setResults(hits);
        setShowDropdown(true);
      } catch (e) {
        if (id !== searchRequestId.current) return;
        const msg =
          e instanceof Error ? e.message : 'שגיאת חיפוש. נסה שוב.';
        toast.error(msg);
        setResults([]);
      } finally {
        if (id === searchRequestId.current) {
          setIsSearching(false);
        }
      }
    })();
  }, [debouncedQuery, filters.songsOnly, filters.genre]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAdd = (song: MsHit) => {
    onAddSong(song);
    setShowDropdown(false);
    setQuery('');
  };

  const handleTagClick = (tag: string) => {
    setQuery(tag);
    setShowDropdown(false);
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto z-50 space-y-2" ref={containerRef}>
      <div
        className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/[0.06] bg-white/80 px-3 py-2 shadow-sm"
        data-testid="search-filters-bar"
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <Filter className="h-3.5 w-3.5 shrink-0" />
          <span className="text-[11px] font-medium hidden sm:inline">לפני חיפוש</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="filter-songs-only"
            checked={filters.songsOnly}
            onCheckedChange={(v) => setSongsOnly(v)}
          />
          <Label htmlFor="filter-songs-only" className="text-xs cursor-pointer font-normal">
            רק שירים
          </Label>
        </div>
        <div className="flex-1 min-w-[8rem] max-w-xs">
          <Input
            placeholder={'סינון ז׳אנר (מדויק, אופציונלי)'}
            className="h-8 text-xs rounded-xl bg-white/90 border-black/10"
            value={genreInput}
            onChange={(e) => setGenre(e.target.value)}
          />
        </div>
        <p className="text-[10px] text-muted-foreground hidden md:block max-w-[14rem] leading-tight">
          ייבוא מטקסט ו-AI משתמשים באותם פילטרים.
        </p>
      </div>

      <div className="relative">
        <Input
          data-testid="search-input"
          type="text"
          placeholder="חיפוש שירים — שם שיר, אמן, תגית..."
          className="h-12 rounded-2xl pr-12 pl-12 text-base bg-white border-black/10 focus-visible:ring-primary/30 focus-visible:border-primary/40 placeholder:text-muted-foreground/50 shadow-[0_2px_12px_rgba(0,0,0,0.07),0_0_0_1px_rgba(0,0,0,0.06)]"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.length < 2) setShowDropdown(false);
          }}
          onFocus={() => {
            if (results.length > 0) setShowDropdown(true);
          }}
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary/60">
          <Search className="w-4 h-4" />
        </div>
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          {isSearching && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        </div>
      </div>

      <AnimatePresence>
        {showDropdown && results.length > 0 && (
          <motion.div
            data-testid="search-results-dropdown"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-full left-0 right-0 mt-2 border border-black/[0.07] rounded-2xl overflow-hidden max-h-[30rem] overflow-y-auto z-[60]"
            style={{
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 1px 0 rgba(0,0,0,0.05)',
            }}
          >
            {results.map((hit, i) => (
              <motion.div
                key={hit.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.025, duration: 0.12 }}
                className="flex flex-col p-3 hover:bg-primary/[0.04] border-b border-black/[0.05] last:border-0 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="bg-primary/10 p-2 rounded-xl text-primary flex-shrink-0 border border-primary/15">
                      <Music className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="font-semibold truncate text-sm text-foreground">{hit.song_name}</div>
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
                        className="rounded-xl h-7 px-3 text-xs shadow-sm"
                        onClick={() => handleAdd(hit)}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> הוסף
                      </Button>
                    </motion.div>
                  </div>
                </div>

                {hit.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 pr-10">
                    {hit.tags.map((tag, ti) => (
                      <motion.button
                        type="button"
                        key={`${hit.id}-${ti}-${tag}`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleTagClick(tag)}
                        className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg bg-muted text-muted-foreground border border-black/[0.07] hover:bg-primary/10 hover:text-primary hover:border-primary/25 transition-colors cursor-pointer"
                      >
                        <Tag className="w-2.5 h-2.5" />
                        {tag}
                      </motion.button>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
