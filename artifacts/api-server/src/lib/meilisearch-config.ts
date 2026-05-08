import { logger } from "./logger";

export type MeilisearchRuntimeConfig = {
  baseUrl: string;
  apiKey: string;
  index: string;
};

export function getMeilisearchConfig(): MeilisearchRuntimeConfig {
  const baseUrl = (process.env.MEILISEARCH_URL ?? "").trim().replace(/\/$/, "");
  const apiKey = (process.env.MEILISEARCH_API_KEY ?? "").trim();
  const index = (process.env.MEILISEARCH_INDEX ?? "music").trim() || "music";
  return { baseUrl, apiKey, index };
}

/**
 * Returns true when a Meilisearch URL is set.
 * The API key is intentionally optional — some self-hosted instances run
 * without authentication (no master key configured).
 */
export function isMeilisearchConfigured(): boolean {
  const c = getMeilisearchConfig();
  return Boolean(c.baseUrl);
}

/** Same as {@link getMeilisearchConfig} today; kept async for future DB-backed overrides. */
export async function getMeilisearchConfigResolved(): Promise<MeilisearchRuntimeConfig> {
  return getMeilisearchConfig();
}

/**
 * Build fetch headers for a Meilisearch request.
 * Authorization is omitted when apiKey is empty (unauthenticated instance).
 */
export function buildMeilisearchBearerHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  return headers;
}

/** Logs a warning when MEILISEARCH_URL is missing; server starts regardless. */
export function validateMeilisearchAtStartup(): void {
  if (isMeilisearchConfigured()) return;
  logger.warn(
    "Meilisearch is not configured. Set MEILISEARCH_URL (MEILISEARCH_API_KEY is optional). /api/search will return empty results until configured.",
  );
}
