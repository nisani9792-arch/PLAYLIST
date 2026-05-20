import path from "node:path";
import fs from "node:fs";
import express, { type Express, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { getCorsOptions } from "./lib/cors-config";
import {
  buildConnectSrc,
  buildFontSrc,
  buildImgSrc,
  buildScriptSrc,
  buildStyleSrc,
} from "./lib/csp";

const app: Express = express();

if (process.env.TRUST_PROXY === "1" || process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// ── Security headers (CSP + sensible defaults via Helmet) ──────────────────
// useDefaults: false gives us FULL control — no hidden Helmet directives that
// could conflict with our explicit allowlist.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        "default-src":        ["'self'"],
        "script-src":         buildScriptSrc(),
        // script-src-elem must be set explicitly; otherwise browsers fall back
        // to default-src, which would block Google Translate injection scripts.
        "script-src-elem":    buildScriptSrc(),
        "style-src":          buildStyleSrc(),
        // style-src-elem explicit so browsers do NOT fall back to default-src.
        "style-src-elem":     buildStyleSrc(),
        "font-src":           buildFontSrc(),
        "img-src":            buildImgSrc(),
        "connect-src":        buildConnectSrc(),
        "worker-src":         ["'self'", "blob:"],
        "object-src":         ["'none'"],
        "base-uri":           ["'self'"],
        "form-action":        ["'self'"],
        "frame-ancestors":    ["'self'"],
        "upgrade-insecure-requests": [],
      },
    },
    // Render terminates TLS; let them manage HSTS.
    strictTransportSecurity: false,
  }),
);

// ── Request logging ────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(cors(getCorsOptions()));
app.use(express.json({ limit: "512kb" }));
app.use(express.urlencoded({ extended: true, limit: "512kb" }));
app.use(cookieParser());

// ── API routes ─────────────────────────────────────────────────────────────
app.use("/api", router);

// ── Static frontend (Vite build output) ───────────────────────────────────
// On Render (and locally after `pnpm build`):
//   api-server dist  → <repo>/artifacts/api-server/dist/          (__dirname)
//   jusic dist       → <repo>/artifacts/jusic/dist/public/
//
// STATIC_DIR env var can override the resolved path (useful in Docker or
// when the front-end is deployed separately).
const resolvedStatic =
  process.env.STATIC_DIR?.trim() ||
  path.resolve(__dirname, "../../jusic/dist/public");

/** PWA / shell files must not be cached for 1y — stale manifest kept "JUSIC" on install. */
const PWA_SHELL_FILES = new Set([
  "index.html",
  "manifest.json",
  "sw.js",
  "logo.png",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "favicon-32.png",
  "opengraph.jpg",
]);

function setPwaCacheHeaders(res: Response, filePath: string): void {
  const base = path.basename(filePath);
  if (PWA_SHELL_FILES.has(base)) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
}

if (fs.existsSync(resolvedStatic)) {
  logger.info({ dir: resolvedStatic }, "Serving static frontend");

  app.use(
    express.static(resolvedStatic, {
      maxAge: "1y",
      etag: true,
      index: false,
      setHeaders(res, filePath) {
        setPwaCacheHeaders(res, filePath);
      },
    }),
  );

  // SPA catch-all: every non-API, non-file GET/HEAD request returns index.html
  // so Wouter client-side routing works correctly on hard refresh.
  //
  // We use a regex instead of "/*splat" because Express 5 + path-to-regexp v8
  // does NOT match the bare root "/" with the named wildcard "/*splat", which
  // causes HEAD / (Render health-check) to return 404.
  const indexHtml = path.join(resolvedStatic, "index.html");
  app.get(/(.*)/, (_req: Request, res: Response) => {
    setPwaCacheHeaders(res, "index.html");
    res.sendFile(indexHtml);
  });
} else {
  logger.warn(
    { expected: resolvedStatic },
    "Frontend build not found — run `pnpm build` first. Override with STATIC_DIR env var.",
  );
}

export default app;
