import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const artists = pgTable(
  "artists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    hebrewName: text("hebrew_name"),
    email: text("email"),
    phone: text("phone"),
    /** e.g. ["מזרחית", "פופ", "אלקטרוני"] */
    genres: text("genres").array(),
    /** LOW | MEDIUM | HIGH | VERY_HIGH */
    energyLevel: text("energy_level"),
    /** AI-derived style metadata from Talent Scout */
    style: jsonb("style").$type<Record<string, unknown>>(),
    spotifyId: text("spotify_id").unique(),
    imageUrl: text("image_url"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("artists_name_idx").on(t.name),
    index("artists_deleted_at_idx").on(t.deletedAt),
  ],
);

export type Artist = typeof artists.$inferSelect;
export type InsertArtist = typeof artists.$inferInsert;
