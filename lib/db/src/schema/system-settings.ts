import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type SystemSettingInsert = typeof systemSettings.$inferInsert;
