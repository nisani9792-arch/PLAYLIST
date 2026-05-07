import { MsHit } from "./meilisearch";

export function exportToOdooCSV(playlistName: string, songs: MsHit[]) {
  const BOM = '\uFEFF';
  const headers = ['שם הפלייליסט', 'אמן מבצע', 'שם השיר', 'אלבום'];
  const rows = songs.map(s => [playlistName, s.artist || '', s.song_name || '', s.album || '']);
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
