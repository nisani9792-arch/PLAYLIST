import { create } from 'zustand';
import type { MsHit } from '@/lib/meilisearch';
import { createSearchSlice, type SearchSlice } from './slices/searchSlice';
import { createPlayerSlice, type PlayerSlice } from './slices/playerSlice';
import {
  createStagingSlice,
  loadSyncQueue,
  saveSyncQueue,
  type PlaylistSyncItem,
  type StagingSlice,
} from './slices/stagingSlice';

export type WorkspaceStore = SearchSlice & PlayerSlice & StagingSlice;

export const useWorkspaceStore = create<WorkspaceStore>()((...args) => ({
  ...createSearchSlice(...args),
  ...createPlayerSlice(...args),
  ...createStagingSlice(...args),
}));

export type { PlaylistSyncItem, MsHit };
export type { VibeFilter } from './slices/searchSlice';

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
  useWorkspaceStore.getState().setSyncQueueLength(remaining.length);
  return flushed;
}
