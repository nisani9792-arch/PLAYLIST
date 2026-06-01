import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

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

import { savePlaylistToServer } from '../lib/memory-api';



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



function snapshotKey(name: string, songs: MsHit[]): string {

  return JSON.stringify({

    name: name.trim(),

    ids: songs.map((s) => s._id || s.id),

  });

}



export function usePlaylist() {

  const [playlistName, setPlaylistName] = useState('פלייליסט חדש');

  const [songs, setSongsState] = useState<MsHit[]>([]);

  const [draftHistory, setDraftHistory] = useState<PlaylistDraftSnapshot[]>([]);

  const [ready, setReady] = useState(false);

  const [committedSnapshot, setCommittedSnapshot] = useState('');

  const [committing, setCommitting] = useState(false);

  const dataRef = useRef({ name: 'פלייליסט חדש' as string, songs: [] as MsHit[] });

  dataRef.current = { name: playlistName, songs };



  useEffect(() => {

    const saved = loadCurrentDraft();

    if (saved?.name) setPlaylistName(saved.name);

    if (Array.isArray(saved?.songs)) setSongsState(saved.songs);

    setDraftHistory(loadDraftHistory());

    recordSessionStart();

    const initialName = saved?.name ?? 'פלייליסט חדש';

    const initialSongs = Array.isArray(saved?.songs) ? saved.songs : [];

    setCommittedSnapshot(snapshotKey(initialName, initialSongs));

    setReady(true);

  }, []);



  const isDirty = useMemo(

    () => snapshotKey(playlistName, songs) !== committedSnapshot,

    [playlistName, songs, committedSnapshot],

  );



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

    setSongsState(found.songs);

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

    setSongsState([]);

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

    setSongsState((prev) => {

      if (prev.some((s) => canonicalSongKey(s) === canonicalSongKey(song))) {

        return prev;

      }

      recordSongsAdded([song]);

      return [...prev, { ...song, _id: newClientId() }];

    });

  };



  const addSongs = (newSongs: MsHit[]) => {

    setSongsState((prev) => {

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

    setSongsState((prev) => prev.filter((_, i) => i !== index));

  };



  const removeSongsById = useCallback((ids: Set<string>) => {

    if (!ids.size) return;

    setSongsState((prev) => prev.filter((s) => !ids.has(s._id || s.id)));

  }, []);



  const reorderSongs = (startIndex: number, endIndex: number) => {

    setSongsState((prev) => {

      const result = Array.from(prev);

      const [removed] = result.splice(startIndex, 1);

      result.splice(endIndex, 0, removed!);

      return result;

    });

  };



  const replaceSongs = useCallback((next: MsHit[]) => {

    setSongsState(next.map((s) => ({ ...s, _id: s._id || newClientId() })));

  }, []);



  const commitPlaylist = useCallback(async (): Promise<boolean> => {

    if (!songs.length) return false;

    setCommitting(true);

    try {

      rememberCurrentDraft();

      flushPlaylistDraft(playlistName, songs);

      await savePlaylistToServer({

        name: playlistName.trim() || 'פלייליסט ללא שם',

        songs,

      });

      setCommittedSnapshot(snapshotKey(playlistName, songs));

      return true;

    } catch (e) {

      console.error('commitPlaylist failed', e);

      return false;

    } finally {

      setCommitting(false);

    }

  }, [playlistName, songs]);



  return {

    playlistName,

    setPlaylistName,

    songs,

    draftHistory,

    isDirty,

    committing,

    addSong,

    addSongs,

    removeSong,

    removeSongsById,

    reorderSongs,

    replaceSongs,

    rememberCurrentDraft,

    loadDraft,

    deleteDraft,

    clearPlaylist,

    commitPlaylist,

  };

}

