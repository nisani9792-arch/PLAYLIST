import { useState, useEffect } from 'react';
import { MsHit } from '../lib/meilisearch';

const STORAGE_KEY = 'jusic_playlist_draft';

export function usePlaylist() {
  const [playlistName, setPlaylistName] = useState('פלייליסט חדש');
  const [songs, setSongs] = useState<MsHit[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.name) setPlaylistName(parsed.name);
        if (parsed.songs) setSongs(parsed.songs);
      } catch (e) {
        console.error('Failed to parse playlist from storage');
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: playlistName, songs }));
  }, [playlistName, songs]);

  const addSong = (song: MsHit) => {
    setSongs(prev => [...prev, { ...song, _id: String(Math.random()) }]); // add _id for unique keys in dnd
  };

  const addSongs = (newSongs: MsHit[]) => {
    setSongs(prev => [...prev, ...newSongs.map(s => ({ ...s, _id: String(Math.random()) }))]);
  };

  const removeSong = (index: number) => {
    setSongs(prev => prev.filter((_, i) => i !== index));
  };

  const reorderSongs = (startIndex: number, endIndex: number) => {
    const result = Array.from(songs);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    setSongs(result);
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
