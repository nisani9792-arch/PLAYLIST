import { index, jsonb, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";

export const stagingEvents = pgTable(
  "staging_events",
  {
    id: serial("id").primaryKey(),
    operatorName: text("operator_name").notNull(),
    query: text("query").notNull(),
    chosenUid: text("chosen_uid"),
    rejectedUids: jsonb("rejected_uids").$type<string[]>(),
    parasha: text("parasha"),
    confidence: real("confidence"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("staging_events_operator_created_idx").on(t.operatorName, t.createdAt),
  ],
);
