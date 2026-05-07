import { Router } from "express";
import {
  getMeilisearchConfig,
  isMeilisearchConfigured,
} from "../lib/meilisearch-config";

const router = Router();

const MAX_LIMIT = 100;
const MAX_GENRE_LEN = 96;

function escapeFilterValue(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildFilters(body: {
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

router.post("/", async (req, res) => {
  if (!isMeilisearchConfigured()) {
    res.status(503).json({ error: "Search is not configured on the server" });
    return;
  }

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

  const filter = buildFilters({ songsOnly, genre });

  const { baseUrl, apiKey, index } = getMeilisearchConfig();

  try {
    const payload: Record<string, unknown> = {
      q: q.trim(),
      limit,
    };
    if (filter?.length) {
      payload.filter = filter;
    }

    const response = await fetch(`${baseUrl}/indexes/${index}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      res
        .status(502)
        .json({ error: `Meilisearch error: ${response.status}`, detail: text });
      return;
    }

    const data = (await response.json()) as { hits?: unknown[] };
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: `Search proxy error: ${msg}` });
  }
});

export default router;
