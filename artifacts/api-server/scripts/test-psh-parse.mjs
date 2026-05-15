import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Quick integration test — run after build or via tsx on sources
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { parsePshPdfBuffer, getSongsForParasha, setPshCatalogRows } = await import(
  `file://${path.join(root, "src/lib/psh-catalog.ts")}`.replace(/\\/g, "/")
).catch(() => import("../dist/lib/psh-catalog.mjs"));

const pdfPath = path.join(root, "data", "PSH.pdf");
const buf = await readFile(pdfPath);
const rows = await parsePshPdfBuffer(buf);
setPshCatalogRows(rows);
const shemot = getSongsForParasha("שמות", rows, 30);
console.log("total rows", rows.length);
console.log("shemot", shemot.parashaOnlyCount, "haftarah", shemot.haftarahCount);
console.log("sample", shemot.allLines.slice(0, 5));
