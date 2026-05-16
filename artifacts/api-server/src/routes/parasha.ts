import { Router } from "express";
import { getSongsForParasha, getPshCatalogRows, toPlaylistLine } from "../lib/psh-catalog";
import { normalizeParashaToken } from "../lib/psh-parasha-names";
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
  const catalogRows = getPshCatalogRows();
  const bundle = getSongsForParasha(parasha, catalogRows, limit);
  const target = bundle.parasha;
  const songs = catalogRows.filter((r) => r.parasha === target);
  const parashaSongs = songs.filter((r) => r.section === "parasha");
  const haftarahSongs = songs.filter((r) => r.section === "haftarah");
  const pickLines = (sectionRows: typeof songs) => {
    const seen = new Set<string>();
    const out: typeof songs = [];
    for (const row of sectionRows) {
      const line = `${row.artist} - ${row.title}`;
      const key = line.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
      if (out.length >= limit) break;
    }
    return out;
  };
  const orderedSongs = [
    ...pickLines(parashaSongs),
    ...pickLines(haftarahSongs),
  ].slice(0, limit);

  const catalogForParasha = catalogRows.filter(
    (r) => normalizeParashaToken(r.parasha) === normalizeParashaToken(target),
  );

  res.json({
    parasha: bundle.parasha,
    lines: orderedSongs.map((r) => toPlaylistLine(r)),
    songs: orderedSongs.map((r) => ({
      parasha: r.parasha,
      title: r.title,
      artist: r.artist,
      album: r.album,
      year: r.year,
      composer: r.composer,
      section: r.section,
      line: toPlaylistLine(r),
    })),
    catalogRows: catalogForParasha,
    parashaLines: bundle.parashaLines,
    haftarahLines: bundle.haftarahLines,
    pdfSongCount: orderedSongs.length,
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
