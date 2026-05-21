import { Router } from "express";
import {
  artistCountsFromLines,
  buildCuratorPromptV2,
  buildFillCuratorPrompt,
  buildFillRankSelectionPrompt,
  buildFillTopicQueries,
  buildPlaylistResearchPrompt,
  buildRankSelectionPrompt,
  buildTopicQueries,
  buildVibeAnalysisPrompt,
  computeFillTarget,
  computeTargetSize,
  excludeKeysFromLines,
  expandTopicFacets,
  formatArtistSongLine,
  mergeVibeWithResearch,
  parsePlaylistResearchJson,
  parseRankSelectionJson,
  parseVibeFromPrompt,
  parseVibeJson,
  rankAndSelectCandidates,
  researchToVibePatch,
  scoreHitForTopic,
  type CuratorBuildResult,
} from "@workspace/curator";
import { matchConfidence } from "@workspace/playlist-validation";
import { createGeminiClient } from "../lib/gemini-client-factory";
import {
  fetchSettingsKeys,
  resolveGeminiConnection,
  SETTINGS_KEYS,
} from "../lib/system-settings-store";
import {
  getOperatorPreferences,
  listRecentPlaylists,
} from "../lib/playlist-store";
import {
  scoreHitAgainstTopic,
  searchCatalogQuery,
  searchTopicBatch,
} from "../lib/meilisearch-service";
import { logger } from "../lib/logger";
import type { RequestWithOperator } from "../middleware/operator";

const router = Router();
const PLAYLIST_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"] as const;
const PARASHA_HINTS = ["פרשה", "פרשת", "psh"];

async function getGeminiClientOrThrow() {
  const { baseUrl, apiKey } = await resolveGeminiConnection();
  return createGeminiClient(baseUrl, apiKey);
}

function promptLooksLikeSongList(prompt: string): boolean {
  const lines = prompt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 3) return false;
  const lineLikeSongs = lines.filter((line) => /[-–—]|אמן|feat\.?|ft\.?/i.test(line)).length;
  return lineLikeSongs >= Math.ceil(lines.length * 0.5);
}

function promptIsParashaRelated(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return PARASHA_HINTS.some((token) => lower.includes(token.toLowerCase()));
}

async function buildOperatorMemoryBlock(operatorName: string): Promise<string> {
  const name = operatorName.trim();
  if (!name) return "";
  const [recent, prefs] = await Promise.all([
    listRecentPlaylists(name, 5),
    getOperatorPreferences(name),
  ]);
  const lines: string[] = [];
  const style = prefs.geminiStyleNotes?.trim();
  const genres = (prefs.preferredGenres ?? []).filter(Boolean);
  if (style) lines.push(`העדפות סגנון המפעיל: ${style}`);
  if (genres.length) lines.push(`ז'אנרים מועדפים: ${genres.join(", ")}`);
  if (recent.length) {
    lines.push(
      "פלייליסטים אחרונים (השראה בלבד):",
      ...recent.map(
        (p: { name: string; parasha?: string | null }) =>
          `- ${p.name}${p.parasha ? ` (פרשת ${p.parasha})` : ""}`,
      ),
    );
  }
  return lines.length ? `## זיכרון מפעיל\n${lines.join("\n")}` : "";
}

async function geminiGenerate(client: Awaited<ReturnType<typeof getGeminiClientOrThrow>>, text: string) {
  let lastErr: unknown;
  for (const model of PLAYLIST_MODELS) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text }] }],
        config: { maxOutputTokens: 8192 },
      });
      return response.text ?? "";
    } catch (err) {
      lastErr = err;
      logger.warn({ model, err }, "Curator Gemini call failed");
    }
  }
  throw lastErr ?? new Error("Gemini failed");
}

function linesFromLegacyJson(text: string): string[] {
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    const parsed = JSON.parse(cleaned) as { songs?: unknown[] };
    if (!Array.isArray(parsed.songs)) return [];
    return parsed.songs
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter((l) => l.length > 2);
  } catch {
    return [];
  }
}

/**
 * POST /api/curator/build
 * Catalog-first playlist builder: vibe → Meilisearch → rank → hashkafa
 */
