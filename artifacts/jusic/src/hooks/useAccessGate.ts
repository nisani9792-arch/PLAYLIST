import { useCallback, useEffect, useState } from 'react';
import {
  fetchAccessStatus,
  getOperatorName,
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
      const cached = getOperatorName();
      if (cached) {
        setStatus({ state: 'offline', operatorName: cached });
      } else {
        setStatus({ state: 'locked', operatorName: null });
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const afterUnlock = useCallback(() => {
    setStatus((prev) => {
      if (prev.state === 'ready' || prev.state === 'offline') return prev;
      return { state: 'register', operatorName: null };
    });
  }, []);

  const register = useCallback(async (operatorName: string) => {
    const name = await registerOperatorOnServer(operatorName);
    setStatus({ state: 'ready', operatorName: name });
  }, []);

  return { status, refresh, afterUnlock, register };
}
