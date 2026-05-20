import {
  buildLomdaatPlaylistCsv,
  canonicalSongKey,
  lomdaatRowFromMeiliRecord,
  trimLomdaatField,
  validatePlaylistForExport,
  type LomdaatPlaylistRow,
  type ParashaValidationContext,
} from '@workspace/playlist-validation';
import { MsHit, resolveSongsForOdoo } from './meilisearch';

export type ExportRowStatus = 'catalog' | 'missing' | 'duplicate' | 'empty';

export type ExportPreviewRow = {
  source: MsHit;
  row: LomdaatPlaylistRow | null;
  status: ExportRowStatus;
  confidence?: number;
};

export type ExportPreviewResult = {
  rows: ExportPreviewRow[];
  csv: string;
  playlistName: string;
  summary: { catalog: number; missing: number; duplicate: number; total: number };
};

export async function buildExportPreview(
  playlistName: string,
  songs: MsHit[],
  options: {
    catalogOnly?: boolean;
    parashaContext?: ParashaValidationContext | null;
  } = {},
): Promise<ExportPreviewResult> {
  const catalogOnly = options.catalogOnly !== false;
  const safeName = trimLomdaatField(playlistName) || 'פלייליסט חדש';
  const resolved = await resolveSongsForOdoo(songs);
  const seen = new Set<string>();
  const previewRows: ExportPreviewRow[] = [];

  for (let i = 0; i < songs.length; i++) {
    const source = songs[i]!;
    const match = resolved[i];
    let row: LomdaatPlaylistRow | null = null;
    let status: ExportRowStatus = 'missing';

    if (match?.raw) {
      row = lomdaatRowFromMeiliRecord(match.raw);
      if (!row.song_name.trim() || !row.artist.trim()) {
        status = 'empty';
        row = null;
      } else {
        const key = canonicalSongKey({
          id: '',
          song_name: row.song_name,
          artist: row.artist,
        });
        if (seen.has(key)) {
          status = 'duplicate';
          if (catalogOnly) row = null;
        } else {
          seen.add(key);
          status = 'catalog';
        }
      }
    }

    if (status === 'missing' && !catalogOnly) {
      status = 'missing';
    }

    previewRows.push({
      source,
      row: catalogOnly && status !== 'catalog' ? null : row,
      status,
      confidence: match?.confidence,
    });
  }

  const exportRows = previewRows
    .filter((p) => p.row)
    .map((p) => p.row!);

  const csv = buildLomdaatPlaylistCsv(safeName, exportRows);

  return {
    rows: previewRows,
    csv,
    playlistName: safeName,
    summary: {
      catalog: previewRows.filter((r) => r.status === 'catalog').length,
      missing: previewRows.filter((r) => r.status === 'missing' || r.status === 'empty').length,
      duplicate: previewRows.filter((r) => r.status === 'duplicate').length,
      total: songs.length,
    },
  };
}

export function validateExportBlocking(
  songs: MsHit[],
  parashaContext?: ParashaValidationContext | null,
): string | null {
  const issues = validatePlaylistForExport(songs, parashaContext, {
    blockParashaReview: Boolean(parashaContext),
  });
  const blocking = issues.filter((i) => i.severity === 'block');
  if (!blocking.length) return null;
  return blocking.map((i) => i.message).join('\n');
}