router.post("/build", async (req, res) => {
  const { prompt, targetSize, mode, excludeIds } = req.body as {
    prompt?: string;
    targetSize?: number;
    mode?: "topic" | "parasha" | "list";
    excludeIds?: string[];
  };

  if (!prompt?.trim()) {
    res.status(400).json({ error: "Missing prompt" });
    return;
  }

  const operatorName = (req as RequestWithOperator).operatorName ?? "";
  const modeList = mode === "list" || promptLooksLikeSongList(prompt);
  const isParasha = mode === "parasha" || promptIsParashaRelated(prompt);

  let vibe = parseVibeFromPrompt(prompt);
  let facets = expandTopicFacets(prompt, vibe);

  try {
    const client = await getGeminiClientOrThrow();
    const researchText = await geminiGenerate(
      client,
      buildPlaylistResearchPrompt(prompt),
    );
    const research = parsePlaylistResearchJson(researchText, prompt);
    if (research) {
      vibe = mergeVibeWithResearch(vibe, researchToVibePatch(research));
      facets = expandTopicFacets(prompt, vibe);
      for (const q of research.searchQueries.slice(0, 6)) {
        if (q.length >= 2) facets.searchQueries.push(q);
      }
      for (const t of research.tagHints) facets.tagHints.push(t);
    }
  } catch (err) {
    logger.warn({ err }, "Playlist research skipped — using rule-based facets");
  }

  const queries = [
    ...new Set([...buildTopicQueries(prompt, vibe), ...facets.searchQueries]),
  ].slice(0, 14);
  let candidates = await searchTopicBatch(
    queries,
    28,
    facets.genreHints.length ? facets.genreHints : undefined,
  );

  if (!candidates.length) {
    candidates = await searchCatalogQuery(prompt, 60);
  }

  for (const hit of candidates) {
    hit._rankingScore = scoreHitForTopic(hit, { topic: prompt, vibe, facets });
  }

  const size = computeTargetSize({
    isListMode: modeList,
    isParasha,
    isNiche: candidates.length < 40,
    availableHits: candidates.length,
    requestedTarget: targetSize,
  });

  const excludeKeys = new Set(
    (excludeIds ?? []).map((id) => `id:${String(id).toLowerCase()}`),
  );

  let selected = rankAndSelectCandidates(candidates, size, excludeKeys).selected;

  try {
    const client = await getGeminiClientOrThrow();
    const vibeText = await geminiGenerate(client, buildVibeAnalysisPrompt(prompt));
    vibe = parseVibeJson(vibeText, prompt);
    facets = expandTopicFacets(prompt, vibe);
    for (const hit of candidates) {
      hit._rankingScore = scoreHitForTopic(hit, { topic: prompt, vibe, facets });
    }
    candidates.sort((a, b) => (b._rankingScore ?? 0) - (a._rankingScore ?? 0));
    selected = rankAndSelectCandidates(candidates, size, excludeKeys).selected;

    if (candidates.length >= 5) {
      const rankPrompt = buildRankSelectionPrompt(prompt, candidates, size, vibe.reason);
      const rankText = await geminiGenerate(client, rankPrompt);
      const aiPicked = parseRankSelectionJson(rankText, candidates, size);
      if (aiPicked.length >= Math.min(size, 10)) {
        selected = aiPicked;
      }
    }
  } catch (err) {
    logger.warn({ err }, "Curator AI enrichment skipped — using catalog rank");
  }

  if (!selected.length && modeList) {
    const settings = await fetchSettingsKeys([SETTINGS_KEYS.AI_CUSTOM_INSTRUCTIONS]);
    const customInstructions = settings[SETTINGS_KEYS.AI_CUSTOM_INSTRUCTIONS]?.trim() ?? "";
    const operatorMemory = operatorName ? await buildOperatorMemoryBlock(operatorName) : "";
    try {
      const client = await getGeminiClientOrThrow();
      const legacyPrompt = buildCuratorPromptV2({
        prompt,
        customInstructions,
        includePshPdf: false,
        operatorMemory,
        modeList: true,
        targetSize: size,
      });
      const text = await geminiGenerate(client, legacyPrompt);
      const lines = linesFromLegacyJson(text);
      res.json({
        meta: { vibe: vibe.mood, tact: vibe.tact, targetSize: size, reason: vibe.reason },
        lines,
        items: lines.map((line) => ({ line, artist: line.split(" - ")[0] ?? "", title: line.split(" - ")[1] ?? line })),
      } satisfies CuratorBuildResult);
      return;
    } catch {
      // fall through
    }
  }

  const items = selected.map((hit) => {
    const line = hit._line ?? formatArtistSongLine(hit);
    const confidence = matchConfidence(prompt, hit.artist, hit);
    return {
      line,
      artist: hit.artist,
      title: hit.song_name,
      uid: hit.id,
      confidence,
      blocked: false,
    };
  });

  const result: CuratorBuildResult = {
    meta: {
      vibe: vibe.mood,
      tact: vibe.tact,
      targetSize: size,
      reason: vibe.reason ?? (candidates.length < 20 ? `נמצאו ${candidates.length} שירים בנושא` : undefined),
    },
    lines: items.map((i) => i.line),
    items,
  };

  res.json(result);
});

/**
 * POST /api/curator/fill — AI-aware completion of partial playlist (20–50 songs)
 */
