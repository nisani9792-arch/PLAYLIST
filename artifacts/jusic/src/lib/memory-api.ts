import { getBuildSignals, type BuildSignals } from './playlist-learning';

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
}> {
  const res = await fetch('/api/playlists/suggestions');
  if (!res.ok) {
    return { recentPlaylists: [], preferredGenres: [], styleNotes: '' };
  }
  return (await res.json()) as {
    recentPlaylists: Array<{ id: string; name: string; parasha?: string | null }>;
    preferredGenres: string[];
    styleNotes: string;
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
  localStorage.setItem('jusic_operator_preferences_v1', JSON.stringify(preferences));
  await fetch('/api/playlists/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preferences }),
  });
}

function loadLocalPreferences(): OperatorPreferencesJson {
  try {
    const raw = localStorage.getItem('jusic_operator_preferences_v1');
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
  const key = 'jusic_learning_migrated_v1';
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
