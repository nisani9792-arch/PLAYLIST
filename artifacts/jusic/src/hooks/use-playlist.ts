import { useState, useEffect, useRef } from 'react';
import { canonicalSongKey } from '@workspace/playlist-validation';
import { MsHit } from '../lib/meilisearch';
import { newClientId } from '../lib/ids';
import {
  attachDraftFlushListeners,
  deleteDraftFromHistory,
  flushPlaylistDraft,
  loadCurrentDraft,
  loadDraftHistory,
  saveDraftToHistory,
  type PlaylistDraftSnapshot,
} from '../lib/playlist-draft';
import { recordSongsAdded, recordSessionStart } from '../lib/playlist-learning';

const SAVE_DEBOUNCE_MS = 300;

function dedupeIncoming(songs: MsHit[], existing: MsHit[]): MsHit[] {
  const seen = new Set(existing.map((s) => canonicalSongKey(s)));
  const out: MsHit[] = [];
  for (const song of songs) {
    const key = canonicalSongKey(song);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(song);
  }
  return out;
}

export function usePlaylist() {
  const [playlistName, setPlaylistName] = useState('פלייליסט חדש');
  const [songs, setSongs] = useState<MsHit[]>([]);
  const [draftHistory, setDraftHistory] = useState<PlaylistDraftSnapshot[]>([]);
  const [ready, setReady] = useState(false);
  const dataRef = useRef({ name: 'פלייליסט חדש' as string, songs: [] as MsHit[] });
  dataRef.current = { name: playlistName, songs };

  useEffect(() => {
    const saved = loadCurrentDraft();
    if (saved?.name) setPlaylistName(saved.name);
    if (Array.isArray(saved?.songs)) setSongs(saved.songs);
    setDraftHistory(loadDraftHistory());
    recordSessionStart();
    setReady(true);
  }, []);

  const refreshDraftHistory = () => {
    setDraftHistory(loadDraftHistory());
  };

  const rememberCurrentDraft = () => {
    if (!songs.length) return;
    saveDraftToHistory({ name: playlistName.trim() || 'פלייליסט ללא שם', songs });
    refreshDraftHistory();
  };

  const loadDraft = (draftId: string) => {
    const found = draftHistory.find((d) => d.id === draftId);
    if (!found) return;
    setPlaylistName(found.name || 'פלייליסט חדש');
    setSongs(found.songs);
  };

  const deleteDraft = (draftId: string) => {
    deleteDraftFromHistory(draftId);
    refreshDraftHistory();
  };

  const clearPlaylist = () => {
    if (songs.length) {
      saveDraftToHistory({ name: playlistName.trim() || 'פלייליסט ללא שם', songs });
      refreshDraftHistory();
    }
    setSongs([]);
    setPlaylistName('פלייליסט חדש');
  };

  useEffect(() => {
    if (!ready) return;
    return attachDraftFlushListeners(() => dataRef.current);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;

    const timer = window.setTimeout(() => {
      try {
        flushPlaylistDraft(playlistName, songs);
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
    setSongs((prev) => {
      if (prev.some((s) => canonicalSongKey(s) === canonicalSongKey(song))) {
        return prev;
      }
      recordSongsAdded([song]);
      return [...prev, { ...song, _id: newClientId() }];
    });
  };

  const addSongs = (newSongs: MsHit[]) => {
    setSongs((prev) => {
      const unique = dedupeIncoming(newSongs, prev);
      if (unique.length) recordSongsAdded(unique);
      if (!unique.length) return prev;
      return [
        ...prev,
        ...unique.map((s) => ({ ...s, _id: newClientId() })),
      ];
    });
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

  return {
    playlistName,
    setPlaylistName,
    songs,
    draftHistory,
    addSong,
    addSongs,
    removeSong,
    reorderSongs,
    rememberCurrentDraft,
    loadDraft,
    deleteDraft,
    clearPlaylist,
  };
}