router.post("/fill", async (req, res) => {
  const { topic, targetSize, existingLines = [] } = req.body as {
    topic?: string;
    targetSize?: number;
    existingLines?: string[];
  };

  if (!topic?.trim()) {
    res.status(400).json({ error: "Missing topic" });
    return;
  }

  const lines = existingLines.map((l) => l.trim()).filter(Boolean);
  const fillTarget = computeFillTarget(lines.length, targetSize);
  const needed = Math.max(0, fillTarget - lines.length);

  if (needed === 0) {
    res.json({
      meta: { targetSize: fillTarget, reason: "הפלייליסט כבר במטרה" },
      lines: [],
      items: [],
    });
    return;
  }

  const fillPrompt = buildFillCuratorPrompt(topic, lines, needed);
  const excludeKeys = excludeKeysFromLines(lines);
  const artistCounts = artistCountsFromLines(lines);

  let vibe = parseVibeFromPrompt(fillPrompt);
  let facets = expandTopicFacets(topic, vibe);
  const uniqueQueries = [
    ...new Set([
      ...buildFillTopicQueries(topic, lines),
      ...buildTopicQueries(topic, vibe),
      ...facets.searchQueries,
    ]),
  ].slice(0, 14);

  let candidates = await searchTopicBatch(
    uniqueQueries,
    36,
    facets.genreHints.length ? facets.genreHints : undefined,
  );
  if (!candidates.length) {
    candidates = await searchCatalogQuery(`${topic} ${lines.slice(0, 3).join(" ")}`, 60);
  }

  for (const hit of candidates) {
    hit._rankingScore = scoreHitForTopic(hit, { topic, vibe, facets });
  }
  candidates.sort((a, b) => (b._rankingScore ?? 0) - (a._rankingScore ?? 0));

  let selected = rankAndSelectCandidates(
    candidates,
    needed,
    excludeKeys,
    artistCounts,
  ).selected;

  try {
    const client = await getGeminiClientOrThrow();
    const vibeText = await geminiGenerate(client, buildVibeAnalysisPrompt(fillPrompt));
    vibe = parseVibeJson(vibeText, fillPrompt);

    if (candidates.length >= 5) {
      const rankPrompt = buildFillRankSelectionPrompt(
        topic,
        lines,
        candidates,
        needed,
        vibe.reason,
      );
      const rankText = await geminiGenerate(client, rankPrompt);
      const aiPicked = parseRankSelectionJson(rankText, candidates, needed, excludeKeys);
      const minAccept = Math.min(needed, Math.max(3, Math.ceil(needed * 0.4)));
      if (aiPicked.length >= minAccept) {
        selected = aiPicked;
      }
    }
  } catch (err) {
    logger.warn({ err }, "Curator fill AI enrichment skipped — using catalog rank");
  }

  const items = selected.map((hit) => {
    const line = hit._line ?? formatArtistSongLine(hit);
    const confidence = matchConfidence(fillPrompt, hit.artist, hit);
    return {
      line,
      artist: hit.artist,
      title: hit.song_name,
      uid: hit.id,
      confidence,
      blocked: false,
    };
  });

  res.json({
    meta: {
      vibe: vibe.mood,
      tact: vibe.tact,
      targetSize: fillTarget,
      reason: vibe.reason ?? `הושלמו ${items.length} שירים ל-${fillTarget}`,
    },
    lines: items.map((i) => i.line),
    items,
  } satisfies CuratorBuildResult);
});

/**
 * POST /api/curator/build/stream — SSE with vibe → progress → song → done
 */
router.post("/build/stream", async (req, res) => {
  const { prompt, targetSize } = req.body as { prompt?: string; targetSize?: number };

  if (!prompt?.trim()) {
    res.status(400).json({ error: "Missing prompt" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const send = (payload: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    let vibe = parseVibeFromPrompt(prompt);
    let facets = expandTopicFacets(prompt, vibe);
    send({ stage: "vibe", vibe });

    const queries = [
      ...new Set([...buildTopicQueries(prompt, vibe), ...facets.searchQueries]),
    ].slice(0, 14);
    send({ stage: "progress", message: "מחפש במאגר לפי נושא ותגיות...", queries: queries.length });

    let candidates = await searchTopicBatch(
      queries,
      28,
      facets.genreHints.length ? facets.genreHints : undefined,
    );
    for (const hit of candidates) {
      hit._rankingScore = scoreHitForTopic(hit, { topic: prompt, vibe, facets });
    }
    candidates.sort((a, b) => (b._rankingScore ?? 0) - (a._rankingScore ?? 0));

    const size = computeTargetSize({
      availableHits: candidates.length,
      requestedTarget: targetSize,
    });

    send({ stage: "progress", found: candidates.length, targetSize: size });

    const { selected } = rankAndSelectCandidates(candidates, size);
    for (let i = 0; i < selected.length; i++) {
      const hit = selected[i]!;
      const line = hit._line ?? formatArtistSongLine(hit);
      send({ stage: "song", line, index: i + 1, total: selected.length });
    }

    send({ stage: "done", total: selected.length });
    res.end();
  } catch (err) {
    send({ stage: "error", error: err instanceof Error ? err.message : "Unknown error" });
    res.end();
  }
});

export default router;
