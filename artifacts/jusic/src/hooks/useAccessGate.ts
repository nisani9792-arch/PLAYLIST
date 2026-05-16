import { useCallback, useEffect, useState } from 'react';
import {
  enterWithSavedOperator,
  fetchAccessStatus,
  getOperatorName,
  isDeviceTrusted,
  markDeviceTrusted,
  registerOperatorOnServer,
  type AccessStatus,
} from '@/lib/operator';

export function useAccessGate() {
  const [status, setStatus] = useState<AccessStatus>({ state: 'loading' });

  const refresh = useCallback(async () => {
    const cached = getOperatorName();

    try {
      const next = await fetchAccessStatus();
      if (next.state === 'ready') {
        markDeviceTrusted();
        setStatus(next);
        return;
      }

      // Server has no IP mapping — auto-enter if this device already completed setup.
      if (cached && isDeviceTrusted()) {
        setStatus(await enterWithSavedOperator(cached));
        return;
      }

      setStatus({
        state: 'locked',
        operatorName: cached,
      });
    } catch {
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

  const afterUnlock = useCallback(async () => {
    setStatus({ state: 'loading' });
    const cached = getOperatorName();
    if (cached) {
      setStatus(await enterWithSavedOperator(cached));
      return;
    }
    setStatus({ state: 'register', operatorName: null });
  }, []);

  const register = useCallback(async (operatorName: string) => {
    const name = await registerOperatorOnServer(operatorName);
    markDeviceTrusted();
    setStatus({ state: 'ready', operatorName: name });
  }, []);

  return { status, refresh, afterUnlock, register };
}
