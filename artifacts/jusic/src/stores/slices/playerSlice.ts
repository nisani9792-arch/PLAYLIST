import type { StateCreator } from 'zustand';

export type PlayerSlice = {
  targetPlaylistSize: number;
  lastCuratorVibe: string | null;
  setTargetPlaylistSize: (n: number) => void;
  setLastCuratorVibe: (vibe: string | null) => void;
};

export const createPlayerSlice: StateCreator<PlayerSlice, [], [], PlayerSlice> = (set) => ({
  targetPlaylistSize: 35,
  lastCuratorVibe: null,
  setTargetPlaylistSize: (n) => set({ targetPlaylistSize: n }),
  setLastCuratorVibe: (vibe) => set({ lastCuratorVibe: vibe }),
});
