import { useCallback, useEffect, useState } from 'react';
import {
  fetchAccessStatus,
  registerOperatorOnServer,
  type AccessStatus,
} from '@/lib/operator';

export function useAccessGate() {
  const [status, setStatus] = useState<AccessStatus>({ state: 'loading' });

  const refresh = useCallback(async () => {
    try {
      const next = await fetchAccessStatus();
      setStatus(next);
    } catch {
      setStatus({ state: 'locked', operatorName: null });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const afterUnlock = useCallback(() => {
    setStatus((prev) =>
      prev.state === 'ready' ? prev : { state: 'register', operatorName: null },
    );
  }, []);

  const register = useCallback(async (operatorName: string) => {
    const name = await registerOperatorOnServer(operatorName);
    setStatus({ state: 'ready', operatorName: name });
  }, []);

  return { status, refresh, afterUnlock, register };
}
