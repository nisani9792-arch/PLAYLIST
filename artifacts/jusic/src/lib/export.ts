import { validatePlaylistForExport, type ParashaValidationContext } from '@workspace/playlist-validation';
import { MsHit, resolveSongsForOdoo } from './meilisearch';
import { resolveParashaNameFromClient } from './parasha-export-context';

function parseSongIds(rawId: string): { dbId: string; externalId: string } {
  const clean = String(rawId ?? '').trim();
  if (!clean) return { dbId: '', externalId: '' };

  if (/^\d+$/.test(clean)) return { dbId: clean, externalId: '' };

  const knownUid = clean.match(/^SON-(\d+)$/i);
  if (knownUid) {
    return { dbId: knownUid[1] ?? '', externalId: clean };
  }

  return { dbId: '', externalId: clean };
}

export type ExportOptions = {
  parashaContext?: ParashaValidationContext | null;
};

export async function exportToOdooCSV(
  playlistName: string,
  songs: MsHit[],
  options: ExportOptions = {},
) {
  const parashaContext =
    options.parashaContext ??
    resolveParashaNameFromClient(playlistName);

  const issues = validatePlaylistForExport(songs, parashaContext);
  if (issues.length) {
    const preview = issues
      .slice(0, 4)
      .map((i) => i.message)
      .join('\n');
    throw new Error(
      issues.length === 1
        ? preview
        : `נמצאו ${issues.length} בעיות אימות:\n${preview}`,
    );
  }

  const canonical = await resolveSongsForOdoo(songs);
  const BOM = '\uFEFF';
  const headers = [
    'שם הפלייליסט',
    'מזהה פלייליסט',
    'שירים / מזהה במסד הנתונים',
    'שירים / מזהה חיצוני',
    'Tags Token',
    'אמן מבצע',
    'שם השיר',
    'אלבום',
  ];
  const rows = songs.map((song, index) => {
    const s = canonical[index] ?? song;
    const ids = parseSongIds(s.id);
    if (!ids.dbId && !ids.externalId) {
      throw new Error(
        `חסר מזהה מסד לשיר: ${s.song_name} – ${s.artist}. הסר או התאם מחדש.`,
      );
    }
    return [
      playlistName,
      '',
      ids.dbId,
      ids.externalId,
      ids.dbId,
      s.artist || '',
      s.song_name || '',
      s.album || '',
    ];
  });
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = BOM + [headers, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${playlistName || 'playlist'}_odoo.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
