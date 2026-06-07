import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SearchFiltersProvider } from '@/contexts/SearchFiltersContext';
import { LockScreen } from '@/components/LockScreen';
import { OperatorRegistration } from '@/components/OperatorRegistration';
import { useAccessGate } from '@/hooks/useAccessGate';
import { useUnlockGate } from '@/hooks/useUnlockGate';
import Workspace from '@/pages/Workspace';
import SettingsPage from '@/pages/SettingsPage';
import { StagingSessionProvider } from '@/contexts/StagingSessionContext';
import { useEffect } from 'react';
import { Route, Switch } from 'wouter';
import { APP_SHORT_NAME } from '@/lib/brand';
import { flushSyncQueue } from '@/stores/workspace-store';
import { savePlaylistToServer, postStagingEvents, saveOperatorPreferences } from '@/lib/memory-api';
import { ErrorBoundary } from '@/components/ErrorBoundary';

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
  useUnlockGate({ enabled: locked, onUnlock: () => void afterUnlock() });

  useEffect(() => {
    if (status.state === 'ready') {
      void flushSyncQueue({
        'playlist-save': async (payload) => {
          await savePlaylistToServer(payload as Parameters<typeof savePlaylistToServer>[0]);
        },
        'staging-events': async (payload) => {
          await postStagingEvents(payload as Parameters<typeof postStagingEvents>[0]);
        },
        preferences: async (payload) => {
          await saveOperatorPreferences(payload as Parameters<typeof saveOperatorPreferences>[0]);
        },
      });
    }
  }, [status.state]);

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
      <div className="app-loading flex items-center justify-center min-h-[100svh] min-h-[100dvh]" aria-busy="true">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-2 border-primary/25 border-t-primary animate-spin" />
          <p className="text-secondary text-sm font-medium">טוען {APP_SHORT_NAME}…</p>
        </div>
      </div>
    );
  }

  if (status.state === 'locked') {
    return (
      <LockScreen
        onUnlock={() => void afterUnlock()}
        knownOperatorName={status.operatorName}
      />
    );
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
    <ErrorBoundary label="האפליקציה">
      <SearchFiltersProvider>
        <StagingSessionProvider>
          <Switch>
            <Route path="/settings">
              <ErrorBoundary label="הגדרות">
                <SettingsPage operatorName={operatorName} />
              </ErrorBoundary>
            </Route>
            <Route>
              <ErrorBoundary label="סביבת העבודה">
                <Workspace operatorName={operatorName} offline={status.state === 'offline'} />
              </ErrorBoundary>
            </Route>
          </Switch>
        </StagingSessionProvider>
      </SearchFiltersProvider>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppShell />
        <Toaster
          theme="light"
          dir="rtl"
          toastOptions={{
            classNames: {
              toast:
                'rounded-2xl border border-primary/20 bg-card shadow-lg font-sans text-foreground',
              title: 'font-semibold',
              description: 'text-secondary',
            },
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
