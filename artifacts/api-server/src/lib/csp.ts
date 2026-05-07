/**
 * Build Content-Security-Policy directive values for the API app.
 * Note: CSP applies to documents served by this origin; server-side fetch() is not limited by CSP.
 * We still widen connect-src/img-src for HTML responses, BFF pages, or a future same-origin SPA.
 */

function tryParseOrigin(raw: string | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/** Comma-or-whitespace-separated extra URL(s) → origins (e.g. CDN API, websocket host). */
function extraConnectSrcFromEnv(): string[] {
  const raw = process.env.CSP_EXTRA_CONNECT_SRC?.trim();
  if (!raw) return [];
  const parts = raw.split(/[, \t]+/).map((p) => p.trim()).filter(Boolean);
  const origins = parts.map((p) => tryParseOrigin(p)).filter((x): x is string => x !== null);
  return [...new Set(origins)];
}

/** Origins the browser may connect to (fetch / EventSource / WebSocket). */
export function buildConnectSrc(): string[] {
  const fromEnv = [
    tryParseOrigin(process.env.MEILISEARCH_URL),
    tryParseOrigin(process.env.AI_INTEGRATIONS_GEMINI_BASE_URL),
    ...extraConnectSrcFromEnv(),
  ].filter((x): x is string => Boolean(x));

  // Google GenAI / Vertex-style endpoints (SDK or future direct browser use)
  const googleAi = [
    "https://generativelanguage.googleapis.com",
    "https://*.googleapis.com",
  ];

  return [...new Set(["'self'", ...fromEnv, ...googleAi])];
}

/** Fonts loaded via @font-face / link (e.g. Google Fonts CSS). */
export function buildFontSrc(): string[] {
  return ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com"];
}

/** Stylesheets (Google Fonts CSS @import/link). */
export function buildStyleSrc(): string[] {
  return ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"];
}
