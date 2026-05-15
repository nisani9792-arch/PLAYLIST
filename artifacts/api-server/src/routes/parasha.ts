import { Router } from "express";
import { getSongsForParasha, getPshCatalogRows } from "../lib/psh-catalog";
import { ensurePshCatalogLoaded } from "../lib/psh-pdf-store";
import {
  promptLooksParashaRelated,
  resolveParashaNameFromPrompt,
} from "../lib/psh-parasha-names";

const router = Router();

router.post("/resolve", async (req, res) => {
  const { prompt, maxSongs = 30 } = req.body as {
    prompt?: string;
    maxSongs?: number;
  };

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "Missing prompt" });
    return;
  }

  const parasha = resolveParashaNameFromPrompt(prompt);
  if (!parasha) {
    res.status(400).json({
      error: "Could not detect parasha name. Try e.g. פרשת שמות",
      hint: promptLooksParashaRelated(prompt),
    });
    return;
  }

  const loaded = await ensurePshCatalogLoaded();
  if (!loaded) {
    res.status(503).json({
      error: "PSH.pdf not available on server. Upload via admin or set PSH_PDF_PATH.",
      parasha,
    });
    return;
  }

  const limit = Math.min(Math.max(1, Math.floor(Number(maxSongs)) || 30), 40);
  const bundle = getSongsForParasha(parasha, getPshCatalogRows(), limit);

  res.json({
    parasha: bundle.parasha,
    lines: bundle.allLines,
    parashaLines: bundle.parashaLines,
    haftarahLines: bundle.haftarahLines,
    pdfSongCount: bundle.allLines.length,
    parashaOnlyCount: bundle.parashaLines.length,
    haftarahCount: bundle.haftarahLines.length,
    source: "psh-pdf",
  });
});

router.get("/catalog-status", async (_req, res) => {
  const loaded = await ensurePshCatalogLoaded();
  const rows = getPshCatalogRows();
  res.json({
    loaded,
    songCount: rows.length,
    parashot: [...new Set(rows.map((r) => r.parasha))].length,
  });
});

export default router;
