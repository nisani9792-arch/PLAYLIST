import type { MsHit } from './meilisearch';
import { getOperatorName } from './operator';

const CURRENT_STORAGE_KEY = 'jusic_playlist_draft';
const HISTORY_STORAGE_KEY = 'jusic_playlist_draft_history_v1';
const MAX_DRAFT_HISTORY = 10;

export type PlaylistDraftSnapshot = {
  id: string;
  name: string;
  songs: MsHit[];
  savedAt: number;
  operatorName?: string;
};

export function loadCurrentDraft(): { name?: string; songs?: MsHit[]; savedAt?: number } | null {
  try {
    const raw = localStorage.getItem(CURRENT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { name?: string; songs?: MsHit[]; savedAt?: number };
  } catch {
    return null;
  }
}

export function loadDraftHistory(): PlaylistDraftSnapshot[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PlaylistDraftSnapshot[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((d) => d && typeof d.id === 'string' && Array.isArray(d.songs))
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

function persistDraftHistory(next: PlaylistDraftSnapshot[]): void {
  try {
    localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify(next.slice(0, MAX_DRAFT_HISTORY)),
    );
  } catch (e) {
    console.error('persistDraftHistory failed', e);
  }
}

export function saveDraftToHistory(draft: Omit<PlaylistDraftSnapshot, 'id' | 'savedAt'>): void {
  const nextDraft: PlaylistDraftSnapshot = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: draft.name,
    songs: draft.songs,
    savedAt: Date.now(),
    operatorName: getOperatorName() ?? draft.operatorName,
  };
  const prev = loadDraftHistory();
  const withoutSameName = prev.filter((d) => d.name !== nextDraft.name);
  persistDraftHistory([nextDraft, ...withoutSameName]);
}

export function deleteDraftFromHistory(draftId: string): void {
  const prev = loadDraftHistory();
  persistDraftHistory(prev.filter((d) => d.id !== draftId));
}

/** Synchronous write — call on tab hide / unload so nothing is lost mid-debounce. */
export function flushPlaylistDraft(playlistName: string, songs: MsHit[]): void {
  try {
    localStorage.setItem(
      CURRENT_STORAGE_KEY,
      JSON.stringify({
        name: playlistName,
        songs,
        savedAt: Date.now(),
        operatorName: getOperatorName() ?? undefined,
      }),
    );
  } catch (e) {
    console.error('flushPlaylistDraft failed', e);
  }
}

export function attachDraftFlushListeners(getSnapshot: () => {
  name: string;
  songs: MsHit[];
}): () => void {
  const flush = () => {
    const { name, songs } = getSnapshot();
    flushPlaylistDraft(name, songs);
  };

  const onHide = () => {
    if (document.visibilityState === 'hidden') flush();
  };

  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', onHide);

  return () => {
    window.removeEventListener('pagehide', flush);
    window.removeEventListener('beforeunload', flush);
    document.removeEventListener('visibilitychange', onHide);
  };
}
