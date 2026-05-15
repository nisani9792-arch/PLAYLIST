import { readFile } from "node:fs/promises";
import { logger } from "./logger";
import {
  getPshCatalogRows,
  parsePshPdfBuffer,
  setPshCatalogRows,
  type PshSongRow,
} from "./psh-catalog";
import { resolvePshCatalogJsonPath, resolvePshPdfPath } from "./psh-paths";
import { fetchSettingsKeys, SETTINGS_KEYS } from "./system-settings-store";

async function loadCatalogJson(): Promise<PshSongRow[] | null> {
  const jsonPath = await resolvePshCatalogJsonPath();
  if (!jsonPath) return null;

  try {
    const raw = await readFile(jsonPath, "utf8");
    const parsed = JSON.parse(raw) as PshSongRow[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch (err) {
    logger.warn({ err, jsonPath }, "psh-catalog.json read failed");
    return null;
  }
}

async function loadPdfBuffer(): Promise<Buffer | null> {
  const pdfPath = await resolvePshPdfPath();
  if (pdfPath) {
    try {
      return await readFile(pdfPath);
    } catch (err) {
      logger.warn({ err, pdfPath }, "PSH.pdf read failed");
    }
  }

  const settings = await fetchSettingsKeys([SETTINGS_KEYS.AI_PSH_PDF_BASE64]);
  const b64 = settings[SETTINGS_KEYS.AI_PSH_PDF_BASE64]?.trim();
  if (b64) {
    return Buffer.from(b64, "base64");
  }

  return null;
}

export async function ensurePshCatalogLoaded(): Promise<boolean> {
  if (getPshCatalogRows().length > 0) return true;

  const fromJson = await loadCatalogJson();
  if (fromJson?.length) {
    setPshCatalogRows(fromJson);
    logger.info({ songs: fromJson.length, source: "psh-catalog.json" }, "PSH parasha catalog loaded");
    return true;
  }

  const buffer = await loadPdfBuffer();
  if (!buffer) {
    logger.warn(
      "PSH catalog not loaded — bundle data/psh-catalog.json, data/PSH.pdf, PSH_PDF_PATH, or admin import",
    );
    return false;
  }

  try {
    const rows = await parsePshPdfBuffer(buffer);
    setPshCatalogRows(rows);
    logger.info({ songs: rows.length, source: "PSH.pdf" }, "PSH parasha catalog loaded");
    return rows.length > 0;
  } catch (err) {
    logger.error({ err }, "Failed to parse PSH.pdf");
    return false;
  }
}

export async function reloadPshCatalog(): Promise<number> {
  setPshCatalogRows([]);
  const ok = await ensurePshCatalogLoaded();
  return ok ? getPshCatalogRows().length : 0;
}
