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

export function isMeilisearchConfigured(): boolean {
  const c = getMeilisearchConfig();
  return Boolean(c.baseUrl && c.apiKey);
}

/** Same as {@link getMeilisearchConfig} today; kept async for future DB-backed overrides. */
export async function getMeilisearchConfigResolved(): Promise<MeilisearchRuntimeConfig> {
  return getMeilisearchConfig();
}

export function buildMeilisearchBearerHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

/** Logs a warning when search env is missing; does not exit — /api/search returns 503 until configured. */
export function validateMeilisearchAtStartup(): void {
  if (isMeilisearchConfigured()) return;

  const msg =
    "Meilisearch is not configured. Set MEILISEARCH_URL and MEILISEARCH_API_KEY (optional: MEILISEARCH_INDEX). /api/search will return 503 until configured.";

  logger.warn(msg);
}
