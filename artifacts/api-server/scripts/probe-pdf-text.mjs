import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buf = await readFile(path.join(root, "data", "PSH.pdf"));
const data = await pdfParse(buf);
console.log("text length", data.text?.length ?? 0);
console.log("sample:\n", data.text?.slice(0, 1200));

const { parsePshPdfText } = await import(`file://${path.join(root, "src/lib/psh-catalog.ts")}`);
const rows = parsePshPdfText(data.text);
console.log("parsed rows", rows.length);
const { getSongsForParasha, setPshCatalogRows } = await import(
  `file://${path.join(root, "src/lib/psh-catalog.ts")}`
);
setPshCatalogRows(rows);
const shemot = getSongsForParasha("שמות", rows, 40);
console.log("shemot", shemot.parashaOnlyCount, "haftarah", shemot.haftarahCount);
if (rows[0]) console.log("first row", rows[0]);
const idx = data.text.indexOf("שמות");
console.log("\n--- shemot sample ---\n", data.text.slice(idx, idx + 2000));
