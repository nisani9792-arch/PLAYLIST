import { Router } from "express";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import {
  db,
  conversations,
  messages,
  insertConversationSchema,
  insertMessageSchema,
} from "@workspace/db";
import { createAuditMiddleware } from "../middleware/audit";

const router = Router();

const auditConversation = createAuditMiddleware("conversation");
const auditMessage = createAuditMiddleware("message");

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseId(raw: string | string[] | undefined): number | null {
  const val = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ─── Conversations ───────────────────────────────────────────────────────────

/** GET /api/conversations — list active (non-deleted) conversations */
router.get("/", async (_req, res) => {
  const rows = await db
    .select()
    .from(conversations)
    .where(isNull(conversations.deletedAt))
    .orderBy(conversations.createdAt);
  res.json(rows);
});

/** GET /api/conversations/deleted — list soft-deleted conversations */
router.get("/deleted", async (_req, res) => {
  const rows = await db
    .select()
    .from(conversations)
    .where(isNotNull(conversations.deletedAt))
    .orderBy(conversations.deletedAt);
  res.json(rows);
});

/** GET /api/conversations/:id */
router.get("/:id", async (req, res) => {
  const id = parseId(req.params["id"]);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), isNull(conversations.deletedAt)));
  if (!row) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.json(row);
});

/** POST /api/conversations */
router.post("/", auditConversation, async (req, res) => {
  const parsed = insertConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [created] = await db.insert(conversations).values(parsed.data).returning();
  res.status(201).json(created);
});

/** PUT /api/conversations/:id */
router.put("/:id", auditConversation, async (req, res) => {
  const id = parseId(req.params["id"]);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = insertConversationSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [updated] = await db
    .update(conversations)
    .set(parsed.data)
    .where(and(eq(conversations.id, id), isNull(conversations.deletedAt)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.json(updated);
});

/** DELETE /api/conversations/:id — soft delete */
router.delete("/:id", auditConversation, async (req, res) => {
  const id = parseId(req.params["id"]);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [deleted] = await db
    .update(conversations)
    .set({ deletedAt: new Date() })
    .where(and(eq(conversations.id, id), isNull(conversations.deletedAt)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Conversation not found or already deleted" });
    return;
  }
  res.json({ message: "Conversation soft-deleted", id: deleted.id });
});

/** POST /api/conversations/:id/restore — undo soft delete */
router.post("/:id/restore", auditConversation, async (req, res) => {
  const id = parseId(req.params["id"]);
  if (id === null) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [restored] = await db
    .update(conversations)
    .set({ deletedAt: null })
    .where(and(eq(conversations.id, id), isNotNull(conversations.deletedAt)))
    .returning();
  if (!restored) {
    res.status(404).json({ error: "Conversation not found or is not deleted" });
    return;
  }
  res.json(restored);
});

// ─── Messages (nested) ───────────────────────────────────────────────────────

/** GET /api/conversations/:id/messages */
router.get("/:id/messages", async (req, res) => {
  const conversationId = parseId(req.params["id"]);
  if (conversationId === null) {
    res.status(400).json({ error: "Invalid conversation id" });
    return;
  }
  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), isNull(messages.deletedAt)))
    .orderBy(messages.createdAt);
  res.json(rows);
});

/** POST /api/conversations/:id/messages */
router.post("/:id/messages", auditMessage, async (req, res) => {
  const conversationId = parseId(req.params["id"]);
  if (conversationId === null) {
    res.status(400).json({ error: "Invalid conversation id" });
    return;
  }

  const bodySchema = insertMessageSchema.omit({ conversationId: true });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.issues });
    return;
  }
  const [created] = await db
    .insert(messages)
    .values({ ...parsed.data, conversationId })
    .returning();
  res.status(201).json(created);
});

/** DELETE /api/conversations/:id/messages/:messageId — soft delete */
router.delete("/:id/messages/:messageId", auditMessage, async (req, res) => {
  const messageId = parseId(req.params["messageId"]);
  if (messageId === null) {
    res.status(400).json({ error: "Invalid message id" });
    return;
  }
  const [deleted] = await db
    .update(messages)
    .set({ deletedAt: new Date() })
    .where(and(eq(messages.id, messageId), isNull(messages.deletedAt)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Message not found or already deleted" });
    return;
  }
  res.json({ message: "Message soft-deleted", id: deleted.id });
});

/** POST /api/conversations/:id/messages/:messageId/restore */
router.post("/:id/messages/:messageId/restore", auditMessage, async (req, res) => {
  const messageId = parseId(req.params["messageId"]);
  if (messageId === null) {
    res.status(400).json({ error: "Invalid message id" });
    return;
  }
  const [restored] = await db
    .update(messages)
    .set({ deletedAt: null })
    .where(and(eq(messages.id, messageId), isNotNull(messages.deletedAt)))
    .returning();
  if (!restored) {
    res.status(404).json({ error: "Message not found or is not deleted" });
    return;
  }
  res.json(restored);
});

export default router;
