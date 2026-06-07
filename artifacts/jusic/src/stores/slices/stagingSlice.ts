import type { StateCreator } from 'zustand';

export type PlaylistSyncItem = {
  id: string;
  type: 'playlist-save' | 'staging-events' | 'preferences';
  payload: unknown;
  createdAt: number;
};

export type StagingSlice = {
  syncQueueLength: number;
  enqueueSync: () => void;
  dequeueSync: () => void;
  setSyncQueueLength: (n: number) => void;
};

export const SYNC_KEY = 'jusic_playlist_sync_queue_v1';

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

export const createStagingSlice: StateCreator<StagingSlice, [], [], StagingSlice> = (set) => ({
  syncQueueLength: 0,
  enqueueSync: () => set((s) => ({ syncQueueLength: s.syncQueueLength + 1 })),
  dequeueSync: () => set((s) => ({ syncQueueLength: Math.max(0, s.syncQueueLength - 1) })),
  setSyncQueueLength: (n) => set({ syncQueueLength: n }),
});
