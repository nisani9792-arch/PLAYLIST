import { MsHit, resolveSongsForOdoo } from "./meilisearch";

function parseSongIds(rawId: string): { dbId: string; externalId: string } {
  const clean = String(rawId ?? "").trim();
  if (!clean) return { dbId: "", externalId: "" };

  // Numeric database ID (must be clean digits only; no commas).
  if (/^\d+$/.test(clean)) return { dbId: clean, externalId: "" };

  // Known UID shape e.g. SON-22004
  const knownUid = clean.match(/^SON-(\d+)$/i);
  if (knownUid) {
    return { dbId: knownUid[1] ?? "", externalId: clean };
  }

  // Generic external id fallback
  return { dbId: "", externalId: clean };
}

export async function exportToOdooCSV(playlistName: string, songs: MsHit[]) {
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
  const csv = BOM + [headers, ...rows].map(r => r.map(escape).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; 
  a.download = `${playlistName || 'playlist'}_odoo.csv`; 
  a.click();
  URL.revokeObjectURL(url);
}
