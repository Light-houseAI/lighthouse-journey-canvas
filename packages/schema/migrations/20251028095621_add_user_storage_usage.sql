-- Create user_storage_usage table for tracking file storage quota
CREATE TABLE "user_storage_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"bytes_used" bigint DEFAULT 0 NOT NULL,
	"quota_bytes" bigint DEFAULT 104857600 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_storage_usage_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "user_storage_usage" ADD CONSTRAINT "user_storage_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS "idx_user_storage_usage_user_id" ON "user_storage_usage" ("user_id");