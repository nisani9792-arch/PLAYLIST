import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { StagingItem } from '@/components/workspace/StagingArea';
import type { StagingParashaContext } from '@/lib/staging-context';
import { newClientId } from '@/lib/ids';

type StagingSessionContextValue = {
  stagingItems: StagingItem[];
  setStagingItems: React.Dispatch<React.SetStateAction<StagingItem[]>>;
  stagingBatchId: number;
  bumpStagingBatch: () => void;
  parashaContext: StagingParashaContext | null;
  setParashaContext: (ctx: StagingParashaContext | null) => void;
  /** Suggested playlist title when operator did not set one (topic / parasha). */
  stagingBuildLabel: string | null;
  stagingActive: boolean;
  clearStaging: () => void;
  startStaging: (
    items: StagingItem[],
    parasha?: StagingParashaContext | null,
    buildLabel?: string | null,
  ) => void;
};

const StagingSessionContext = createContext<StagingSessionContextValue | null>(null);

export function StagingSessionProvider({ children }: { children: ReactNode }) {
  const [stagingItems, setStagingItems] = useState<StagingItem[]>([]);
  const [stagingBatchId, setStagingBatchId] = useState(0);
  const [parashaContext, setParashaContext] = useState<StagingParashaContext | null>(null);
  const [stagingBuildLabel, setStagingBuildLabel] = useState<string | null>(null);

  const bumpStagingBatch = useCallback(() => {
    setStagingBatchId((b) => b + 1);
  }, []);

  const clearStaging = useCallback(() => {
    setStagingItems([]);
    setParashaContext(null);
    setStagingBuildLabel(null);
  }, []);

  const startStaging = useCallback(
    (items: StagingItem[], parasha?: StagingParashaContext | null, buildLabel?: string | null) => {
      setParashaContext(parasha ?? null);
      setStagingBuildLabel(buildLabel ?? null);
      setStagingBatchId((b) => b + 1);
      setStagingItems(items);
    },
    [],
  );

  const stagingActive = stagingItems.length > 0;

  const value = useMemo(
    () => ({
      stagingItems,
      setStagingItems,
      stagingBatchId,
      bumpStagingBatch,
      parashaContext,
      setParashaContext,
      stagingBuildLabel,
      stagingActive,
      clearStaging,
      startStaging,
    }),
    [
      stagingItems,
      stagingBatchId,
      bumpStagingBatch,
      parashaContext,
      stagingBuildLabel,
      stagingActive,
      clearStaging,
      startStaging,
    ],
  );

  return (
    <StagingSessionContext.Provider value={value}>{children}</StagingSessionContext.Provider>
  );
}

export function useStagingSession(): StagingSessionContextValue {
  const ctx = useContext(StagingSessionContext);
  if (!ctx) {
    throw new Error('useStagingSession must be used within StagingSessionProvider');
  }
  return ctx;
}

export function createStagingItem(query: string, pshRow?: StagingItem['pshRow']): StagingItem {
  return {
    id: newClientId(),
    query,
    status: 'pending',
    pshRow,
  };
}
