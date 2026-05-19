import { desc, eq } from "drizzle-orm";
import {
  db,
  operatorPreferences,
  playlistItems,
  playlistRevisions,
  playlists,
  stagingEvents,
  type OperatorPreferencesJson,
} from "@workspace/db";
import { logger } from "./logger";

const memoryPlaylists = new Map<
  string,
  Array<{
    id: string;
    name: string;
    operatorName: string;
    songs: unknown[];
    sourcePrompt?: string;
    parasha?: string;
    createdAt: Date;
  }>
>();

function memKey(operatorName: string): string {
  return operatorName.trim().toLowerCase();
}

export async function savePlaylistSnapshot(input: {
  operatorName: string;
  name: string;
  songs: unknown[];
  sourcePrompt?: string;
  parasha?: string;
}): Promise<string | null> {
  const operatorName = input.operatorName.trim();
  if (!operatorName) return null;

  try {
    const [row] = await db
      .insert(playlists)
      .values({
        name: input.name,
        operatorName,
        sourcePrompt: input.sourcePrompt ?? null,
        parasha: input.parasha ?? null,
      })
      .returning({ id: playlists.id });

    const playlistId = row?.id;
    if (!playlistId) return null;

    await db.insert(playlistItems).values(
      input.songs.map((song, index) => ({
        playlistId,
        position: index,
        song,
      })),
    );

    await db.insert(playlistRevisions).values({
      playlistId,
      state: { name: input.name, songs: input.songs },
    });

    return playlistId;
  } catch (err) {
    logger.warn({ err }, "playlist save failed — memory fallback");
    const id = crypto.randomUUID();
    const list = memoryPlaylists.get(memKey(operatorName)) ?? [];
    list.unshift({
      id,
      name: input.name,
      operatorName,
      songs: input.songs,
      sourcePrompt: input.sourcePrompt,
      parasha: input.parasha,
      createdAt: new Date(),
    });
    memoryPlaylists.set(memKey(operatorName), list.slice(0, 40));
    return id;
  }
}

export async function listRecentPlaylists(operatorName: string, limit = 10) {
  const name = operatorName.trim();
  try {
    const rows = await db
      .select({
        id: playlists.id,
        name: playlists.name,
        sourcePrompt: playlists.sourcePrompt,
        parasha: playlists.parasha,
        createdAt: playlists.createdAt,
      })
      .from(playlists)
      .where(eq(playlists.operatorName, name))
      .orderBy(desc(playlists.updatedAt))
      .limit(limit);
    return rows;
  } catch {
    return (memoryPlaylists.get(memKey(name)) ?? []).slice(0, limit).map((p) => ({
      id: p.id,
      name: p.name,
      sourcePrompt: p.sourcePrompt ?? null,
      parasha: p.parasha ?? null,
      createdAt: p.createdAt,
    }));
  }
}

export async function recordStagingEvents(
  operatorName: string,
  events: Array<{
    query: string;
    chosenUid?: string;
    rejectedUids?: string[];
    parasha?: string;
    confidence?: number;
  }>,
): Promise<void> {
  if (!events.length) return;
  const name = operatorName.trim();
  try {
    await db.insert(stagingEvents).values(
      events.map((e) => ({
        operatorName: name,
        query: e.query,
        chosenUid: e.chosenUid ?? null,
        rejectedUids: e.rejectedUids ?? [],
        parasha: e.parasha ?? null,
        confidence: e.confidence ?? null,
      })),
    );
  } catch (err) {
    logger.warn({ err }, "staging_events insert failed");
  }
}

export async function getOperatorPreferences(
  operatorName: string,
): Promise<OperatorPreferencesJson> {
  try {
    const [row] = await db
      .select({ preferences: operatorPreferences.preferences })
      .from(operatorPreferences)
      .where(eq(operatorPreferences.operatorName, operatorName.trim()))
      .limit(1);
    return row?.preferences ?? {};
  } catch {
    return {};
  }
}

export async function setOperatorPreferences(
  operatorName: string,
  preferences: OperatorPreferencesJson,
): Promise<void> {
  const name = operatorName.trim();
  try {
    await db
      .insert(operatorPreferences)
      .values({ operatorName: name, preferences, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: operatorPreferences.operatorName,
        set: { preferences, updatedAt: new Date() },
      });
  } catch (err) {
    logger.warn({ err }, "operator_preferences upsert failed");
  }
}
