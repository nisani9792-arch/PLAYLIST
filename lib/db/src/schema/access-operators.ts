import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** One operator profile per client IP (גורם מטפל). */
export const accessOperators = pgTable("access_operators", {
  ip: text("ip").primaryKey(),
  operatorName: text("operator_name").notNull(),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
});

export type AccessOperator = typeof accessOperators.$inferSelect;
