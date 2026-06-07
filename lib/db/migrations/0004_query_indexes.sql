CREATE INDEX IF NOT EXISTS "messages_conversation_id_idx" ON "messages" ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_conversation_created_idx" ON "messages" ("conversation_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_deleted_at_idx" ON "messages" ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "playlists_operator_name_idx" ON "playlists" ("operator_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "playlists_operator_updated_idx" ON "playlists" ("operator_name", "updated_at");
