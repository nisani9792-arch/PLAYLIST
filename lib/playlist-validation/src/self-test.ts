import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { repairPshRow } from "./psh-repair";
import type { PshSongRow } from "./psh-types";
import {
  buildLomdaatPlaylistCsv,
  LOMDAAT_PLAYLIST_HEADERS,
  trimLomdaatSongName,
} from "./lomdaat-export.js";
import {
  lomdaatRowFromMeiliRecord,
  repairMsHitForExport,
} from "./export-row.js";
import {
  odooImportArtistFromHit,
  odooImportSongNameFromHit,
} from "./ms-hit.js";
import { isArtistOnlyPlaylistLine } from "./sanitize.js";
import { buildStagingSearchQuery } from "./staging-query.js";
import { dedupePlaylistLines } from "./sanitize";
import { assertHashkafaClean } from "./secular-artists";
import {
  findPshRowForLine,
  queryMatchesHit,
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
assert(
  odooImportArtistFromHit({
    artist: "David Klein",
    artist_he: "משה קליין",
  }) === "משה קליין",
  "Odoo export uses Hebrew when main artist is Latin",
);
assert(
  odooImportArtistFromHit({
    artist: "מידד טסה / Meded Tasa",
    artist_he: "מדד טסה",
  }) === "מידד טסה",
  "Odoo export strips English from bilingual artist",
);
assert(
  odooImportArtistFromHit({
    artist: "משה קליין (David Klein)",
  }) === "משה קליין",
  "Odoo export strips parenthetical English artist",
);
assert(isArtistOnlyPlaylistLine("יניב בן משיח"), "artist-only header");
assert(!isArtistOnlyPlaylistLine("שבתראמפ"), "single song title is searchable");
assert(
  buildStagingSearchQuery("דוד יפרח - שבת שלום") === "שבת שלום דוד יפרח",
  "staging search is song-first",
);
assert(buildStagingSearchQuery("יניב בן משיח") === null, "artist-only not searched");

const sampleCsv = buildLomdaatPlaylistCsv("בדיקה חדש", [
  { song_name: "שבתראמפ", artist: "ליפא שמעלצר" },
]);
assert(
  sampleCsv.startsWith(LOMDAAT_PLAYLIST_HEADERS),
  "Lomdaat CSV header",
);
assert(!sampleCsv.endsWith("\r\n"), "Lomdaat CSV no trailing CRLF (Odoo template)");
assert(
  sampleCsv === `${LOMDAAT_PLAYLIST_HEADERS}\r\nבדיקה חדש,שבתראמפ,ליפא שמעלצר`,
  "Lomdaat CSV row mapping",
);
assert(
  trimLomdaatSongName("01-אחד יחיד ומיוחד") === "אחד יחיד ומיוחד",
  "Lomdaat song strips track prefix",
);
assert(
  repairMsHitForExport({
    id: "1",
    song_name: "ברכת כהנים נתנאל כהן",
    artist: "סינגל",
  }).artist === "נתנאל כהן",
  "repair splits artist from combined title when artist is סינגל",
);
assert(
  repairMsHitForExport({
    id: "2",
    song_name: "כה תברכו קינדערלך",
    artist: "שיר",
  }).song_name.includes("כה תברכו"),
  "repair keeps song when artist is placeholder שיר",
);
assert(
  repairMsHitForExport({
    id: "3",
    song_name: "בלעדיך לא אבוא",
    artist: "יהודה כץ Yehuda Katz",
  }).artist === "יהודה כץ",
  "repair strips English from bilingual artist in playlist",
);
assert(
  lomdaatRowFromMeiliRecord({
    song_name: "ביום ההוא",
    artist: "ישראל עמר",
  }).artist === "ישראל עמר",
  "lomdaat row uses Meili import fields",
);

const quotedCsv = buildLomdaatPlaylistCsv("My Playlist", [
  { song_name: 'Song, "Special"', artist: "Artist Name" },
]);
assert(
  quotedCsv.includes('My Playlist,"Song, ""Special""",Artist Name'),
  "Lomdaat CSV escapes commas and quotes",
);

const templateCsv = buildLomdaatPlaylistCsv("בדיקה חדש", [
  { song_name: "שבתראמפ", artist: "ליפא שמעלצר" },
  { song_name: "בכיים של הילדים (ווקאלי)", artist: "שי וינר" },
  { song_name: "לא לבד - עם ים רפאלי", artist: "קובי ברומר" },
]);
assert(
  templateCsv ===
    `${LOMDAAT_PLAYLIST_HEADERS}\r\nבדיקה חדש,שבתראמפ,ליפא שמעלצר\r\nבדיקה חדש,בכיים של הילדים (ווקאלי),שי וינר\r\nבדיקה חדש,לא לבד - עם ים רפאלי,קובי ברומר`,
  "Lomdaat CSV matches reference template (CRLF, no quotes, no trailing CRLF)",
);

assert(
  queryMatchesHit("ישראל עמר - ביום ההוא", {
    song_name: "ביום ההוא",
    artist: "ישראל עמר",
  }),
  "queryMatchesHit accepts exact artist-song pairing",
);

console.log("playlist-validation self-test OK");
