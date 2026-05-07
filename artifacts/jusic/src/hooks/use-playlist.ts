import { useState, useEffect, useRef } from 'react';
import { MsHit } from '../lib/meilisearch';
import { newClientId } from '../lib/ids';
import { attachDraftFlushListeners } from '../lib/playlist-draft';
import { recordSongsAdded, recordSessionStart } from '../lib/playlist-learning';

const STORAGE_KEY = 'jusic_playlist_draft';
const SAVE_DEBOUNCE_MS = 300;

export function usePlaylist() {
  const [playlistName, setPlaylistName] = useState('פלייליסט חדש');
  const [songs, setSongs] = useState<MsHit[]>([]);
  const [ready, setReady] = useState(false);
  const dataRef = useRef({ name: 'פלייליסט חדש' as string, songs: [] as MsHit[] });
  dataRef.current = { name: playlistName, songs };

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as {
          name?: string;
          songs?: MsHit[];
        };
        if (parsed.name) setPlaylistName(parsed.name);
        if (Array.isArray(parsed.songs)) setSongs(parsed.songs);
      } catch {
        console.error('Failed to parse playlist from storage');
      }
    }
    recordSessionStart();
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    return attachDraftFlushListeners(() => dataRef.current);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;

    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ name: playlistName, songs, savedAt: Date.now() }),
        );
      } catch (e) {
        const isQuota =
          e instanceof DOMException && e.name === 'QuotaExceededError';
        if (isQuota) {
          console.error('Playlist save failed: storage quota exceeded');
        } else {
          console.error('Failed to save playlist', e);
        }
      }
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [ready, playlistName, songs]);

  const addSong = (song: MsHit) => {
    recordSongsAdded([song]);
    setSongs((prev) => [...prev, { ...song, _id: newClientId() }]);
  };

  const addSongs = (newSongs: MsHit[]) => {
    if (newSongs.length) recordSongsAdded(newSongs);
    setSongs((prev) => [
      ...prev,
      ...newSongs.map((s) => ({ ...s, _id: newClientId() })),
    ]);
  };

  const removeSong = (index: number) => {
    setSongs((prev) => prev.filter((_, i) => i !== index));
  };

  const reorderSongs = (startIndex: number, endIndex: number) => {
    setSongs((prev) => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  };

  const clearPlaylist = () => {
    setSongs([]);
    setPlaylistName('פלייליסט חדש');
  };

  return {
    playlistName,
    setPlaylistName,
    songs,
    addSong,
    addSongs,
    removeSong,
    reorderSongs,
    clearPlaylist,
  };
}
