import { create } from 'zustand';
import type { MsHit } from '@/lib/meilisearch';

type WorkspaceUiState = {
  targetPlaylistSize: number;
  lastCuratorVibe: string | null;
  syncQueueLength: number;
  setTargetPlaylistSize: (n: number) => void;
  setLastCuratorVibe: (vibe: string | null) => void;
  enqueueSync: () => void;
  dequeueSync: () => void;
};

export const useWorkspaceStore = create<WorkspaceUiState>((set) => ({
  targetPlaylistSize: 35,
  lastCuratorVibe: null,
  syncQueueLength: 0,
  setTargetPlaylistSize: (n) => set({ targetPlaylistSize: n }),
  setLastCuratorVibe: (vibe) => set({ lastCuratorVibe: vibe }),
  enqueueSync: () => set((s) => ({ syncQueueLength: s.syncQueueLength + 1 })),
  dequeueSync: () => set((s) => ({ syncQueueLength: Math.max(0, s.syncQueueLength - 1) })),
}));

export type PlaylistSyncItem = {
  id: string;
  type: 'playlist-save' | 'staging-events' | 'preferences';
  payload: unknown;
  createdAt: number;
};

const SYNC_KEY = 'jusic_playlist_sync_queue_v1';

export function loadSyncQueue(): PlaylistSyncItem[] {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PlaylistSyncItem[];
  } catch {
    return [];
  }
}

export function saveSyncQueue(items: PlaylistSyncItem[]): void {
  localStorage.setItem(SYNC_KEY, JSON.stringify(items.slice(-50)));
}

export function pushSyncItem(item: Omit<PlaylistSyncItem, 'id' | 'createdAt'>): void {
  const queue = loadSyncQueue();
  queue.push({
    ...item,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  });
  saveSyncQueue(queue);
  useWorkspaceStore.getState().enqueueSync();
}

export async function flushSyncQueue(
  handlers: Partial<Record<PlaylistSyncItem['type'], (payload: unknown) => Promise<void>>>,
): Promise<number> {
  const queue = loadSyncQueue();
  if (!queue.length) return 0;

  const remaining: PlaylistSyncItem[] = [];
  let flushed = 0;

  for (const item of queue) {
    const handler = handlers[item.type];
    if (!handler) {
      remaining.push(item);
      continue;
    }
    try {
      await handler(item.payload);
      flushed += 1;
    } catch {
      remaining.push(item);
    }
  }

  saveSyncQueue(remaining);
  useWorkspaceStore.setState({ syncQueueLength: remaining.length });
  return flushed;
}

export type { MsHit };
