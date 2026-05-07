import { Router } from "express";
import { ai } from "@workspace/integrations-gemini-ai";

const router = Router();

const MAX_PROMPT_LEN = 4000;

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

  const fullPrompt = `אתה מומחה מוזיקה ישראלית ויהודית. המשתמש ביקש פלייליסט: "${prompt}".

הנחיות קפדניות:
- בחר 12–20 שירים בודדים (לא אלבומים, לא פודקאסטים, רק שירים)
- שמות בעברית בלבד, שירים מוכרים במוזיקה הישראלית/יהודית
- החזר אך ורק JSON תקין (ללא markdown, ללא טקסט מסביב) במבנה בדיוק:
  {"songs":["אמן - שם שיר", "אמן - שם שיר", ...]}
- המערך songs מכיל בדיוק 12–20 מחרוזות, כל אחת "אמן - שם שיר"`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      config: { maxOutputTokens: 2048 },
    });

    const text = response.text ?? "";
    const lines = linesFromModelText(text);
    res.json({ lines });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Gemini error: ${msg}` });
  }
});

export default router;
