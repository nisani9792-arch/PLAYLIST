import { useEffect } from 'react';
import {
  Archive,
  ListMusic,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';

export type WorkspaceCommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  canSmartFill: boolean;
  canCommit: boolean;
  onFocusSearch: () => void;
  onSmartFill: () => void;
  onCommitPlaylist: () => void;
  onClearPlaylist: () => void;
};

export function WorkspaceCommandPalette({
  open,
  onOpenChange,
  searchQuery,
  onSearchQueryChange,
  canSmartFill,
  canCommit,
  onFocusSearch,
  onSmartFill,
  onCommitPlaylist,
  onClearPlaylist,
}: WorkspaceCommandPaletteProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onOpenChange, open]);

  const run = (fn: () => void) => {
    fn();
    onOpenChange(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="חפש שיר או פעולה…"
        value={searchQuery}
        onValueChange={onSearchQueryChange}
      />
      <CommandList>
        <CommandEmpty>לא נמצאה פעולה</CommandEmpty>

        <CommandGroup heading="חיפוש">
          <CommandItem onSelect={() => run(onFocusSearch)}>
            <Search className="size-4" />
            <span>מיקוד בשדה חיפוש</span>
            <CommandShortcut>/</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="פלייליסט">
          <CommandItem disabled={!canSmartFill} onSelect={() => run(onSmartFill)}>
            <Wand2 className="size-4" />
            <span>השלמת פלייליסט חכמה</span>
          </CommandItem>
          <CommandItem disabled={!canCommit} onSelect={() => run(onCommitPlaylist)}>
            <Upload className="size-4" />
            <span>שמירה / פרסום פלייליסט</span>
          </CommandItem>
          <CommandItem onSelect={() => run(onClearPlaylist)}>
            <Trash2 className="size-4" />
            <span>ניקוי הפלייליסט</span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="סטודיו">
          <CommandItem
            onSelect={() =>
              run(() => window.dispatchEvent(new Event('workspace:focus-composer')))
            }
          >
            <Sparkles className="size-4" />
            <span>מיקוד ב-Curator AI</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              run(() => window.dispatchEvent(new Event('workspace:focus-catalog')))
            }
          >
            <ListMusic className="size-4" />
            <span>מיקוד בקטלוג</span>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              run(() => window.dispatchEvent(new Event('workspace:focus-playlist')))
            }
          >
            <Archive className="size-4" />
            <span>מיקוד בפלייליסט</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
