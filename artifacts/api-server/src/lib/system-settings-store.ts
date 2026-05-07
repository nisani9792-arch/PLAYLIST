import { inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import { systemSettings } from "@workspace/db/schema";

export const SETTINGS_KEYS = {
  AI_CUSTOM_INSTRUCTIONS: "ai_custom_instructions",
  ACTIVE_API_URL: "active_api_url",
  GEMINI_BASE_URL: "gemini_base_url",
  GEMINI_API_KEY: "gemini_api_key",
  MEILISEARCH_URL: "meilisearch_url",
  MEILISEARCH_API_KEY: "meilisearch_api_key",
  MEILISEARCH_INDEX: "meilisearch_index",
} as const;

export const PATCHABLE_SETTING_KEYS = new Set<string>(Object.values(SETTINGS_KEYS));

export async function fetchSettingsKeys(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {};
  const rows = await db.select().from(systemSettings).where(inArray(systemSettings.key, keys));
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function fetchAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(systemSettings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function upsertSettings(entries: Record<string, string>): Promise<void> {
  const now = new Date();
  for (const [key, value] of Object.entries(entries)) {
    await db
      .insert(systemSettings)
      .values({ key, value, updatedAt: now })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value, updatedAt: now },
      });
  }
}

export async function getAiCustomInstructions(): Promise<string> {
  const row = await fetchSettingsKeys([SETTINGS_KEYS.AI_CUSTOM_INSTRUCTIONS]);
  return row[SETTINGS_KEYS.AI_CUSTOM_INSTRUCTIONS]?.trim() ?? "";
}

export async function resolveGeminiConnection(): Promise<{ baseUrl: string; apiKey: string }> {
  const o = await fetchSettingsKeys([SETTINGS_KEYS.GEMINI_BASE_URL, SETTINGS_KEYS.GEMINI_API_KEY]);
  const baseUrl = (
    o[SETTINGS_KEYS.GEMINI_BASE_URL]?.trim() ||
    process.env.AI_INTEGRATIONS_GEMINI_BASE_URL ||
    ""
  ).trim();
  const apiKey = (
    o[SETTINGS_KEYS.GEMINI_API_KEY]?.trim() ||
    process.env.AI_INTEGRATIONS_GEMINI_API_KEY ||
    ""
  ).trim();
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Gemini is not configured: set AI_INTEGRATIONS_GEMINI_BASE_URL and AI_INTEGRATIONS_GEMINI_API_KEY, or use admin overrides.",
    );
  }
  return { baseUrl, apiKey };
}
