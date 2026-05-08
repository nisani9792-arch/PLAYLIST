import { Router } from "express";
import { resolveGeminiConnection } from "../lib/system-settings-store";
import { createGeminiClient } from "../lib/gemini-client-factory";

const router = Router();

const MAX_PROMPT_LEN = 4000;

async function getGeminiClientOrThrow() {
  const { baseUrl, apiKey } = await resolveGeminiConnection();
  return createGeminiClient(baseUrl, apiKey);
}

function stripCodeFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*\n?/i, "");
    t = t.replace(/\n?```\s*$/i, "");
  }
  return t.trim();
}

function linesFromModelText(text: string): string[] {
  const trimmed = stripCodeFences(text);
  if (!trimmed) return [];

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter((l) => l.length > 2);
    }
    if (parsed && typeof parsed === "object") {
      const o = parsed as Record<string, unknown>;
      for (const key of ["songs", "lines", "items"] as const) {
        const arr = o[key];
        if (Array.isArray(arr)) {
          return arr
            .map((x) => (typeof x === "string" ? x.trim() : ""))
            .filter((l) => l.length > 2);
        }
      }
    }
  } catch {
    // fall back to line parsing
  }

  return trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 2 && !l.match(/^[\d.\-*#]+$/) && !l.startsWith("•"),
    );
}

/**
 * POST /api/gemini/playlist/stream — SSE version of the playlist generator.
 * Each suggested song is pushed as a separate Server-Sent Event so the UI
 * can render lines progressively while Gemini is still generating.
 * Event format:  data: {"line":"<song>"}\n\n
 * Terminal event: data: {"done":true}\n\n
 * Error event:    data: {"error":"<msg>"}\n\n
 */
router.post("/playlist/stream", async (req, res) => {
  const { prompt } = req.body as { prompt?: string };

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "Missing prompt" });
    return;
  }

  if (prompt.length > MAX_PROMPT_LEN) {
    res.status(400).json({ error: "Prompt too long" });
    return;
  }

  // Set SSE headers before writing anything
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering on Render

  const sendEvent = (payload: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  let client;
  try {
    client = await getGeminiClientOrThrow();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gemini is not configured";
    sendEvent({ error: msg });
    res.end();
    return;
  }

  const fullPrompt = `אתה מומחה מוזיקה ישראלית ויהודית. המשתמש ביקש פלייליסט: "${prompt}".

הנחיות קפדניות:
- בחר 12–20 שירים בודדים (לא אלבומים, לא פודקאסטים, רק שירים)
- שמות בעברית בלבד, שירים מוכרים במוזיקה הישראלית/יהודית
- החזר אך ורק JSON תקין (ללא markdown, ללא טקסט מסביב) במבנה בדיוק:
  {"songs":["אמן - שם שיר", "אמן - שם שיר", ...]}
- המערך songs מכיל בדיוק 12–20 מחרוזות, כל אחת "אמן - שם שיר"`;

  try {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      config: { maxOutputTokens: 2048 },
    });

    const lines = linesFromModelText(response.text ?? "");

    // Stream each line as a separate SSE event with a small delay so the
    // frontend can render them progressively even though Gemini already
    // returned the full list (true streaming not required by the client).
    for (const line of lines) {
      sendEvent({ line });
      // Yield to the event loop so the client receives the event immediately
      await new Promise((r) => setTimeout(r, 40));
    }

    sendEvent({ done: true });
    res.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    sendEvent({ error: `Gemini error: ${msg}` });
    res.end();
  }
});

router.post("/playlist", async (req, res) => {
  const { prompt } = req.body as { prompt?: string };

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "Missing prompt" });
    return;
  }

  if (prompt.length > MAX_PROMPT_LEN) {
    res.status(400).json({ error: "Prompt too long" });
    return;
  }

  let client;
  try {
    client = await getGeminiClientOrThrow();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Gemini is not configured";
    res.status(503).json({ error: msg });
    return;
  }

  const fullPrompt = `אתה מומחה מוזיקה ישראלית ויהודית. המשתמש ביקש פלייליסט: "${prompt}".

הנחיות קפדניות:
- בחר 12–20 שירים בודדים (לא אלבומים, לא פודקאסטים, רק שירים)
- שמות בעברית בלבד, שירים מוכרים במוזיקה הישראלית/יהודית
- החזר אך ורק JSON תקין (ללא markdown, ללא טקסט מסביב) במבנה בדיוק:
  {"songs":["אמן - שם שיר", "אמן - שם שיר", ...]}
- המערך songs מכיל בדיוק 12–20 מחרוזות, כל אחת "אמן - שם שיר"`;

  try {
    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      config: { maxOutputTokens: 2048 },
    });

    const text = response.text ?? "";
    const lines = linesFromModelText(text);
    res.json({ lines });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: `Gemini error: ${msg}` });
  }
});

export default router;
