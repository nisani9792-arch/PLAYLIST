import { getBuildSignals, type BuildSignals } from './playlist-learning';
import { STORAGE_KEYS } from './storage-keys';

export type OperatorPreferencesJson = {
  exportStrict?: boolean;
  defaultPlaylistNamePattern?: string;
  geminiStyleNotes?: string;
  preferredGenres?: string[];
};

export async function fetchSuggestions(): Promise<{
  recentPlaylists: Array<{ id: string; name: string; parasha?: string | null }>;
  preferredGenres: string[];
  styleNotes: string;
  topics?: Array<{ id: string; title: string; description?: string; estimatedCount?: number; vibe?: string }>;
  parasha?: { id: string; title: string; description?: string; estimatedCount?: number; vibe?: string };
}> {
  const res = await fetch('/api/playlists/suggestions');
  if (!res.ok) {
    return { recentPlaylists: [], preferredGenres: [], styleNotes: '', topics: [] };
  }
  return (await res.json()) as {
    recentPlaylists: Array<{ id: string; name: string; parasha?: string | null }>;
    preferredGenres: string[];
    styleNotes: string;
    topics?: Array<{ id: string; title: string; description?: string; estimatedCount?: number; vibe?: string }>;
    parasha?: { id: string; title: string; description?: string; estimatedCount?: number; vibe?: string };
  };
}

export async function fetchOperatorPreferences(): Promise<OperatorPreferencesJson> {
  const res = await fetch('/api/playlists/preferences');
  if (!res.ok) return loadLocalPreferences();
  const data = (await res.json()) as { preferences?: OperatorPreferencesJson };
  return { ...loadLocalPreferences(), ...data.preferences };
}

export async function saveOperatorPreferences(
  preferences: OperatorPreferencesJson,
): Promise<void> {
  localStorage.setItem(STORAGE_KEYS.operatorPreferences, JSON.stringify(preferences));
  await fetch('/api/playlists/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preferences }),
  });
}

function loadLocalPreferences(): OperatorPreferencesJson {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.operatorPreferences);
    if (!raw) return { exportStrict: true };
    return JSON.parse(raw) as OperatorPreferencesJson;
  } catch {
    return { exportStrict: true };
  }
}

export async function savePlaylistToServer(input: {
  name: string;
  songs: unknown[];
  sourcePrompt?: string;
  parasha?: string;
}): Promise<string | null> {
  const res = await fetch('/api/playlists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { id?: string };
  return data.id ?? null;
}

export async function postStagingEvents(
  events: Array<{
    query: string;
    chosenUid?: string;
    rejectedUids?: string[];
    parasha?: string;
    confidence?: number;
  }>,
): Promise<void> {
  if (!events.length) return;
  await fetch('/api/playlists/staging-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
  });
}

export function localBuildSignals(): BuildSignals {
  return getBuildSignals();
}

export async function migrateLocalLearningOnce(): Promise<void> {
  const key = STORAGE_KEYS.learningMigrated;
  if (localStorage.getItem(key)) return;
  const signals = getBuildSignals();
  const genres = Object.entries(signals.genreHistogram)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([g]) => g);
  await saveOperatorPreferences({
    exportStrict: true,
    preferredGenres: genres,
  });
  localStorage.setItem(key, '1');
}
