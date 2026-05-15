import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SearchFiltersProvider } from '@/contexts/SearchFiltersContext';
import { LockScreen } from '@/components/LockScreen';
import { useUnlockGate } from '@/hooks/useUnlockGate';
import Workspace from '@/pages/Workspace';

const queryClient = new QueryClient();

function AppShell() {
  const { unlocked, unlock } = useUnlockGate();

  if (!unlocked) {
    return <LockScreen onUnlock={unlock} />;
  }

  return (
    <SearchFiltersProvider>
      <Workspace />
    </SearchFiltersProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppShell />
        <Toaster
          theme="dark"
          dir="rtl"
          toastOptions={{
            classNames: {
              toast:
                'rounded-xl border border-white/15 bg-neutral-950/95 backdrop-blur-xl shadow-xl font-sans',
              title: 'font-semibold',
              description: 'text-muted-foreground',
            },
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
