import path from "node:path";
import fs from "node:fs";
import express, { type Express, type Request, type Response } from "express";
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

// ── API routes ─────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  if (req.path === "/api/gemini/playlist") {
    // #region agent log
    fetch('http://127.0.0.1:7720/ingest/a3b66527-1e2c-496d-8748-962b4e82cf3c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0e4088'},body:JSON.stringify({sessionId:'0e4088',runId:`api_${Date.now()}`,hypothesisId:'H6',location:'api-server/app.ts:gemini-route',message:'Request reached local api-server /api/gemini/playlist',data:{method:req.method,origin:req.headers.origin??'',host:req.headers.host??''},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }
  next();
});
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

if (fs.existsSync(resolvedStatic)) {
  logger.info({ dir: resolvedStatic }, "Serving static frontend");

  app.use(
    express.static(resolvedStatic, {
      maxAge: "1y",    // hashed assets are immutable
      etag: true,
      // index.html is intentionally NOT served here; the catch-all below does it
      index: false,
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
    res.sendFile(indexHtml);
  });
} else {
  logger.warn(
    { expected: resolvedStatic },
    "Frontend build not found — run `pnpm build` first. Override with STATIC_DIR env var.",
  );
}

export default app;
