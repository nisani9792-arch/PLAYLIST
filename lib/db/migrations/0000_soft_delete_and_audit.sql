-- Incremental migration: adds soft-delete columns + audit_logs.
-- Prerequisites (existing DB): tables public.conversations and public.messages already exist.

DO $$ BEGIN
  CREATE TYPE "public"."action_type" AS ENUM('CREATE', 'UPDATE', 'DELETE', 'RESTORE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
--> statement-breakpoint

ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "action_type" "action_type" NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "user_id" integer,
  "changes" jsonb,
  "timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk"
    FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
