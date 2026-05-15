CREATE TABLE IF NOT EXISTS "access_operators" (
  "ip" text PRIMARY KEY NOT NULL,
  "operator_name" text NOT NULL,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "operator_name" text;
