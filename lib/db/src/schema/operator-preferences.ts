import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export type OperatorPreferencesJson = {
  exportStrict?: boolean;
  defaultPlaylistNamePattern?: string;
  geminiStyleNotes?: string;
  preferredGenres?: string[];
};

export const operatorPreferences = pgTable("operator_preferences", {
  operatorName: text("operator_name").primaryKey(),
  preferences: jsonb("preferences").notNull().$type<OperatorPreferencesJson>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
