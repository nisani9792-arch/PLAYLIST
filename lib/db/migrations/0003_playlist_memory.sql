CREATE TABLE IF NOT EXISTS "playlists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "operator_name" text,
  "source_prompt" text,
  "parasha" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "playlists_updated_at_idx" ON "playlists" ("updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "playlists_deleted_at_idx" ON "playlists" ("deleted_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "playlist_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "playlist_id" uuid NOT NULL REFERENCES "playlists"("id") ON DELETE cascade,
  "position" integer NOT NULL,
  "song" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "playlist_items_playlist_position_idx" ON "playlist_items" ("playlist_id", "position");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "playlist_revisions" (
  "id" serial PRIMARY KEY NOT NULL,
  "playlist_id" uuid NOT NULL REFERENCES "playlists"("id") ON DELETE cascade,
  "state" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "playlist_revisions_playlist_id_id_idx" ON "playlist_revisions" ("playlist_id", "id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staging_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "operator_name" text NOT NULL,
  "query" text NOT NULL,
  "chosen_uid" text,
  "rejected_uids" jsonb,
  "parasha" text,
  "confidence" real,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staging_events_operator_created_idx" ON "staging_events" ("operator_name", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "operator_preferences" (
  "operator_name" text PRIMARY KEY NOT NULL,
  "preferences" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
