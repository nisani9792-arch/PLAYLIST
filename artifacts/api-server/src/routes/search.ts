import { Router } from "express";
import {
  getMeilisearchConfig,
  isMeilisearchConfigured,
} from "../lib/meilisearch-config";

const router = Router();

const MAX_LIMIT = 100;
const MAX_GENRE_LEN = 96;
const MAX_RESOLVE_ITEMS = 400;

function escapeFilterValue(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildMeilisearchFilters(body: {
  songsOnly?: boolean;
  genre?: string;
}): string[] | undefined {
  const filters: string[] = [];
  if (body.songsOnly !== false) {
    filters.push("type = SONG");
  }
  const rawGenre = body.genre?.trim();
  if (rawGenre) {
    const cut = rawGenre.slice(0, MAX_GENRE_LEN);
    filters.push(`genres = "${escapeFilterValue(cut)}"`);
  }
  return filters.length ? filters : undefined;
}

function buildMeiliHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  return headers;
}

async function runMeiliSearch(
  baseUrl: string,
  index: string,
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<{ hits?: unknown[] }> {
  const response = await fetch(`${baseUrl}/indexes/${index}/search`, {
    method: "POST",
    headers: buildMeiliHeaders(apiKey),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meilisearch error: ${response.status} ${text.slice(0, 180)}`);
  }
  return (await response.json()) as { hits?: unknown[] };
}

// ── Route handler ──────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const {
    q,
    limit: rawLimit = 20,
    songsOnly,
    genre,
  } = req.body as {
    q?: string;
    limit?: number;
    songsOnly?: boolean;
    genre?: string;
  };

  if (!q || typeof q !== "string" || !q.trim()) {
    res.json({ hits: [] });
    return;
  }

  const limit = Math.min(
    Math.max(1, Math.floor(Number(rawLimit)) || 20),
    MAX_LIMIT,
  );

  // ── Primary: Meilisearch ───────────────────────────────────────────────
  if (isMeilisearchConfigured()) {
    const filter = buildMeilisearchFilters({ songsOnly, genre });
    const { baseUrl, apiKey, index } = getMeilisearchConfig();

    try {
      const payload: Record<string, unknown> = { q: q.trim(), limit };
      if (filter?.length) payload.filter = filter;
      const data = await runMeiliSearch(baseUrl, index, apiKey, payload);
      res.json(data);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(502).json({ error: `Search proxy error: ${msg}` });
      return;
    }
  }

  // ── Nothing configured: return empty hits (not 503) ────────────────────
  res.json({
    hits: [],
    _warning: "Search not configured. Set MEILISEARCH_URL/KEY.",
  });
});

router.post("/resolve", async (req, res) => {
  const { songs } = req.body as {
    songs?: Array<{ id?: string; song_name?: string; artist?: string; album?: string }>;
  };

  if (!Array.isArray(songs)) {
    res.status(400).json({ error: "Expected { songs: [...] }" });
    return;
  }
  if (songs.length > MAX_RESOLVE_ITEMS) {
    res.status(400).json({ error: `Too many items (max ${MAX_RESOLVE_ITEMS})` });
    return;
  }
  if (!isMeilisearchConfigured()) {
    res.json({ hits: songs.map(() => null), _warning: "Search not configured. Set MEILISEARCH_URL/KEY." });
    return;
  }

  const { baseUrl, apiKey, index } = getMeilisearchConfig();
  const runId = `resolve_${Date.now()}`;

  try {
    const resolved = await Promise.all(
      songs.map(async (song) => {
        const rawId = String(song.id ?? "").trim();
        const safeId = escapeFilterValue(rawId);

        // 1) Strict lookup by uid (database/external id equivalent in index)
        if (safeId) {
          const byUid = await runMeiliSearch(baseUrl, index, apiKey, {
            q: "",
            limit: 1,
            filter: ["type = SONG", `uid = "${safeId}"`],
          });
          const firstUid = Array.isArray(byUid.hits) ? byUid.hits[0] : undefined;
          if (firstUid) return firstUid as Record<string, unknown>;
        }

        // 2) Fallback to text lookup, but still return canonical DB hit.
        const fuzzyQ = `${song.artist ?? ""} ${song.song_name ?? ""}`.trim();
        if (!fuzzyQ) return null;
        const byText = await runMeiliSearch(baseUrl, index, apiKey, {
          q: fuzzyQ,
          limit: 1,
          filter: ["type = SONG"],
        });
        const firstText = Array.isArray(byText.hits) ? byText.hits[0] : undefined;
        return (firstText as Record<string, unknown> | undefined) ?? null;
      }),
    );
    // #region agent log
    fetch('http://127.0.0.1:7720/ingest/a3b66527-1e2c-496d-8748-962b4e82cf3c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0e4088'},body:JSON.stringify({sessionId:'0e4088',runId,hypothesisId:'H4',location:'routes/search.ts:resolve-success',message:'Resolve endpoint completed',data:{inputCount:songs.length,resolvedCount:resolved.filter(Boolean).length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    res.json({ hits: resolved });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    // #region agent log
    fetch('http://127.0.0.1:7720/ingest/a3b66527-1e2c-496d-8748-962b4e82cf3c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0e4088'},body:JSON.stringify({sessionId:'0e4088',runId,hypothesisId:'H4',location:'routes/search.ts:resolve-fail',message:'Resolve endpoint failed',data:{error:msg},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    res.status(502).json({ error: `Resolve search proxy error: ${msg}` });
  }
});

export default router;
