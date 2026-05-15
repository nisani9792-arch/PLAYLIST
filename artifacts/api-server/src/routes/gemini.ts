import { Router } from "express";
import {
  fetchSettingsKeys,
  resolveGeminiConnection,
  SETTINGS_KEYS,
} from "../lib/system-settings-store";
import { createGeminiClient } from "../lib/gemini-client-factory";
import { logger } from "../lib/logger";

const router = Router();

const MAX_PROMPT_LEN = 4000;
const PLAYLIST_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"] as const;
const PARASHA_HINTS = [
  "פרשה",
  "פרשת",
  "בראשית",
  "נח",
  "לך לך",
  "וירא",
  "חיי שרה",
  "תולדות",
  "ויצא",
  "וישלח",
  "וישב",
  "מקץ",
  "ויגש",
  "ויחי",
  "שמות",
  "וארא",
  "בא",
  "בשלח",
  "יתרו",
  "משפטים",
  "תרומה",
  "תצוה",
  "כי תשא",
  "ויקהל",
  "פקודי",
  "ויקרא",
  "צו",
  "שמיני",
  "תזריע",
  "מצורע",
  "אחרי מות",
  "קדושים",
  "אמור",
  "בהר",
  "בחוקותי",
  "במדבר",
  "נשא",
  "בהעלותך",
  "שלח",
  "קורח",
  "חקת",
  "בלק",
  "פנחס",
  "מטות",
  "מסעי",
  "דברים",
  "ואתחנן",
  "עקב",
  "ראה",
  "שופטים",
  "כי תצא",
  "כי תבוא",
  "נצבים",
  "וילך",
  "האזינו",
  "וזאת הברכה",
];

async function getGeminiClientOrThrow() {
  const { baseUrl, apiKey } = await resolveGeminiConnection();
  return createGeminiClient(baseUrl, apiKey);
}

function formatGeminiError(err: unknown): { message: string; status?: number; name?: string } {
  if (err instanceof Error) {
    const anyErr = err as Error & { status?: number; name?: string };
    return {
      message: err.message || "Unknown error",
      status: typeof anyErr.status === "number" ? anyErr.status : undefined,
      name: anyErr.name,
    };
  }
  return { message: String(err) };
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

function promptLooksLikeSongList(prompt: string): boolean {
  const lines = prompt
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 3) return false;

  const lineLikeSongs = lines.filter((line) =>
    /[-–—]|אמן|feat\.?|ft\.?/i.test(line),
  ).length;
  return lineLikeSongs >= Math.ceil(lines.length * 0.5);
}

function promptIsParashaRelated(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return PARASHA_HINTS.some((token) => lower.includes(token.toLowerCase()));
}

