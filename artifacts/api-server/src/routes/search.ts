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

// ── PostgreSQL / Drizzle fallback ──────────────────────────────────────────
// Lazily imported so the server starts cleanly when DATABASE_URL is absent.

type DbModule = typeof import("@workspace/db");
let dbCache: DbModule | null | undefined; // undefined = not yet tried; null = unavailable

async function getDbModule(): Promise<DbModule | null> {
  if (!process.env.DATABASE_URL) return null;
  if (dbCache !== undefined) return dbCache;
  try {
    dbCache = await import("@workspace/db");
  } catch {
    dbCache = null;
  }
  return dbCache;
}

/**
 * Normalise a DB artist row into a Meilisearch-shaped hit so the frontend
 * (which calls the same /api/search endpoint) can render it without changes.
 * Field mapping mirrors what the frontend normalises from Meilisearch hits:
 *   uid → id,  name_he → song_name,  artists[] → artist,  genres[] → genre
 */
function artistToHit(row: {
  id: string;
  name: string;
  hebrewName: string | null;
  genres: string[] | null;
}): Record<string, unknown> {
  return {
    uid: row.id,
    id: row.id,
    name_he: row.hebrewName ?? row.name,
    artists: [row.name],
    genres: row.genres ?? [],
    type: "ARTIST",
  };
}

async function dbFallbackSearch(
  q: string,
  limit: number,
  genre?: string,
): Promise<Record<string, unknown>[] | null> {
  const mod = await getDbModule();
  if (!mod) return null;

  const { db, artists } = mod;
  const { ilike, or, arrayContained, sql } = await import("drizzle-orm");

  const term = `%${q.trim()}%`;

  let query = db
    .select({
      id: artists.id,
      name: artists.name,
      hebrewName: artists.hebrewName,
      genres: artists.genres,
    })
    .from(artists)
    .where(
      or(
        ilike(artists.name, term),
        ilike(artists.hebrewName, term),
      ),
    )
    .limit(limit);

  // Genre filter: check if the genres array contains the requested genre
  if (genre?.trim()) {
    const g = genre.trim();
    query = db
      .select({
        id: artists.id,
        name: artists.name,
        hebrewName: artists.hebrewName,
        genres: artists.genres,
      })
      .from(artists)
      .where(
        sql`(${ilike(artists.name, term)} OR ${ilike(artists.hebrewName, term)})
            AND ${artists.genres} @> ARRAY[${g}]::text[]`,
      )
      .limit(limit) as typeof query;
  }

  const rows = await query;
  return rows.map(artistToHit);
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

      const fetchHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) fetchHeaders["Authorization"] = `Bearer ${apiKey}`;

    const response = await fetch(`${baseUrl}/indexes/${index}/search`, {
        method: "POST",
        headers: fetchHeaders,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        res.status(502).json({
          error: `Meilisearch error: ${response.status}`,
          detail: text,
        });
        return;
      }

      const data = (await response.json()) as { hits?: unknown[] };
      res.json(data);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(502).json({ error: `Search proxy error: ${msg}` });
      return;
    }
  }

  // ── Fallback: PostgreSQL / Drizzle ─────────────────────────────────────
  try {
    const hits = await dbFallbackSearch(q, limit, genre);
    if (hits !== null) {
      res.json({ hits, _source: "db" });
      return;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    // DB failed — fall through to empty result rather than 503
    res.json({ hits: [], _warning: `DB search error: ${msg}` });
    return;
  }

  // ── Nothing configured: return empty hits (not 503) ────────────────────
  res.json({
    hits: [],
    _warning: "Search not configured. Set MEILISEARCH_URL/KEY or DATABASE_URL.",
  });
});

export default router;
