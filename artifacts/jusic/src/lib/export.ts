import {
  buildLomdaatPlaylistCsv,
  canonicalSongKey,
  isCatalogUid,
  isExportResolveAcceptable,
  lomdaatRowFromHits,
  lomdaatRowFromMeiliRecord,
  LOMDAAT_PLAYLIST_FILENAME,
  LOMDAAT_PLAYLIST_HEADERS,
  msHitLikeFromMeiliRecord,
  trimLomdaatField,
  validatePlaylistForExport,
  type LomdaatPlaylistRow,
  type ParashaValidationContext,
  REVIEW_THRESHOLD,
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

function formatSuggestionLine(hit: MsHit): string {
  return `${hit.artist} · ${hit.song_name}`;
}

/**
 * Build and download playlist CSV for Lomdaat/Odoo.
 * Only rows with a strict Meilisearch catalog match are exported (canonical DB names).
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

  const issues = validatePlaylistForExport(songs, parashaContext, {
    blockParashaReview: Boolean(parashaContext),
  });
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
  const unresolvedCatalog: Array<{ label: string; suggestions: string[] }> = [];
  const autoResolved: string[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < songs.length; i++) {
    const playlistSong = songs[i]!;
    const match = resolved[i];
    const label = `${playlistSong.song_name} – ${playlistSong.artist}`;

    let catalogRaw = match?.raw && Object.keys(match.raw).length ? match.raw : null;
    let catalog = catalogRaw ? msHitLikeFromMeiliRecord(catalogRaw) : null;

    if (
      !catalogRaw &&
      match?.alternatives?.length &&
      isCatalogUid(match.alternatives[0]?.id)
    ) {
      const alt = match.alternatives[0]!;
      if (isExportResolveAcceptable(playlistSong, alt, REVIEW_THRESHOLD)) {
        catalog = alt;
        catalogRaw = null;
        autoResolved.push(label);
      }
    }

    if (!catalog && match?.alternatives?.length && (!match.raw || !Object.keys(match.raw).length)) {
      unresolvedCatalog.push({
        label,
        suggestions: match.alternatives.map(formatSuggestionLine),
      });
      continue;
    }

    if (!catalog) {
      unresolvedCatalog.push({ label, suggestions: [] });
      continue;
    }

    if (
      catalogRaw &&
      !isExportResolveAcceptable(playlistSong, catalog, match?.confidence ?? 1)
    ) {
      if (match?.alternatives?.length) {
        const alt = match.alternatives.find((a) =>
          isExportResolveAcceptable(playlistSong, a, REVIEW_THRESHOLD),
        );
        if (alt) {
          catalog = alt;
          autoResolved.push(label);
        } else {
          unresolvedCatalog.push({
            label,
            suggestions: match.alternatives.map(formatSuggestionLine),
          });
          continue;
        }
      } else {
        unresolvedCatalog.push({
          label,
          suggestions: match?.alternatives?.map(formatSuggestionLine) ?? [],
        });
        continue;
      }
    }

    const row = catalogRaw
      ? lomdaatRowFromMeiliRecord(catalogRaw)
      : lomdaatRowFromHits(playlistSong, catalog);

    if (!row.song_name.trim() || !row.artist.trim()) {
      skipped.push(label);
      continue;
    }

    const dedupeKey = canonicalSongKey({
      id: catalog.id,
      song_name: row.song_name,
      artist: row.artist,
    });
    if (seen.has(dedupeKey)) {
      skipped.push(`${label} (כפילות)`);
      continue;
    }
    seen.add(dedupeKey);
    rows.push(row);
  }

  if (!rows.length) {
    const hint = unresolvedCatalog[0]?.suggestions.length
      ? `\nהצעות: ${unresolvedCatalog[0].suggestions.slice(0, 3).join(' | ')}`
      : '';
    throw new Error(
      `לא ניתן לייצא — אין שורות עם התאמה מדויקת במאגר Meilisearch.${hint}`,
    );
  }

  const safePlaylistName = trimLomdaatField(playlistName) || 'פלייליסט חדש';
  const csv = buildLomdaatPlaylistCsv(safePlaylistName, rows);
  const filename = playlistExportFilename(playlistName);
  downloadCsvInBrowser(csv, filename);

  recordPlaylistExport(playlistName, songs);
  const parasha = resolveParashaNameFromClient(playlistName)?.targetParasha;
  void savePlaylistToServer({ name: playlistName, songs, parasha });

  if (autoResolved.length) {
    toast.info(
      `${autoResolved.length} שירים יוצאו לפי הצעת המאגר (שם שונה מהרשימה).`,
      { duration: 8000 },
    );
  }

  if (unresolvedCatalog.length) {
    const sample = unresolvedCatalog
      .slice(0, 3)
      .map((u) => {
        const sug = u.suggestions.length
          ? ` (הצעות: ${u.suggestions.slice(0, 2).join(' · ')})`
          : '';
        return `${u.label}${sug}`;
      })
      .join('\n');
    toast.warning(
      `${unresolvedCatalog.length} שירים לא נכללו — אין התאמה מדויקת במאגר.\n${sample}`,
      { duration: 14000 },
    );
  }

  if (skipped.length) {
    toast.warning(`${skipped.length} שירים לא נכנסו (כפילות או חסר שם/אמן).`, {
      duration: 6000,
    });
  }

  toast.success(`הורד ${filename} — ${rows.length} שירים מהמאגר`);
}

/** @deprecated Use exportPlaylistToCsv */
export const exportToLomdaatPlaylistCSV = exportPlaylistToCsv;

/** @deprecated Use exportPlaylistToCsv */
export const exportToOdooCSV = exportPlaylistToCsv;
