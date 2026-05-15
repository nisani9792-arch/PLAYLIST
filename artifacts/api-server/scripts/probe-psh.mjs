import { readFile } from "node:fs/promises";
import { PDFParse } from "pdf-parse";

const path = process.argv[2];
const buf = await readFile(path);
const parser = new PDFParse({ data: buf });
const data = await parser.getText();
const text = data.text;
console.log("pages", data.numpages, "len", text.length);
console.log(text.slice(0, 2500));
const ptrIdx = text.indexOf("פטר");
console.log("first פטר at", ptrIdx, text.slice(ptrIdx, ptrIdx + 500));
const allParashot = [...new Set([...text.matchAll(/\d+\s*\.\s*([^\t\n]+)\t/g)].map((m) => m[1].trim()))];
console.log("unique parasha count", allParashot.length);
console.log("sample", allParashot.filter((p) => p.length < 30).slice(0, 40));
