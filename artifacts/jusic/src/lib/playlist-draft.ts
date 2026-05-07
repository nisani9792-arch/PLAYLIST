import type { MsHit } from './meilisearch';

const STORAGE_KEY = 'jusic_playlist_draft';

/** Synchronous write — call on tab hide / unload so nothing is lost mid-debounce. */
export function flushPlaylistDraft(playlistName: string, songs: MsHit[]): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ name: playlistName, songs, savedAt: Date.now() }),
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
