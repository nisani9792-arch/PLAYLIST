import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "./logger";
import {
  getPshCatalogRows,
  parsePshPdfBuffer,
  setPshCatalogRows,
} from "./psh-catalog";
import { fetchSettingsKeys, SETTINGS_KEYS } from "./system-settings-store";

/** dist/index.mjs → artifact root; src/lib/*.ts → artifact root (dev). */
const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultPdfPath = path.join(apiRoot, "data", "PSH.pdf");

async function loadPdfBuffer(): Promise<Buffer | null> {
  const envPath = process.env.PSH_PDF_PATH?.trim();
  if (envPath) {
    try {
      return await readFile(envPath);
    } catch (err) {
      logger.warn({ err, envPath }, "PSH_PDF_PATH read failed");
    }
  }

  try {
    return await readFile(defaultPdfPath);
  } catch {
    /* try DB */
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

  const buffer = await loadPdfBuffer();
  if (!buffer) {
    logger.warn(
      "PSH.pdf not loaded — set PSH_PDF_PATH, bundle data/PSH.pdf, or import via admin",
    );
    return false;
  }

  try {
    const rows = await parsePshPdfBuffer(buffer);
    setPshCatalogRows(rows);
    logger.info(
      { songs: rows.length, path: process.env.PSH_PDF_PATH ?? defaultPdfPath },
      "PSH parasha catalog loaded",
    );
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
