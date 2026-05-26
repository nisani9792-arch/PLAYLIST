import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SearchFiltersProvider } from '@/contexts/SearchFiltersContext';
import Workspace from '@/pages/Workspace';
import SettingsPage from '@/pages/SettingsPage';
import NotFound from '@/pages/not-found';
import { StagingSessionProvider } from '@/contexts/StagingSessionContext';
import { useEffect } from 'react';
import { Route, Switch } from 'wouter';
import { flushSyncQueue } from '@/stores/workspace-store';
import { savePlaylistToServer, postStagingEvents, saveOperatorPreferences } from '@/lib/memory-api';
import LoginGateway from '@/pages/LoginGateway';
import { AppContextProvider, useAppContext } from '@/context/AppContext';
import { UnifiedShell } from '@/components/layout/UnifiedShell';

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
  const { auth, operatorName } = useAppContext();

  useEffect(() => {
    if (auth.state === 'ready') {
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
  }, [auth.state]);

  useEffect(() => {
    if (auth.state === 'offline') {
      toast.warning('אין חיבור לשרת — עובדים במצב מקומי עם השם השמור', {
        id: 'offline-mode',
        duration: 6000,
      });
    }
  }, [auth.state]);

  if (auth.state === 'loading' || auth.state === 'locked' || auth.state === 'register') {
    return <LoginGateway />;
  }

  const opName = operatorName ?? 'מפעיל';
  const offline = auth.state === 'offline';

  return (
    <UnifiedShell>
      <SearchFiltersProvider>
        <StagingSessionProvider>
          <Switch>
            <Route path="/settings">
              <SettingsPage operatorName={opName} />
            </Route>
            <Route path="/artist">
              <NotFound />
            </Route>
            <Route path="/service">
              <NotFound />
            </Route>
            <Route path="/dashboard">
              <Workspace operatorName={opName} offline={offline} />
            </Route>
            <Route path="/playlist">
              <Workspace operatorName={opName} offline={offline} />
            </Route>
            <Route>
              <Workspace operatorName={opName} offline={offline} />
            </Route>
          </Switch>
        </StagingSessionProvider>
      </SearchFiltersProvider>
    </UnifiedShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContextProvider>
          <AppShell />
        </AppContextProvider>
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
