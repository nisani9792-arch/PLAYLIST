import {
  buildLomdaatPlaylistCsv,
  lomdaatRowFromHits,
  LOMDAAT_PLAYLIST_FILENAME,
  LOMDAAT_PLAYLIST_HEADERS,
  validatePlaylistForExport,
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

/** Download the active playlist as a Lomdaat-compatible UTF-8 CSV (CRLF, comma-delimited). */
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

  const canonical = await resolveSongsForOdoo(songs);
  const rows = songs.map((song, index) =>
    lomdaatRowFromHits(song, canonical[index] ?? null),
  );

  const weak = rows
    .map((row, index) => ({ row, index, song: songs[index] }))
    .filter(({ row }) => !row.song_name.trim() || !row.artist.trim());

  if (weak.length) {
    const names = weak
      .slice(0, 5)
      .map(({ song }) => `${song.song_name} – ${song.artist}`)
      .join('\n');
    throw new Error(
      weak.length === 1
        ? `לא ניתן לייצא שורה עם שם שיר ואמן תקינים:\n${names}`
        : `לא ניתן לייצא ${weak.length} שירים (חסר שם אמן/שיר בעברית):\n${names}`,
    );
  }

  const unresolved = songs.filter((_, i) => !canonical[i]).length;
  if (unresolved > 0) {
    toast.warning(
      `${unresolved} שירים יוצאו לפי שמות מהפלייליסט (לא נמצאו במאגר). אם אודו לא מייבא — התאם ידנית.`,
      { duration: 8000 },
    );
  }

  const csv = buildLomdaatPlaylistCsv(playlistName, rows);
  downloadCsvInBrowser(csv, LOMDAAT_PLAYLIST_FILENAME);

  toast.success(
    `קובץ Lomdaat נוצר: ${rows.length} שירים (UTF-8, שמות אמן בעברית)`,
  );
}

/** @deprecated Use exportPlaylistToCsv */
export const exportToLomdaatPlaylistCSV = exportPlaylistToCsv;

/** @deprecated Use exportPlaylistToCsv */
export const exportToOdooCSV = exportPlaylistToCsv;
