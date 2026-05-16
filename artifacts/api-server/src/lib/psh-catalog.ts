import { repairPshCatalog } from "@workspace/playlist-validation";
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

const PARASHA_BY_LENGTH = [...PSH_PARASHA_NAMES].sort((a, b) => b.length - a.length);

function cleanPdfText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/\n--\s*\d+\s+of\s+\d+\s*--\n/g, "\n")
    .replace(
      /אוסף שירים מפרשיות[\s\S]*?פרשה[\s\t]+Title[\s\S]*?Composer\n/gi,
      "",
    )
    .replace(/נוצר ע"י[\s\S]*?Created By Elazar Marks, London\n/g, "");
}

function splitWideFields(line: string): string[] {
  return line
    .split(/\s{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function extractParashaPrefix(line: string): { parashaRaw: string; rest: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const haft = trimmed.match(/^(הפטרה|פטרה|פטרת|הפטרת)\s+(.+)$/i);
  if (haft) {
    const suffix = haft[2].trim();
    for (const name of PARASHA_BY_LENGTH) {
      if (suffix === name || suffix.startsWith(`${name} `)) {
        return {
          parashaRaw: `${haft[1]} ${name}`,
          rest: suffix === name ? "" : suffix.slice(name.length).trim(),
        };
      }
    }
  }

  for (const name of PARASHA_BY_LENGTH) {
    if (trimmed === name) return { parashaRaw: name, rest: "" };
    if (trimmed.startsWith(`${name} `)) {
      return { parashaRaw: name, rest: trimmed.slice(name.length).trim() };
    }
  }

  return null;
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

function rowFromFields(
  parashaRaw: string,
  title: string,
  artist: string,
  album: string,
  year: string,
  composer: string,
): PshSongRow | null {
  if (!parashaRaw || !title || !artist) return null;

  const section: PshSongRow["section"] = isHaftarahParashaLabel(parashaRaw)
    ? "haftarah"
    : "parasha";
  const parasha = section === "haftarah" ? stripHaftarahPrefix(parashaRaw) : parashaRaw;

  return {
    parasha,
    title: title.replace(/\s+/g, " ").trim(),
    artist: artist.replace(/\s+/g, " ").trim(),
    album: album.replace(/\s+/g, " ").trim(),
    year: year.trim(),
    composer: composer.replace(/\s+/g, " ").trim(),
    section,
  };
}

/** PSH.pdf from Elazar Marks — fields separated by line breaks and 2+ spaces (not tabs). */
function parseSpacedBlock(body: string): PshSongRow | null {
  const lines = body
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (!lines.length) return null;

  let year = "";
  let composer = "";
  let contentLines = lines;

  const yearLineIdx = lines.findIndex((l) => /^(19|20)\d{2}$/.test(l));
  if (yearLineIdx >= 0) {
    year = lines[yearLineIdx];
    composer = lines[yearLineIdx + 1] ?? "";
    contentLines = lines.slice(0, yearLineIdx);
  } else {
    const joined = lines.join(" ");
    const yearMatch = joined.match(/\s((?:19|20)\d{2})(?:\s|$)/);
    if (!yearMatch || yearMatch.index == null) return null;
    year = yearMatch[1];
    composer = joined.slice(yearMatch.index + yearMatch[0].length).trim();
    const before = joined.slice(0, yearMatch.index).trim();
    contentLines = [before];
  }

  if (!contentLines.length) return null;

  const wide = splitWideFields(contentLines.join("  "));
  if (wide.length >= 5) {
    const parashaInfo = extractParashaPrefix(wide[0]);
    if (!parashaInfo) return null;
    const title = [parashaInfo.rest, ...wide.slice(1, -4)].filter(Boolean).join(" ");
    return rowFromFields(
      parashaInfo.parashaRaw,
      title,
      wide[wide.length - 4] ?? "",
      wide[wide.length - 3] ?? "",
      year,
      composer || (wide[wide.length - 1] ?? ""),
    );
  }

  const first = contentLines[0];
  const parashaInfo = extractParashaPrefix(first);
  if (!parashaInfo) return null;

  const titleParts: string[] = [];
  if (parashaInfo.rest) titleParts.push(parashaInfo.rest);

  let artist = "";
  let album = "";

  if (contentLines.length === 1) {
    const parts = splitWideFields(first);
    if (parts.length >= 3) {
      const p0 = extractParashaPrefix(parts[0]);
      if (p0) {
        titleParts.length = 0;
        if (p0.rest) titleParts.push(p0.rest);
        if (parts.length >= 5) {
          titleParts.push(parts[1]);
          artist = parts[2] ?? "";
          album = parts.slice(3, -2).join(" ");
        } else {
          titleParts.push(parts[1] ?? "");
          artist = parts[2] ?? "";
        }
      }
    }
  } else {
    titleParts.push(...contentLines.slice(1, -1));
    const last = contentLines[contentLines.length - 1];
    const lastParts = splitWideFields(last);
    if (lastParts.length >= 2) {
      artist = lastParts[0];
      album = lastParts.slice(1).join(" ");
    } else {
      artist = last;
    }
  }

  return rowFromFields(
    parashaInfo.parashaRaw,
    titleParts.join(" "),
    artist,
    album,
    year,
    composer,
  );
}

export function parsePshPdfText(text: string): PshSongRow[] {
  const cleaned = cleanPdfText(text);
  const chunks = cleaned.split(/\n(?=\d+\s*\.)/);
  const rows: PshSongRow[] = [];

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    const tabRow = parseRowChunk(trimmed);
    if (tabRow) {
      rows.push(tabRow);
      continue;
    }

    const numMatch = trimmed.match(/^(\d+)\s*\.\s*([\s\S]*)$/);
    if (!numMatch) continue;
    const spaced = parseSpacedBlock(numMatch[2].trim());
    if (spaced) rows.push(spaced);
  }

  return repairPshCatalog(rows);
}

export async function parsePshPdfBuffer(buffer: Buffer): Promise<PshSongRow[]> {
  // Import lib entry directly — package root runs debug self-test when module.parent is unset (tsx/ESM).
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as (
    data: Buffer,
  ) => Promise<{ text: string }>;
  const data = await pdfParse(buffer);
  return parsePshPdfText(data.text);
}

export function setPshCatalogRows(rows: PshSongRow[]): void {
  cachedRows = repairPshCatalog(rows);
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
  const parashaRows: PshSongRow[] = [];
  const haftarahRows: PshSongRow[] = [];
  for (const r of rows) {
    if (normalizeParashaToken(r.parasha) !== target) continue;
    if (r.section === "haftarah") haftarahRows.push(r);
    else if (r.section === "parasha") parashaRows.push(r);
  }

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
