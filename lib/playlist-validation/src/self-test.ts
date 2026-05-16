import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { repairPshRow } from "./psh-repair";
import type { PshSongRow } from "./psh-types";
import {
  dedupePlaylistLines,
  sanitizePlaylistLine,
} from "./sanitize";
import { assertHashkafaClean } from "./secular-artists";
import { findPshRowForLine, validateHashkafa, validateStagingMatch } from "./validate";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../artifacts/api-server/data/psh-catalog.json",
);
const rows = JSON.parse(readFileSync(root, "utf8")) as PshSongRow[];

const wmaLines = [
  "חיים בר - הוא שומר עלינו - סינגל.wma",
  "חיים בר - הוא שומר עלינו - סינגל.wma",
  "חיים בר - הוא שומר עלינו.wma",
];
const deduped = dedupePlaylistLines(wmaLines);
console.assert(deduped.length === 1, "wma dedupe");
console.assert(!deduped[0]!.includes(".wma"), "wma stripped");

const secular = assertHashkafaClean("יהודה כץ ושאנן סטריט בלעדיך לא אבוא");
console.assert(secular !== null, "blocks shanan street");

const nasso = rows.filter((r) => r.parasha === "נשא").map(repairPshRow);
const baladek = nasso.find((r) =>
  r.title.includes("בלעדיך") || r.artist.includes("בלעדיך"),
);
console.log("repaired baladek", baladek);
console.assert(
  baladek?.artist.includes("יהודה"),
  "baladek artist should be yehuda katz",
);

const row = findPshRowForLine(
  "ואהבת לרעך כמוך - בני אלבז",
  nasso,
  "נשא",
);
console.log("vaahavta row", row);
console.assert(
  row?.artist.includes("פרחי") || row?.title.includes("ואהבת"),
  "vaahavta maps to psh row",
);

const hashkafaIssue = validateHashkafa([
  "יהודה כץ ושאנן סטריט",
  "בלעדיך לא אבוא",
]);
console.assert(hashkafaIssue !== null, "hashkafa on featured");

const nassoBaladek = nasso.find((r) => r.title.includes("בלעדיך"));
const baladekValidation = validateStagingMatch({
  query: "יהודה כץ - בלעדיך לא אבוא",
  hit: {
    id: "1",
    song_name: "בלעדיך לא אבוא",
    artist: "יהודה כץ ושאנן סטריט",
    tags: [],
  },
  confidence: 0.9,
  pshRow: nassoBaladek,
  parashaContext: { targetParasha: "נשא", catalogRows: nasso },
});
console.assert(baladekValidation.issue?.code === "HASHKAFA_SECULAR_ARTIST", "blocks featured on meili hit");

console.log("playlist-validation self-test OK");
