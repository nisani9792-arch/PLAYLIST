import { Router } from "express";

const router = Router();

const MS_BASE = "http://164.92.213.53";
const MS_API_KEY = "e9255b27a8ef254eb0d24828f63b6020e0178d64edc9ab5a529609d215acdc6e";
const MS_INDEX = "music";

router.post("/", async (req, res) => {
  const { q, limit = 20 } = req.body as { q?: string; limit?: number };

  if (!q || typeof q !== "string" || !q.trim()) {
    res.json({ hits: [] });
    return;
  }

  try {
    const response = await fetch(`${MS_BASE}/indexes/${MS_INDEX}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MS_API_KEY}`,
      },
      body: JSON.stringify({
        q: q.trim(),
        limit,
        filter: ["type = SONG"],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(502).json({ error: `Meilisearch error: ${response.status}`, detail: text });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: `Search proxy error: ${msg}` });
  }
});

export default router;
