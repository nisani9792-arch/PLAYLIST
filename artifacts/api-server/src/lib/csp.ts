/**
 * Build Content-Security-Policy directive values for the API / SPA origin.
 * These are consumed by the Helmet middleware wired up in app.ts.
 *
 * gstatic.com & translate.googleapis.com are whitelisted so the native Google
 * Translate toolbar that browsers inject does not trigger CSP violations.
 */

const GOOGLE_TRANSLATE = [
  "https://www.gstatic.com",
  "https://translate.googleapis.com",
  "https://translate.google.com",
];

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

/** Comma-or-whitespace-separated extra URL(s) → origins. */
function extraConnectSrcFromEnv(): string[] {
  const raw = process.env.CSP_EXTRA_CONNECT_SRC?.trim();
  if (!raw) return [];
  return [...new Set(
    raw.split(/[, \t]+/).map((p) => p.trim()).filter(Boolean)
       .map((p) => tryParseOrigin(p)).filter((x): x is string => x !== null),
  )];
}

/** Origins the browser may connect to (fetch / EventSource / WebSocket). */
export function buildConnectSrc(): string[] {
  const fromEnv = [
    tryParseOrigin(process.env.MEILISEARCH_URL),
    tryParseOrigin(process.env.AI_INTEGRATIONS_GEMINI_BASE_URL),
    ...extraConnectSrcFromEnv(),
  ].filter((x): x is string => Boolean(x));

  return [...new Set([
    "'self'",
    ...fromEnv,
    "https://generativelanguage.googleapis.com",
    "https://*.googleapis.com",
    ...GOOGLE_TRANSLATE,
  ])];
}

/** Scripts (Vite build uses inline init; Google Translate injects from gstatic). */
export function buildScriptSrc(): string[] {
  return [...new Set([
    "'self'",
    "'unsafe-inline'",     // Vite injects small inline bootstrap scripts
    "https://www.gstatic.com",
    "https://translate.googleapis.com",
  ])];
}

/** Stylesheets — Google Fonts CSS + Google Translate injects styles from gstatic. */
export function buildStyleSrc(): string[] {
  return [...new Set([
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
    "https://www.gstatic.com",
    "https://translate.googleapis.com",
  ])];
}

/** Fonts loaded via @font-face / link (Google Fonts). */
export function buildFontSrc(): string[] {
  return [...new Set([
    "'self'",
    "https://fonts.gstatic.com",
    "https://fonts.googleapis.com",
    "https://www.gstatic.com",
  ])];
}

/** Images: data URIs (favicons), blobs (previews), Google Translate flags. */
export function buildImgSrc(): string[] {
  return [...new Set([
    "'self'",
    "data:",
    "blob:",
    "https://www.gstatic.com",
    "https://translate.googleapis.com",
    "https://translate.google.com",
  ])];
}
