/** Canonical localStorage keys for JUSIC PLAY */
export const STORAGE_KEYS = {
  draft: 'jusic_playlist_draft',
  draftHistory: 'jusic_playlist_draft_history_v1',
  operatorPreferences: 'jusic_playlist_operator_preferences_v1',
  learningMigrated: 'jusic_playlist_learning_migrated_v1',
  buildSignals: 'jusic_playlist_build_signals_v1',
  playlistHistory: 'jusic_playlist_history_v1',
  storageMigrated: 'jusic_playlist_storage_migrated_v2',
} as const;

const LEGACY_MAP: Record<string, string> = {
  jusic_playlist_draft: 'jusic_playlist_draft',
  jusic_playlist_draft_history_v1: 'jusic_playlist_draft_history_v1',
  jusic_operator_preferences_v1: STORAGE_KEYS.operatorPreferences,
  jusic_learning_migrated_v1: STORAGE_KEYS.learningMigrated,
  jusic_build_signals_v1: STORAGE_KEYS.buildSignals,
  jusic_playlist_history_v1: STORAGE_KEYS.playlistHistory,
};

/** One-time migration from legacy jusic_* keys to jusic_playlist_* namespace */
export function migrateStorageKeysOnce(): void {
  if (typeof localStorage === 'undefined') return;
  if (localStorage.getItem(STORAGE_KEYS.storageMigrated)) return;

  for (const [legacy, canonical] of Object.entries(LEGACY_MAP)) {
    if (legacy === canonical) continue;
    const value = localStorage.getItem(legacy);
    if (value != null && !localStorage.getItem(canonical)) {
      localStorage.setItem(canonical, value);
    }
    if (value != null) {
      localStorage.removeItem(legacy);
    }
  }

  localStorage.setItem(STORAGE_KEYS.storageMigrated, '1');
}
