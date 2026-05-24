import { useEffect, useMemo, useState } from 'react';
import { canonicalSongKey } from '@workspace/playlist-validation';
import { fetchSuggestions } from '@/lib/memory-api';
import { loadDraftHistory } from '@/lib/playlist-draft';
import type { MsHit } from '@/lib/meilisearch';

export type OverlapInfo = {
  playlistName: string;
  count: number;
};

/** Maps song key → other playlists that already contain it. */
export function usePlaylistOverlap(
  currentSongs: MsHit[],
  currentPlaylistName: string,
): Map<string, OverlapInfo> {
  const [serverNames, setServerNames] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchSuggestions().then((data) => {
      if (cancelled) return;
      setServerNames(data.recentPlaylists.map((p) => p.name));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    const map = new Map<string, OverlapInfo>();
    const currentKeys = new Set(currentSongs.map((s) => canonicalSongKey(s)));
    const trimmedCurrent = currentPlaylistName.trim();

    const drafts = loadDraftHistory().filter(
      (d) => d.name.trim() !== trimmedCurrent && d.songs.length > 0,
    );

    for (const draft of drafts) {
      for (const song of draft.songs) {
        const key = canonicalSongKey(song);
        if (!currentKeys.has(key)) continue;
        const existing = map.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(key, { playlistName: draft.name, count: 1 });
        }
      }
    }

    if (serverNames.length && currentKeys.size) {
      for (const key of currentKeys) {
        if (map.has(key)) continue;
        const serverName = serverNames.find((n) => n !== trimmedCurrent);
        if (serverName) {
          map.set(key, { playlistName: serverName, count: 1 });
        }
      }
    }

    return map;
  }, [currentSongs, currentPlaylistName, serverNames]);
}
