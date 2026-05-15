import { motion } from 'framer-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SearchFiltersProvider } from '@/contexts/SearchFiltersContext';
import { LockScreen } from '@/components/LockScreen';
import { OperatorRegistration } from '@/components/OperatorRegistration';
import { useAccessGate } from '@/hooks/useAccessGate';
import { useUnlockGate } from '@/hooks/useUnlockGate';
import Workspace from '@/pages/Workspace';

const queryClient = new QueryClient();

function AppShell() {
  const { status, afterUnlock, register } = useAccessGate();
  const locked = status.state === 'locked';
  useUnlockGate({ enabled: locked, onUnlock: afterUnlock });

  if (status.state === 'loading') {
    return (
      <motion.div className="lock-screen flex items-center justify-center min-h-[100dvh]" aria-busy="true">
        <p className="text-muted-foreground text-sm">טוען...</p>
      </motion.div>
    );
  }

  if (status.state === 'locked') {
    return <LockScreen onUnlock={afterUnlock} />;
  }

  if (status.state === 'register') {
    return <OperatorRegistration onComplete={register} />;
  }

  return (
    <SearchFiltersProvider>
      <Workspace operatorName={status.operatorName} />
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
