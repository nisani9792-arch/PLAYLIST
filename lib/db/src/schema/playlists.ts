import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/** Full playlist snapshot for undo stack */
export type PlaylistSnapshotState = {
  name: string;
  songs: unknown[];
};

export const playlists = pgTable(
  "playlists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    sourcePrompt: text("source_prompt"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("playlists_updated_at_idx").on(t.updatedAt),
    index("playlists_deleted_at_idx").on(t.deletedAt),
  ],
);

export const playlistItems = pgTable(
  "playlist_items",
  {
    id: serial("id").primaryKey(),
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    song: jsonb("song").notNull(),
  },
  (t) => [index("playlist_items_playlist_position_idx").on(t.playlistId, t.position)],
);

export const playlistRevisions = pgTable(
  "playlist_revisions",
  {
    id: serial("id").primaryKey(),
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    state: jsonb("state").notNull().$type<PlaylistSnapshotState>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("playlist_revisions_playlist_id_id_idx").on(t.playlistId, t.id)],
);
