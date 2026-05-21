import { computeTargetSize, PLAYLIST_MIN, PLAYLIST_MAX } from "./size-engine";
import { parseVibeFromPrompt } from "./vibe-analysis";
import { buildTopicQueries } from "./topic-queries";
import { expandTopicFacets } from "./topic-facets";
import { scoreHitForTopic, TOPIC_STAGING_MIN_SCORE } from "./topic-match";
import { rankAndSelectCandidates, formatArtistSongLine } from "./rank-select";
import type { MsHitLike } from "@workspace/playlist-validation";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

// size engine
assert(computeTargetSize({ availableHits: 100 }) === 50, "max 50");
assert(computeTargetSize({ availableHits: 25 }) === 25, "available 25");
assert(computeTargetSize({ isNiche: true, availableHits: 30 }) >= PLAYLIST_MIN, "niche min");

// vibe
const vibe = parseVibeFromPrompt("גשם בחורף שקט");
assert(vibe.mood === "quiet", "winter quiet vibe");
assert(vibe.avoidUpbeat === true, "avoid upbeat");

const chupaVibe = parseVibeFromPrompt("לפני החופה");
assert(chupaVibe.mood === "celebratory", "chupa celebratory");
const chupaFacets = expandTopicFacets("לפני החופה", chupaVibe);
assert(chupaFacets.tagHints.includes("חופה"), "chupa tag hint");

const chupaBad = scoreHitForTopic(
  { id: "1", song_name: "לפני השם", artist: "ירמיה דמן", tags: [] },
  "לפני החופה",
);
const chupaGood = scoreHitForTopic(
  {
    id: "2",
    song_name: "ריקודי חופה",
    artist: "אמן",
    tags: ["חתונה", "חופה"],
    genre: "חסידי",
  },
  "לפני החופה",
);
assert(chupaBad < TOPIC_STAGING_MIN_SCORE, "chupa rejects לפני השם");
assert(chupaGood >= TOPIC_STAGING_MIN_SCORE, "chupa accepts wedding tags");

// topic queries
const queries = buildTopicQueries("אמונה", vibe);
assert(queries.length >= 1, "queries generated");

// rank select
const candidates: MsHitLike[] = [
  { id: "1", song_name: "שיר א", artist: "אמן א", _rankingScore: 0.9 },
  { id: "2", song_name: "שיר ב", artist: "אמן א", _rankingScore: 0.8 },
  { id: "3", song_name: "שיר ג", artist: "אמן ב", _rankingScore: 0.7 },
];
const { selected } = rankAndSelectCandidates(candidates, 2);
assert(selected.length === 2, "selected 2");
assert(formatArtistSongLine(candidates[0]!).includes(" - "), "line format");

console.log("curator self-test OK", { PLAYLIST_MIN, PLAYLIST_MAX, queries: queries.length });
