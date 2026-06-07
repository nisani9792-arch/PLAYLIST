-- Backfill columns that 0003 skips when an older "playlists" table already exists.
ALTER TABLE "playlists" ADD COLUMN IF NOT EXISTS "operator_name" text;--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN IF NOT EXISTS "source_prompt" text;--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN IF NOT EXISTS "parasha" text;--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_conversation_id_idx" ON "messages" ("conversation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_conversation_created_idx" ON "messages" ("conversation_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_deleted_at_idx" ON "messages" ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "playlists_operator_name_idx" ON "playlists" ("operator_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "playlists_operator_updated_idx" ON "playlists" ("operator_name", "updated_at");
