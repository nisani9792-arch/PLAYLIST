import { lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { WorkspaceHelpPopover } from './WorkspaceHelpPopover';
import { LearningExportButton } from './LearningExportButton';
import { InstallAppButton } from './InstallAppButton';
import { ApiStatusIndicator } from './ApiStatusIndicator';
import { Menu, Settings } from 'lucide-react';
import { Link } from 'wouter';

const OfflinePlaylistMasterDialog = lazy(() =>
  import('./OfflinePlaylistMasterDialog').then((m) => ({
    default: m.OfflinePlaylistMasterDialog,
  })),
);

export function WorkspaceToolsMenu({ compact = false }: { compact?: boolean }) {
  if (!compact) {
    return (
      <div className="flex items-center justify-end gap-0.5 sm:gap-1 shrink-0">
        <ApiStatusIndicator />
        <InstallAppButton />
        <Suspense fallback={null}>
          <OfflinePlaylistMasterDialog />
        </Suspense>
        <LearningExportButton />
        <WorkspaceHelpPopover />
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" title="הגדרות">
            <Settings className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0" aria-label="תפריט">
          <Menu className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/settings" className="w-full cursor-pointer">
            <Settings className="h-4 w-4 ml-2" />
            הגדרות
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="p-0 focus:bg-transparent" onSelect={(e) => e.preventDefault()}>
          <div className="flex flex-wrap gap-1 p-2 w-full justify-end">
            <ApiStatusIndicator />
            <InstallAppButton />
            <Suspense fallback={null}>
              <OfflinePlaylistMasterDialog />
            </Suspense>
            <LearningExportButton />
            <WorkspaceHelpPopover />
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
