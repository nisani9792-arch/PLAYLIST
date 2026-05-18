import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { repairPshRow } from "./psh-repair";
import type { PshSongRow } from "./psh-types";
import {
  odooImportArtistFromHit,
  odooImportSongNameFromHit,
} from "./ms-hit.js";
import { dedupePlaylistLines } from "./sanitize";
import { assertHashkafaClean } from "./secular-artists";
import {
  findPshRowForLine,
  validateHashkafa,
  validateStagingMatch,
} from "./validate";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../artifacts/api-server/data/psh-catalog.json",
);
const allRows = (JSON.parse(readFileSync(root, "utf8")) as PshSongRow[]).map(
  repairPshRow,
);
const nasso = allRows.filter((r) => r.parasha === "נשא");
const ctx = {
  targetParasha: "נשא",
  catalogRows: nasso,
  allCatalogRows: allRows,
};

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const wmaLines = [
  "חיים בר - הוא שומר עלינו - סינגל.wma",
  "חיים בר - הוא שומר עלינו - סינגל.wma",
  "חיים בר - הוא שומר עלינו.wma",
];
const deduped = dedupePlaylistLines(wmaLines);
assert(deduped.length === 1, "wma dedupe");
assert(!deduped[0]!.includes(".wma"), "wma stripped");

assert(
  assertHashkafaClean("יהודה כץ ושאנן סטריט בלעדיך לא אבוא") !== null,
  "blocks shanan street",
);

const vaahavta = findPshRowForLine(
  "ואהבת לרעך כמוך - בני אלבז",
  nasso,
  "נשא",
  allRows,
);
assert(vaahavta?.artist.includes("פרחי"), "vaahavta → פרחי בני הישיבות");

const yivarechecha = findPshRowForLine(
  "הורה עם דודוד - נפשנו",
  nasso,
  "נשא",
  allRows,
);
assert(
  yivarechecha?.title.includes("יברכך"),
  "הורה עם דודוד → יברכך",
);

const yaale = findPshRowForLine(
  "Be Free - צבי זילברשטיין",
  nasso,
  "נשא",
  allRows,
);
assert(yaale?.title.includes("יעלה"), "Be Free → יעלה");

const baladekValidation = validateStagingMatch({
  query: "יהודה כץ - בלעדיך לא אבוא",
  hit: {
    id: "1",
    song_name: "בלעדיך לא אבוא",
    artist: "יהודה כץ",
    tags: [],
  },
  confidence: 0.9,
  parashaContext: ctx,
});
assert(
  baladekValidation.issue?.code === "HASHKAFA_SECULAR_ARTIST" ||
    baladekValidation.issue?.code === "PARASHA_MISMATCH",
  "blocks בלעדיך in נשא",
);

const simShalomBlock = validateStagingMatch({
  query: "שים שלום - דדי גראוכר",
  hit: null,
  confidence: 0,
  parashaContext: ctx,
});
assert(
  simShalomBlock.issue?.code === "PARASHA_MISMATCH",
  "שים שלום blocked for נשא",
);

const canonicalDemo = validateStagingMatch({
  query: "ואהבת לרעך כמוך - בני אלבז",
  hit: {
    id: "9",
    song_name: "ואהבת לרעך כמוך",
    artist: "בני אלבז",
  },
  confidence: 0.95,
  parashaContext: ctx,
});
assert(
  canonicalDemo.canonicalHit?.artist.includes("פרחי"),
  "canonical overwrite בני אלבז → פרחי",
);

const mendy = validateStagingMatch({
  query: "אחד יחיד ומיוחד - מנדי פיאמנטה",
  hit: {
    id: "2",
    song_name: "אחד יחיד ומיוחד",
    artist: "מנדי פיאמנטה",
  },
  confidence: 0.85,
  parashaContext: ctx,
});
assert(
  !mendy.issue &&
    mendy.canonicalHit?.artist.includes("וואלד"),
  "מנדי פיאמנטה → מנדי וואלד in נשא",
);

assert(validateHashkafa(["יהודה כץ ושאנן סטריט", "בלעדיך לא אבוא"]) !== null, "hashkafa featured");

assert(
  odooImportArtistFromHit({
    artist_he: "מדד טסה",
    artist: "מידד טסה עקיבא תורג'מן",
  }) === "מידד טסה עקיבא תורג'מן",
  "Odoo export prefers artist over artist_he",
);
assert(
  odooImportArtistFromHit({
    artists: ["מידד טסה", "עקיבא תורג'מן"],
  }) === "מידד טסה עקיבא תורג'מן",
  "Odoo export joins artists array with spaces",
);
assert(
  odooImportSongNameFromHit({ name_he: "שבתראמפ", song_name: "Shabbos Ramp" }) ===
    "שבתראמפ",
  "Odoo export prefers Hebrew song title",
);

console.log("playlist-validation self-test OK");
