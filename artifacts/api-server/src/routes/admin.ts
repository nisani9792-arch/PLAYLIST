import { Router } from "express";
import { readFile } from "node:fs/promises";
import { pool } from "@workspace/db";
import {
  fetchAllSettings,
  PATCHABLE_SETTING_KEYS,
  resolveGeminiConnection,
  SETTINGS_KEYS,
  upsertSettings,
} from "../lib/system-settings-store";
import { createGeminiClient } from "../lib/gemini-client-factory";
import {
  buildMeilisearchBearerHeaders,
  getMeilisearchConfigResolved,
} from "../lib/meilisearch-config";

const router = Router();

function envExists(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

router.get("/admin/diagnostics", async (_req, res) => {
  const checkedAt = new Date().toISOString();
  const settings = await fetchAllSettings();

  const database = await (async () => {
    const started = Date.now();
    try {
      const client = await pool.connect();
      try {
        await client.query("SELECT 1");
      } finally {
        client.release();
      }
      return { ok: true as const, latencyMs: Date.now() - started, checkedAt };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Unknown error",
        checkedAt,
      };
    }
  })();

  const meilisearch = await (async () => {
    try {
      const { baseUrl, apiKey, index } = await getMeilisearchConfigResolved();
      const healthRes = await fetch(`${baseUrl}/health`);
      if (!healthRes.ok) {
        return {
          ok: false as const,
          error: `Health check failed: ${healthRes.status}`,
          checkedAt,
        };
      }
      const statsRes = await fetch(`${baseUrl}/indexes/${encodeURIComponent(index)}/stats`, {
        headers: buildMeilisearchBearerHeaders(apiKey),
      });
      if (!statsRes.ok) {
        const detail = await statsRes.text();
        return {
          ok: false as const,
          error: `Index stats failed: ${statsRes.status}`,
          detail: detail.slice(0, 500),
          index,
          checkedAt,
        };
      }
      const stats = (await statsRes.json()) as {
        numberOfDocuments?: number;
        isIndexing?: boolean;
      };
      return {
        ok: true as const,
        index,
        numberOfDocuments: stats.numberOfDocuments ?? null,
        isIndexing: stats.isIndexing ?? null,
        checkedAt,
      };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Unknown error",
        checkedAt,
      };
    }
  })();

  const gemini = await (async () => {
    try {
      const { baseUrl, apiKey } = await resolveGeminiConnection();
      const client = createGeminiClient(baseUrl, apiKey);
      await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: "Reply with exactly: ok" }] }],
        config: { maxOutputTokens: 8 },
      });
      return { ok: true as const, checkedAt };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : "Unknown error",
        checkedAt,
      };
    }
  })();

  const environment = {
    DATABASE_URL: { exists: envExists("DATABASE_URL") },
    GEMINI_API_KEY: { exists: envExists("GEMINI_API_KEY") },
    AI_INTEGRATIONS_GEMINI_API_KEY: { exists: envExists("AI_INTEGRATIONS_GEMINI_API_KEY") },
    AI_INTEGRATIONS_GEMINI_BASE_URL: { exists: envExists("AI_INTEGRATIONS_GEMINI_BASE_URL") },
    MEILI_MASTER_KEY: { exists: envExists("MEILI_MASTER_KEY") },
    MEILISEARCH_API_KEY: { exists: envExists("MEILISEARCH_API_KEY") },
    MEILISEARCH_URL: { exists: envExists("MEILISEARCH_URL") },
  };

  res.json({
    checkedAt,
    database,
    meilisearch,
    gemini,
    environment,
    psh: {
      importedAt: settings[SETTINGS_KEYS.AI_PSH_IMPORTED_AT] ?? null,
      fileName: settings[SETTINGS_KEYS.AI_PSH_PDF_NAME] ?? null,
      hasPdf:
        typeof settings[SETTINGS_KEYS.AI_PSH_PDF_BASE64] === "string" &&
        settings[SETTINGS_KEYS.AI_PSH_PDF_BASE64].length > 0,
    },
  });
});

router.get("/admin/settings", async (_req, res) => {
  try {
    const settings = await fetchAllSettings();
    res.json({ settings });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to load settings",
    });
  }
});

router.patch("/admin/settings", async (req, res) => {
  const body = req.body as { settings?: Record<string, unknown> };
  if (!body.settings || typeof body.settings !== "object" || Array.isArray(body.settings)) {
    res.status(400).json({ error: "Expected { settings: { key: value, ... } }" });
    return;
  }

  const updates: Record<string, string> = {};
  for (const [key, raw] of Object.entries(body.settings)) {
    if (!PATCHABLE_SETTING_KEYS.has(key)) {
      res.status(400).json({ error: `Unknown or read-only setting key: ${key}` });
      return;
    }
    if (raw === null || raw === undefined) {
      updates[key] = "";
      continue;
    }
    if (typeof raw !== "string") {
      res.status(400).json({ error: `Setting ${key} must be a string` });
      return;
    }
    updates[key] = raw;
  }

  try {
    await upsertSettings(updates);
    const settings = await fetchAllSettings();
    res.json({ settings });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to save settings",
    });
  }
});

router.post("/admin/psh/import", async (req, res) => {
  const body = req.body as {
    pdfBase64?: string;
    fileName?: string;
    filePath?: string;
  };

  let pdfBase64 = body.pdfBase64?.trim() ?? "";
  const fileName = body.fileName?.trim() || "PSH.pdf";

  if (!pdfBase64 && body.filePath?.trim()) {
    try {
      const buf = await readFile(body.filePath.trim());
      pdfBase64 = buf.toString("base64");
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Failed reading PDF path",
      });
      return;
    }
  }

  if (!pdfBase64) {
    res.status(400).json({ error: "Provide pdfBase64 or filePath" });
    return;
  }

  // Safety guard: keep payload under ~15MB base64 to avoid oversized settings rows.
  if (pdfBase64.length > 20_000_000) {
    res.status(413).json({ error: "PDF is too large" });
    return;
  }

  try {
    await upsertSettings({
      [SETTINGS_KEYS.AI_PSH_PDF_BASE64]: pdfBase64,
      [SETTINGS_KEYS.AI_PSH_PDF_NAME]: fileName,
      [SETTINGS_KEYS.AI_PSH_IMPORTED_AT]: new Date().toISOString(),
    });
    const { reloadPshCatalog } = await import("../lib/psh-pdf-store");
    const catalogSongs = await reloadPshCatalog();

    res.json({
      ok: true,
      fileName,
      bytesApprox: Math.floor((pdfBase64.length * 3) / 4),
      importedAt: new Date().toISOString(),
      catalogSongs,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to save PSH PDF",
    });
  }
});

router.get("/metrics", async (_req, res) => {
  const { getSearchCacheStats } = await import("../lib/search-cache");
  res.json({
    checkedAt: new Date().toISOString(),
    searchCache: getSearchCacheStats(),
    curator: {
      pipeline: "v2",
      playlistMin: 20,
      playlistMax: 50,
    },
  });
});

export default router;
