import { useCallback, useEffect } from 'react';

const RESET_MS = 1600;
const REQUIRED_PRESSES = 3;
const JUSIC_CODE = 'JUSIC';

type UseUnlockGateOptions = {
  enabled: boolean;
  onUnlock: () => void;
};

/** Space×3 unlock — no session storage; parent handles IP registration. */
export const useUnlockGate = ({ enabled, onUnlock }: UseUnlockGateOptions) => {
  const unlock = useCallback(() => {
    onUnlock();
  }, [onUnlock]);

  useEffect(() => {
    if (!enabled) return;

    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    let pressCount = 0;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') return;
      event.preventDefault();

      pressCount += 1;
      if (pressCount >= REQUIRED_PRESSES) {
        unlock();
        pressCount = 0;
        return;
      }

      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        pressCount = 0;
      }, RESET_MS);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearTimeout(resetTimer);
    };
  }, [enabled, unlock]);

  return { unlock, jusicCode: JUSIC_CODE };
};
