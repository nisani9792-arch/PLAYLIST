import { integer, jsonb, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const actionTypeEnum = pgEnum("action_type", [
  "CREATE",
  "UPDATE",
  "DELETE",
  "RESTORE",
]);

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actionType: actionTypeEnum("action_type").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  userId: integer("user_id"),
  changes: jsonb("changes"),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
