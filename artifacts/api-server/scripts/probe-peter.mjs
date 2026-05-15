import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";

const buf = await readFile(process.argv[2]);
const { text } = await new PDFParse({ data: buf }).getText();
let idx = 0;
let n = 0;
while ((idx = text.indexOf("פטר", idx)) >= 0 && n < 15) {
  console.log("---", n, "---");
  console.log(text.slice(Math.max(0, idx - 80), idx + 200).replace(/\n/g, " | "));
  idx += 3;
  n++;
}
