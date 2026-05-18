import * as XLSX from 'xlsx';
import * as fuzzball from 'fuzzball';
import { buildLomdaatPlaylistCsv } from '@workspace/playlist-validation';

const EXCLUDED_TOKENS = [
  'podcast',
  'playlist',
  'monthly_pick',
  'weekly_pick',
  'radio',
  'interview',
  'פודקאסט',
  'פלייליסט',
  'רדיו',
  'ראיון',
];

const SONG_TYPE_TOKENS = ['song', 'track', 'שיר', 'שירים', 'רצועה'];

type RawRow = Record<string, unknown>;

export interface SongRequestLine {
  raw: string;
  artistHint: string;
  songHint: string;
}

export interface MatchedSongRow {
  request: string;
  artist: string;
  song: string;
  album: string;
  score: number;
}

export interface NotFoundSongRow {
  request: string;
  reason: string;
  bestScore: number;
}

export interface OfflineMasterResult {
  matched: MatchedSongRow[];
  notFound: NotFoundSongRow[];
  csvContent: string;
}

interface CanonicalSongRecord {
  artist: string;
  song: string;
  album: string;
  matchText: string;
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeHeader(value: string): string {
  return normalizeText(value).replace(/[\s\-/.]/g, '');
}

function pickColumn(headers: string[], aliases: string[]): string | null {
  const byExact = headers.find((header) => aliases.includes(normalizeHeader(header)));
  if (byExact) return byExact;

  const byContains = headers.find((header) => {
    const normalized = normalizeHeader(header);
    return aliases.some((alias) => normalized.includes(alias));
  });
  return byContains ?? null;
}

function parseLines(text: string): SongRequestLine[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((raw) => {
      const match = raw.match(/^\d+\.\s*(.+)$/);
      const clean = (match?.[1] ?? raw).trim();
      const parts = clean.split(/\s*[-–—]\s*/);
      if (parts.length >= 2) {
        return {
          raw: clean,
          artistHint: parts[0]?.trim() ?? '',
          songHint: parts.slice(1).join(' - ').trim(),
        };
      }
      return { raw: clean, artistHint: '', songHint: clean };
    });
}

function shouldExcludeByText(value: string): boolean {
  const normalized = normalizeText(value);
  return EXCLUDED_TOKENS.some((token) => normalized.includes(token));
}

function isSongType(value: string): boolean {
  const normalized = normalizeText(value);
  return SONG_TYPE_TOKENS.some((token) => normalized.includes(token));
}

function toSheetRows(fileData: ArrayBuffer): RawRow[] {
  const workbook = XLSX.read(fileData, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '' });
  return rows;
}

function buildCanonicalSongRecords(rows: RawRow[]): CanonicalSongRecord[] {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0] ?? {});

  const artistColumn = pickColumn(headers, [
    'artist',
    'artistname',
    'artisthe',
    'artists',
    'singer',
    'אמן',
    'מבצע',
    'אמןמבצע',
  ]);
  const songColumn = pickColumn(headers, [
    'song',
    'songname',
    'songtitle',
    'title',
    'name',
    'track',
    'שםשיר',
    'שם',
    'כותרת',
  ]);
  const albumColumn = pickColumn(headers, ['album', 'אלבום']);
  const typeColumn = pickColumn(headers, ['type', 'category', 'kind', 'סוג', 'קטגוריה']);

  return rows
    .filter((row) => {
      const artist = String(artistColumn ? row[artistColumn] ?? '' : '').trim();
      const song = String(songColumn ? row[songColumn] ?? '' : '').trim();
      if (!artist || !song) return false;

      const typeValue = String(typeColumn ? row[typeColumn] ?? '' : '');
      const albumValue = String(albumColumn ? row[albumColumn] ?? '' : '');
      const impliedText = `${typeValue} ${albumValue} ${song}`;

      if (shouldExcludeByText(impliedText)) return false;
      if (typeColumn && typeValue.trim() && !isSongType(typeValue)) return false;
      return true;
    })
    .map((row) => {
      const artist = String(artistColumn ? row[artistColumn] ?? '' : '').trim();
      const song = String(songColumn ? row[songColumn] ?? '' : '').trim();
      const album = String(albumColumn ? row[albumColumn] ?? '' : '').trim();
      return {
        artist,
        song,
        album,
        matchText: `${artist} - ${song}`.trim(),
      };
    });
}

function scoreLineAgainstRecord(line: SongRequestLine, record: CanonicalSongRecord): number {
  const scorer = fuzzball.token_set_ratio;

  const fullScore = scorer(normalizeText(line.raw), normalizeText(record.matchText));
  const songScore = line.songHint
    ? scorer(normalizeText(line.songHint), normalizeText(record.song))
    : 0;
  const artistScore = line.artistHint
    ? scorer(normalizeText(line.artistHint), normalizeText(record.artist))
    : 0;

  if (line.artistHint && line.songHint) {
    return Math.round(fullScore * 0.45 + songScore * 0.4 + artistScore * 0.15);
  }
  return Math.max(fullScore, songScore);
}

function findBestMatch(
  line: SongRequestLine,
  records: CanonicalSongRecord[],
): { record: CanonicalSongRecord | null; score: number } {
  let bestRecord: CanonicalSongRecord | null = null;
  let bestScore = 0;

  for (const record of records) {
    const score = scoreLineAgainstRecord(line, record);
    if (score > bestScore) {
      bestScore = score;
      bestRecord = record;
    }
  }

  return { record: bestRecord, score: bestScore };
}

function buildCsv(
  playlistName: string,
  matchedRows: Array<{ artist: string; song: string }>,
): string {
  return buildLomdaatPlaylistCsv(
    playlistName,
    matchedRows.map((row) => ({ song_name: row.song, artist: row.artist })),
  );
}

export async function runOfflinePlaylistMaster(input: {
  file: File;
  playlistName: string;
  requestText: string;
}): Promise<OfflineMasterResult> {
  const fileData = await input.file.arrayBuffer();
  const dbRows = toSheetRows(fileData);
  if (!dbRows.length) {
    return {
      matched: [],
      notFound: [],
      csvContent: buildCsv(input.playlistName, []),
    };
  }

  const records = buildCanonicalSongRecords(dbRows);
  const lines = parseLines(input.requestText);

  const matched: MatchedSongRow[] = [];
  const notFound: NotFoundSongRow[] = [];

  for (const line of lines) {
    const { record, score } = findBestMatch(line, records);
    if (record && score >= 80) {
      matched.push({
        request: line.raw,
        artist: record.artist,
        song: record.song,
        album: record.album,
        score,
      });
    } else {
      notFound.push({
        request: line.raw,
        reason:
          score < 80
            ? 'לא נמצא במאגר ברמת ודאות מספקת (מתחת ל-80)'
            : 'לא נמצא במאגר',
        bestScore: score,
      });
    }
  }

  return {
    matched,
    notFound,
    csvContent: buildCsv(input.playlistName, matched),
  };
}
