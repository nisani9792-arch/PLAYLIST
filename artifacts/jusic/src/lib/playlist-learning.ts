import type { MsHit } from './meilisearch';
import { STORAGE_KEYS } from './storage-keys';

const SIGNALS_KEY = STORAGE_KEYS.buildSignals;
const HISTORY_KEY = STORAGE_KEYS.playlistHistory;
const MAX_HISTORY = 40;

export type BuildSignals = {
  version: 1;
  updatedAt: number;
  sessionCount: number;
  totalSongsAdded: number;
  playlistExports: number;
  /** genre string -> count */
  genreHistogram: Record<string, number>;
  /** tag -> count */
  tagHistogram: Record<string, number>;
  /** rolling avg playlist length at export time */
  avgExportLength: number;
};

export type PlaylistHistoryEntry = {
  id: string;
  name: string;
  createdAt: number;
  songCount: number;
  topGenres: string[];
  source: 'export_csv' | 'cleared' | 'snapshot';
};

function emptySignals(): BuildSignals {
  return {
    version: 1,
    updatedAt: Date.now(),
    sessionCount: 0,
    totalSongsAdded: 0,
    playlistExports: 0,
    genreHistogram: {},
    tagHistogram: {},
    avgExportLength: 0,
  };
}

function loadSignals(): BuildSignals {
  try {
    const raw = localStorage.getItem(SIGNALS_KEY);
    if (!raw) return emptySignals();
    const p = JSON.parse(raw) as BuildSignals;
    if (p.version !== 1) return emptySignals();
    return {
      ...emptySignals(),
      ...p,
      genreHistogram: p.genreHistogram ?? {},
      tagHistogram: p.tagHistogram ?? {},
    };
  } catch {
    return emptySignals();
  }
}

function saveSignals(s: BuildSignals): void {
  try {
    localStorage.setItem(SIGNALS_KEY, JSON.stringify(s));
  } catch {
    /* quota */
  }
}

function bumpHistogram(h: Record<string, number>, key: string, by = 1): void {
  if (!key.trim()) return;
  const k = key.trim();
  h[k] = (h[k] ?? 0) + by;
}

/** Call when songs are added manually / bulk / AI — learns genre & tag preferences */
export function recordSongsAdded(songs: MsHit[]): void {
  if (!songs.length) return;
  const s = loadSignals();
  s.updatedAt = Date.now();
  s.totalSongsAdded += songs.length;
  for (const song of songs) {
    if (song.genre) bumpHistogram(s.genreHistogram, song.genre);
    for (const t of song.tags ?? []) bumpHistogram(s.tagHistogram, t);
  }
  saveSignals(s);
}

export function recordSessionStart(): void {
  const s = loadSignals();
  s.sessionCount += 1;
  s.updatedAt = Date.now();
  saveSignals(s);
}

export function recordPlaylistExport(playlistName: string, songs: MsHit[]): void {
  const s = loadSignals();
  s.playlistExports += 1;
  s.updatedAt = Date.now();
  const n = songs.length;
  if (s.playlistExports === 1) {
    s.avgExportLength = n;
  } else {
    s.avgExportLength =
      (s.avgExportLength * (s.playlistExports - 1) + n) / s.playlistExports;
  }

  const genres = histogramFromSongs(songs);
  const topGenres = Object.entries(genres)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([g]) => g);

  saveSignals(s);

  const history = loadHistory();
  history.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: playlistName || 'ללא שם',
    createdAt: Date.now(),
    songCount: n,
    topGenres,
    source: 'export_csv',
  });
  trimHistory(history);
  persistHistory(history);
}

function histogramFromSongs(songs: MsHit[]): Record<string, number> {
  const h: Record<string, number> = {};
  for (const song of songs) {
    if (song.genre) bumpHistogram(h, song.genre);
  }
  return h;
}

function loadHistory(): PlaylistHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as PlaylistHistoryEntry[];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function persistHistory(h: PlaylistHistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, MAX_HISTORY)));
  } catch {
    /* ignore */
  }
}

function trimHistory(h: PlaylistHistoryEntry[]): void {
  if (h.length > MAX_HISTORY) h.length = MAX_HISTORY;
}

export function getBuildSignals(): BuildSignals {
  return loadSignals();
}

export function clearBuildSignals(): void {
  try {
    localStorage.removeItem(SIGNALS_KEY);
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}

export function getPlaylistHistory(): PlaylistHistoryEntry[] {
  return loadHistory();
}

/** JSON bundle for future fine-tuning / analytics (download). */
export function buildTrainingExportPayload(): {
  version: 1;
  exportedAt: string;
  signals: BuildSignals;
  history: PlaylistHistoryEntry[];
  note: string;
} {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    signals: loadSignals(),
    history: loadHistory(),
    note:
      'Aggregated local usage from Jusic Playlist Studio (genres/tags/history). No audio. Use for future model training only with consent.',
  };
}

export function downloadTrainingJson(): void {
  const payload = buildTrainingExportPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `build-play-learning-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
