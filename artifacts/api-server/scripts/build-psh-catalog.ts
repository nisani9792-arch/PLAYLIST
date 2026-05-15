import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parsePshPdfBuffer } from "../src/lib/psh-catalog";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pdfPath = path.join(root, "data", "PSH.pdf");
const outPath = path.join(root, "data", "psh-catalog.json");
const distDataDir = path.join(root, "dist", "data");

const buffer = await readFile(pdfPath);
const rows = await parsePshPdfBuffer(buffer);
await writeFile(outPath, JSON.stringify(rows), "utf8");
console.log(`Wrote ${rows.length} PSH rows → ${outPath}`);

await mkdir(distDataDir, { recursive: true });
for (const name of ["PSH.pdf", "psh-catalog.json"]) {
  await copyFile(path.join(root, "data", name), path.join(distDataDir, name));
}
console.log(`Copied data assets → ${distDataDir}`);