function buildCuratorPrompt(input: {
  prompt: string;
  customInstructions: string;
  includePshPdf: boolean;
}): string {
  const modeList = promptLooksLikeSongList(input.prompt);

  const listModeInstructions = modeList
    ? `
מצב בקשה: "פלייליסט מתוך רשימה".
- חובה להיצמד לשירים שהמשתמש נתן בלבד.
- מותר רק תיקוני איות קלים אם ברור שזה אותו שיר (למשל יעקב/יעקוב).
- אסור להוסיף שירים חדשים שלא הופיעו ברשימה.`
    : `
מצב בקשה: "פלייליסט עצמאי".
- צור רשימה איכותית ומדויקת לפי הוייב וההקשר.
- שמור גיוון: גם מוכר וגם Tier-2, לא רק הלהיטים הכי שחוקים.`;

  const pshInstructions = input.includePshPdf
    ? `
מצורף קובץ PDF בשם PSH.
- אם הבקשה קשורה לפרשת שבוע: השתמש קודם כל בשירים מתוך הקובץ.
- סמן שירים שנלקחו מהקובץ ע"י הוספת " (PSH)" בסוף המחרוזת.`
    : "";

  return `# System Role: Jusic AI Content Curator (Alpha Master)

תפקיד: עורך תוכן ראשי והיסטוריון מוזיקלי לאפליקציית Jusic (מוזיקה חרדית).
מטרה: תוכן מדויק, כשר למהדרין, מותאם הקשר, ללא הזיות.

## חוקי ברזל
1) גבולות גזרה:
- מאושר: חסידי, מזרחי-חרדי, חזנות, ישיבתי, אינסטרומנטלי.
- אסור: קול אישה, זמרים חילוניים, פופ דתי-לאומי, ותוכן שאינו הולם בן תורה.
2) אמינות:
- עדיף קצר ואמין על פני רשימה ארוכה עם טעות.
- אסור להמציא שירים.
3) אימות:
- לפני החזרה, בצע בדיקה עצמית: שם שיר ושם מבצע סבירים ומוכרים.

${listModeInstructions}
${pshInstructions}

${input.customInstructions ? `## הנחיות מערכת נוספות\n${input.customInstructions}\n` : ""}

## פלט חובה
החזר אך ורק JSON תקין, ללא markdown וללא טקסט מסביב, במבנה:
{"songs":["אמן - שם שיר","אמן - שם שיר", "..."]}

כללים:
- 22 עד 30 שורות (לא פחות מ-22 אלא אם מצב רשימה קיימת).
- כל שורה בפורמט "אמן - שם שיר".
- עברית בלבד ככל האפשר.

בקשת המשתמש:
"${input.prompt}"`;
}

async function buildGeminiContents(prompt: string): Promise<
  Array<{
    role: "user";
    parts: Array<Record<string, unknown>>;
  }>
> {
  const settings = await fetchSettingsKeys([
    SETTINGS_KEYS.AI_CUSTOM_INSTRUCTIONS,
    SETTINGS_KEYS.AI_PSH_PDF_BASE64,
  ]);
  const customInstructions = settings[SETTINGS_KEYS.AI_CUSTOM_INSTRUCTIONS]?.trim() ?? "";
  const pshPdfBase64 = settings[SETTINGS_KEYS.AI_PSH_PDF_BASE64]?.trim() ?? "";
  const usePsh = promptIsParashaRelated(prompt) && pshPdfBase64.length > 0;

  const parts: Array<Record<string, unknown>> = [];
  if (usePsh) {
    parts.push({
      inlineData: {
        mimeType: "application/pdf",
        data: pshPdfBase64,
      },
    });
  }
  parts.push({
    text: buildCuratorPrompt({
      prompt,
      customInstructions,
      includePshPdf: usePsh,
    }),
  });

  return [{ role: "user", parts }];
}

async function generatePlaylistWithFallback(
  client: Awaited<ReturnType<typeof getGeminiClientOrThrow>>,
  prompt: string,
) {
  const contents = await buildGeminiContents(prompt);
  let lastErr: unknown;
  for (const model of PLAYLIST_MODELS) {
    try {
      return await client.models.generateContent({
        model,
        contents,
        config: { maxOutputTokens: 8192 },
      });
    } catch (err) {
      lastErr = err;
      const info = formatGeminiError(err);
      logger.warn(
        { model, err: info },
        "Gemini playlist generation failed, trying fallback model",
      );
    }
  }
  throw lastErr ?? new Error("Gemini failed on all configured models");
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

  try {
    const response = await generatePlaylistWithFallback(client, prompt);

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
    const info = formatGeminiError(err);
    logger.error({ err: info }, "Gemini playlist stream failed");
    sendEvent({ error: `Gemini error: ${info.message}`, status: info.status ?? null });
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

  try {
    const response = await generatePlaylistWithFallback(client, prompt);

    const text = response.text ?? "";
    const lines = linesFromModelText(text);
    res.json({ lines });
  } catch (err) {
    const info = formatGeminiError(err);
    logger.error({ err: info }, "Gemini playlist request failed");
    res.status(502).json({
      error: `Gemini error: ${info.message}`,
      status: info.status ?? null,
    });
  }
});

export default router;
