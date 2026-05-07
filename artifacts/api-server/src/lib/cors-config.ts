import type { CorsOptions } from "cors";
import { logger } from "./logger";

/**
 * CORS_ORIGINS: comma-separated allowlist, e.g. "https://app.example.com,https://www.example.com"
 * If unset, reflects the request origin (any origin can call the API — fine for local dev only).
 */
export function getCorsOptions(): CorsOptions {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) {
    return { origin: true };
  }

  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!list.length) {
    return { origin: true };
  }

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (list.includes(origin)) {
        callback(null, true);
        return;
      }
      logger.warn({ origin }, "CORS request blocked");
      callback(null, false);
    },
  };
}
