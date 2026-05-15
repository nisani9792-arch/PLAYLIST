import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SearchFiltersProvider } from '@/contexts/SearchFiltersContext';
import { LockScreen } from '@/components/LockScreen';
import { OperatorRegistration } from '@/components/OperatorRegistration';
import { useAccessGate } from '@/hooks/useAccessGate';
import { useUnlockGate } from '@/hooks/useUnlockGate';
import Workspace from '@/pages/Workspace';
import { useEffect } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppShell() {
  const { status, afterUnlock, register } = useAccessGate();
  const locked = status.state === 'locked';
  useUnlockGate({ enabled: locked, onUnlock: afterUnlock });

  useEffect(() => {
    if (status.state === 'offline') {
      toast.warning('אין חיבור לשרת — עובדים במצב מקומי עם השם השמור', {
        id: 'offline-mode',
        duration: 6000,
      });
    }
  }, [status.state]);

  if (status.state === 'loading') {
    return (
      <div className="lock-screen flex items-center justify-center min-h-[100dvh]" aria-busy="true">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          <p className="text-muted-foreground text-sm">טוען BUILD PLAY…</p>
        </div>
      </div>
    );
  }

  if (status.state === 'locked') {
    return <LockScreen onUnlock={afterUnlock} />;
  }

  if (status.state === 'register') {
    return <OperatorRegistration onComplete={register} />;
  }

  const operatorName =
    status.state === 'ready'
      ? status.operatorName
      : status.state === 'offline'
        ? (status.operatorName ?? '')
        : '';

  return (
    <SearchFiltersProvider>
      <Workspace operatorName={operatorName} offline={status.state === 'offline'} />
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
