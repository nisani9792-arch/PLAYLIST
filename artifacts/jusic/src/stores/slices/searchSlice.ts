import type { StateCreator } from 'zustand';

export type VibeFilter = 'quiet' | 'energetic' | 'mixed' | 'celebratory' | 'emotional' | null;

export type SearchSlice = {
  vibeFilter: VibeFilter;
  hashkafaShield: boolean;
  setVibeFilter: (vibe: VibeFilter) => void;
  setHashkafaShield: (enabled: boolean) => void;
  toggleHashkafaShield: () => void;
};

export const createSearchSlice: StateCreator<SearchSlice, [], [], SearchSlice> = (set) => ({
  vibeFilter: null,
  hashkafaShield: true,
  setVibeFilter: (vibe) => set({ vibeFilter: vibe }),
  setHashkafaShield: (enabled) => set({ hashkafaShield: enabled }),
  toggleHashkafaShield: () => set((s) => ({ hashkafaShield: !s.hashkafaShield })),
});
