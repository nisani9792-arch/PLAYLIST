import { PDFParse } from "pdf-parse";
import { normalizeParashaToken, PSH_PARASHA_NAMES } from "./psh-parasha-names";

export type PshSongRow = {
  parasha: string;
  title: string;
  artist: string;
  album: string;
  year: string;
  composer: string;
  section: "parasha" | "haftarah";
};

export type ParashaSongLines = {
  parasha: string;
  parashaLines: string[];
  haftarahLines: string[];
  allLines: string[];
};

let cachedRows: PshSongRow[] | null = null;

function cleanPdfText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\n--\s*\d+\s+of\s+\d+\s*--\n/g, "\n")
    .replace(
      /אוסף שירים מפרשיות[\s\S]*?פרשה\tTitle\tArtist\tAlbum\tYear\tComposer\n/g,
      "",
    )
    .replace(/נוצר ע"י[\s\S]*?Created By Elazar Marks, London\n/g, "");
}

function isHaftarahParashaLabel(parasha: string): boolean {
  return /^(הפטרה|פטרה|פטרת|הפטרת)\b/i.test(parasha.trim());
}

function stripHaftarahPrefix(parasha: string): string {
  return normalizeParashaToken(
    parasha.replace(/^(הפטרה|פטרה|פטרת|הפטרת)\s*/i, ""),
  );
}

function parseRowChunk(chunk: string): PshSongRow | null {
  const match = chunk.match(/^(\d+)\s*\.\s*([^\t\n]+)\t([\s\S]+)$/);
  if (!match) return null;

  const parashaRaw = match[2].trim();
  if (!parashaRaw || parashaRaw === "0") return null;

  const body = match[3].trim();
  const parts = body.split("\t").map((p) => p.trim());
  if (parts.length < 4) return null;

  const composer = parts[parts.length - 1] ?? "";
  const year = parts[parts.length - 2] ?? "";
  const album = parts[parts.length - 3] ?? "";
  const artist = (parts[parts.length - 4] ?? "").replace(/\s+/g, " ").trim();
  const title = parts
    .slice(0, parts.length - 4)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!title || !artist) return null;

  const section: PshSongRow["section"] = isHaftarahParashaLabel(parashaRaw)
    ? "haftarah"
    : "parasha";

  const parasha = section === "haftarah" ? stripHaftarahPrefix(parashaRaw) : parashaRaw;

  return {
    parasha,
    title,
    artist,
    album,
    year,
    composer,
    section,
  };
}

export function parsePshPdfText(text: string): PshSongRow[] {
  const cleaned = cleanPdfText(text);
  const chunks = cleaned.split(/\n(?=\d+\s*\.)/);
  const rows: PshSongRow[] = [];

  for (const chunk of chunks) {
    const row = parseRowChunk(chunk.trim());
    if (row) rows.push(row);
  }

  return rows;
}

export async function parsePshPdfBuffer(buffer: Buffer): Promise<PshSongRow[]> {
  const parser = new PDFParse({ data: buffer });
  const { text } = await parser.getText();
  return parsePshPdfText(text);
}

export function setPshCatalogRows(rows: PshSongRow[]): void {
  cachedRows = rows;
}

export function getPshCatalogRows(): PshSongRow[] {
  return cachedRows ?? [];
}

export function toPlaylistLine(row: PshSongRow): string {
  return `${row.artist} - ${row.title}`;
}

export function getSongsForParasha(
  parashaName: string,
  rows: PshSongRow[] = getPshCatalogRows(),
  maxTotal = 30,
): ParashaSongLines {
  const target = normalizeParashaToken(parashaName);
  const parashaRows = rows.filter(
    (r) => r.section === "parasha" && normalizeParashaToken(r.parasha) === target,
  );
  const haftarahRows = rows.filter(
    (r) =>
      r.section === "haftarah" && normalizeParashaToken(r.parasha) === target,
  );

  const parashaLines = parashaRows.map(toPlaylistLine);
  const haftarahLines = haftarahRows.map(toPlaylistLine);

  const merged: string[] = [];
  const seen = new Set<string>();
  for (const line of [...parashaLines, ...haftarahLines]) {
    const key = line.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(line);
    if (merged.length >= maxTotal) break;
  }

  return {
    parasha: target,
    parashaLines,
    haftarahLines,
    allLines: merged,
  };
}

export function listKnownParashot(rows: PshSongRow[] = getPshCatalogRows()): string[] {
  const fromPdf = new Set(rows.map((r) => normalizeParashaToken(r.parasha)));
  return PSH_PARASHA_NAMES.filter((n) => fromPdf.has(n));
}
