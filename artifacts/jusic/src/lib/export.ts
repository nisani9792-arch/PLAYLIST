import {
  buildLomdaatPlaylistCsv,
  canonicalSongKey,
  lomdaatRowFromMeiliRecord,
  LOMDAAT_PLAYLIST_FILENAME,
  LOMDAAT_PLAYLIST_HEADERS,
  trimLomdaatField,
  validatePlaylistForExport,
  type LomdaatPlaylistRow,
  type ParashaValidationContext,
} from '@workspace/playlist-validation';
import { MsHit, resolveSongsForOdoo } from './meilisearch';
import { savePlaylistToServer } from './memory-api';
import { recordPlaylistExport } from './playlist-learning';
import { resolveParashaNameFromClient } from './parasha-export-context';
import { toast } from 'sonner';

export { LOMDAAT_PLAYLIST_HEADERS, LOMDAAT_PLAYLIST_FILENAME, buildLomdaatPlaylistCsv };

/** Safe download filename: `{playlistName}.csv` */
export function playlistExportFilename(playlistName: string): string {
  const base = trimLomdaatField(playlistName) || 'פלייליסט חדש';
  const safe = base.replace(/[\\/:*?"<>|]/g, '_').trim();
  const stem = safe.replace(/\.csv$/i, '');
  return `${stem}.csv`;
}

/** Trigger a UTF-8 CSV download in the browser (no BOM). */
export function downloadCsvInBrowser(csv: string, filename: string): void {
  const bytes = new TextEncoder().encode(csv);
  const blob = new Blob([bytes], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export type ExportOptions = {
  parashaContext?: ParashaValidationContext | null;
};

/**
 * Build and download playlist CSV for Lomdaat/Odoo.
 * Runs catalog resolve in the background; file name is the playlist name + `.csv`.
 */
export async function exportPlaylistToCsv(
  playlistName: string,
  songs: MsHit[],
  options: ExportOptions = {},
): Promise<void> {
  if (!songs.length) {
    throw new Error('אין שירים בפלייליסט לייצוא');
  }

  const parashaContext =
    options.parashaContext ?? resolveParashaNameFromClient(playlistName);

  const issues = validatePlaylistForExport(songs, parashaContext);
  const blocking = issues.filter((i) => i.severity === 'block');
  if (blocking.length) {
    const preview = blocking
      .slice(0, 4)
      .map((i) => i.message)
      .join('\n');
    throw new Error(
      blocking.length === 1
        ? preview
        : `נמצאו ${blocking.length} בעיות חסימה:\n${preview}`,
    );
  }

  const resolved = await resolveSongsForOdoo(songs);
  const rows: LomdaatPlaylistRow[] = [];
  const unresolvedCatalog: string[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < songs.length; i++) {
    const playlistSong = songs[i]!;
    const match = resolved[i];

    if (!match?.raw) {
      unresolvedCatalog.push(`${playlistSong.song_name} – ${playlistSong.artist}`);
      continue;
    }

    const row = lomdaatRowFromMeiliRecord(match.raw);

    if (!row.song_name.trim() || !row.artist.trim()) {
      skipped.push(`${playlistSong.song_name} – ${playlistSong.artist}`);
      continue;
    }

    const dedupeKey = canonicalSongKey({
      id: '',
      song_name: row.song_name,
      artist: row.artist,
    });
    if (seen.has(dedupeKey)) {
      skipped.push(`${playlistSong.song_name} – ${playlistSong.artist} (כפילות)`);
      continue;
    }
    seen.add(dedupeKey);
    rows.push(row);
  }

  if (!rows.length) {
    throw new Error('לא ניתן לייצא — אין שורות עם שם שיר ואמן בעברית.');
  }

  const safePlaylistName = trimLomdaatField(playlistName) || 'פלייליסט חדש';
  const csv = buildLomdaatPlaylistCsv(safePlaylistName, rows);
  const filename = playlistExportFilename(playlistName);
  downloadCsvInBrowser(csv, filename);

  recordPlaylistExport(playlistName, songs);
  const parasha = resolveParashaNameFromClient(playlistName)?.targetParasha;
  void savePlaylistToServer({ name: playlistName, songs, parasha });

  if (unresolvedCatalog.length) {
    toast.warning(
      `${unresolvedCatalog.length} שירים לא נכללו בקובץ — לא נמצאה התאמה במאגר.`,
      { duration: 10000 },
    );
  }

  if (skipped.length) {
    toast.warning(`${skipped.length} שירים לא נכנסו (כפילות או חסר שם/אמן).`, {
      duration: 6000,
    });
  }

  toast.success(`הורד ${filename} — ${rows.length} שירים`);
}

/** @deprecated Use exportPlaylistToCsv */
export const exportToLomdaatPlaylistCSV = exportPlaylistToCsv;

/** @deprecated Use exportPlaylistToCsv */
export const exportToOdooCSV = exportPlaylistToCsv;
