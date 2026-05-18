import { validatePlaylistForExport, type ParashaValidationContext } from '@workspace/playlist-validation';
import { MsHit, resolveSongsForOdoo } from './meilisearch';
import { resolveParashaNameFromClient } from './parasha-export-context';

/** Lomdaat / Jusic Audio import format (must match player expectations exactly). */
export const LOMDAAT_PLAYLIST_HEADERS =
  'imported_playlist_name,imported_song_name,imported_artist_name';

export const LOMDAAT_PLAYLIST_FILENAME = 'lomdaat_music.playlist.csv';

export function buildLomdaatPlaylistCsv(
  playlistName: string,
  rows: Array<{ song_name: string; artist: string }>,
): string {
  const safePlaylist = playlistName.trim();
  const lines = [
    LOMDAAT_PLAYLIST_HEADERS,
    ...rows.map((row) =>
      [safePlaylist, row.song_name.trim(), row.artist.trim()].join(','),
    ),
  ];
  return lines.join('\r\n');
}

export type ExportOptions = {
  parashaContext?: ParashaValidationContext | null;
};

export async function exportToLomdaatPlaylistCSV(
  playlistName: string,
  songs: MsHit[],
  options: ExportOptions = {},
) {
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
  const rows = songs.map((song, index) => {
    const resolved = canonical[index];
    if (!resolved) {
      throw new Error(
        `לא נמצא במסד הנתונים: ${song.song_name} – ${song.artist}. הסר או התאם מחדש.`,
      );
    }
    return {
      song_name: resolved.song_name || '',
      artist: resolved.artist || '',
    };
  });

  const csv = buildLomdaatPlaylistCsv(playlistName, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = LOMDAAT_PLAYLIST_FILENAME;
  a.click();
  URL.revokeObjectURL(url);
}

/** @deprecated Use exportToLomdaatPlaylistCSV — kept for any stale imports. */
export const exportToOdooCSV = exportToLomdaatPlaylistCSV;
