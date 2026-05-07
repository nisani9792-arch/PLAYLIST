import { Router } from "express";
import { ai } from "@workspace/integrations-gemini-ai";

const router = Router();

router.post("/playlist", async (req, res) => {
  const { prompt } = req.body as { prompt?: string };

  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    res.status(400).json({ error: "Missing prompt" });
    return;
  }

  const fullPrompt = `אתה מומחה מוזיקה ישראלית ויהודית. המשתמש ביקש פלייליסט: "${prompt}".

הנחיות קפדניות:
- החזר בדיוק 12–20 שירים בודדים בלבד (לא אלבומים, לא פודקאסטים, לא אמנים)
- כל שורה בפורמט: אמן - שם שיר
- שמות בעברית בלבד
- ללא מספרים, ללא כוכביות, ללא מקפים בתחילת שורה, ללא הסברים
- רק שירים קיימים ומוכרים בשוק המוזיקה הישראלית/יהודית
- החזר אך ורק את הרשימה הגולמית`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
      config: { maxOutputTokens: 2048 },
    });

    const text = response.text ?? "";
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 2 && !l.match(/^[\d\.\-\*\#]+$/) && !l.startsWith("•"));

    res.json({ lines });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Gemini error: ${msg}` });
  }
});

export default router;
