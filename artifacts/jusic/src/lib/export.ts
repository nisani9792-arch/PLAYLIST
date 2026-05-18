import {
  buildLomdaatPlaylistCsv,
  canonicalSongKey,
  lomdaatRowFromMeiliRecord,
  repairMsHitForExport,
  LOMDAAT_PLAYLIST_FILENAME,
  LOMDAAT_PLAYLIST_HEADERS,
  trimLomdaatField,
  validatePlaylistForExport,
  type LomdaatPlaylistRow,
  type ParashaValidationContext,
} from '@workspace/playlist-validation';
import { MsHit, resolveSongsForOdoo } from './meilisearch';
import { resolveParashaNameFromClient } from './parasha-export-context';
import { toast } from 'sonner';

export { LOMDAAT_PLAYLIST_HEADERS, LOMDAAT_PLAYLIST_FILENAME, buildLomdaatPlaylistCsv };

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
 * Download playlist CSV for Lomdaat/Odoo (same layout as lomdaat_music.playlist template).
 * Prefer catalog names from Meilisearch; fallback to cleaned playlist fields for remaining rows.
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
  const catalogCount = { n: 0 };
  const playlistFallback: string[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < songs.length; i++) {
    const playlistSong = songs[i]!;
    const match = resolved[i];

    let row: LomdaatPlaylistRow;
    if (match?.raw) {
      row = lomdaatRowFromMeiliRecord(match.raw);
      catalogCount.n += 1;
    } else {
      row = repairMsHitForExport(playlistSong);
      playlistFallback.push(`${playlistSong.song_name} – ${playlistSong.artist}`);
    }

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
  downloadCsvInBrowser(csv, LOMDAAT_PLAYLIST_FILENAME);

  if (playlistFallback.length) {
    toast.warning(
      `${rows.length} שורות בקובץ (${catalogCount.n} מהמאגר, ${playlistFallback.length} מהפלייליסט בלבד). שורות שלא מהמאגר עלולות לא להיכנס לאודו.`,
      { duration: 12000 },
    );
  }

  if (skipped.length) {
    toast.warning(
      `${skipped.length} שירים לא נכנסו לקובץ (חסר שם/אמן או כפילות).`,
      { duration: 8000 },
    );
  }

  toast.success(
    `קובץ Lomdaat: ${rows.length} שירים — פורמט תבנית (${LOMDAAT_PLAYLIST_FILENAME})`,
  );
}

/** @deprecated Use exportPlaylistToCsv */
export const exportToLomdaatPlaylistCSV = exportPlaylistToCsv;

/** @deprecated Use exportPlaylistToCsv */
export const exportToOdooCSV = exportPlaylistToCsv;
