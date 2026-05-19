import { Router } from "express";
import {
  getOperatorPreferences,
  listRecentPlaylists,
  recordStagingEvents,
  savePlaylistSnapshot,
  setOperatorPreferences,
} from "../lib/playlist-store";
import type { RequestWithOperator } from "../middleware/operator";
import type { OperatorPreferencesJson } from "@workspace/db";

const router = Router();

function operatorName(req: RequestWithOperator): string {
  return String(req.operatorName ?? "").trim();
}

router.get("/", async (req, res) => {
  const name = operatorName(req);
  if (!name) {
    res.status(401).json({ error: "operator required" });
    return;
  }
  const rows = await listRecentPlaylists(name, 20);
  res.json({ playlists: rows });
});

router.post("/", async (req, res) => {
  const op = operatorName(req);
  if (!op) {
    res.status(401).json({ error: "operator required" });
    return;
  }
  const { name, songs, sourcePrompt, parasha } = req.body as {
    name?: string;
    songs?: unknown[];
    sourcePrompt?: string;
    parasha?: string;
  };
  if (!name?.trim() || !Array.isArray(songs)) {
    res.status(400).json({ error: "name and songs required" });
    return;
  }
  const id = await savePlaylistSnapshot({
    operatorName: op,
    name: name.trim(),
    songs,
    sourcePrompt,
    parasha,
  });
  res.json({ id });
});

router.post("/staging-events", async (req, res) => {
  const op = operatorName(req);
  if (!op) {
    res.status(401).json({ error: "operator required" });
    return;
  }
  const { events } = req.body as {
    events?: Array<{
      query: string;
      chosenUid?: string;
      rejectedUids?: string[];
      parasha?: string;
      confidence?: number;
    }>;
  };
  if (!Array.isArray(events)) {
    res.status(400).json({ error: "events array required" });
    return;
  }
  await recordStagingEvents(op, events.slice(0, 200));
  res.json({ ok: true });
});

router.get("/preferences", async (req, res) => {
  const op = operatorName(req);
  if (!op) {
    res.status(401).json({ error: "operator required" });
    return;
  }
  const preferences = await getOperatorPreferences(op);
  res.json({ preferences });
});

router.put("/preferences", async (req, res) => {
  const op = operatorName(req);
  if (!op) {
    res.status(401).json({ error: "operator required" });
    return;
  }
  const preferences = (req.body?.preferences ?? {}) as OperatorPreferencesJson;
  await setOperatorPreferences(op, preferences);
  res.json({ preferences });
});

router.get("/suggestions", async (req, res) => {
  const op = operatorName(req);
  if (!op) {
    res.status(401).json({ error: "operator required" });
    return;
  }
  const recent = await listRecentPlaylists(op, 5);
  const prefs = await getOperatorPreferences(op);
  res.json({
    recentPlaylists: recent,
    preferredGenres: prefs.preferredGenres ?? [],
    styleNotes: prefs.geminiStyleNotes ?? "",
  });
});

export default router;
