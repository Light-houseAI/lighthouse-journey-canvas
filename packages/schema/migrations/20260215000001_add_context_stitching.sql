-- Add pre-computed context stitching support
-- stitched_context: Chain-based cumulative 3-tier analysis (workstreams, tool mastery, patterns)
-- user_workstreams: Tracks outcome-based workstreams for incremental Tier 1 matching

-- 1. Add stitched_context JSONB column to session_mappings
ALTER TABLE "session_mappings" ADD COLUMN IF NOT EXISTS "stitched_context" jsonb;

-- 2. Create user_workstreams table
CREATE TABLE IF NOT EXISTS "user_workstreams" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workstream_id" varchar(100) NOT NULL,
  "name" text NOT NULL,
  "outcome_description" text,
  "session_ids" text[] DEFAULT '{}',
  "topics" text[] DEFAULT '{}',
  "tools_used" text[] DEFAULT '{}',
  "confidence" double precision DEFAULT 0,
  "first_activity" timestamp with time zone,
  "last_activity" timestamp with time zone,
  "total_duration_seconds" integer DEFAULT 0,
  "is_active" boolean DEFAULT true,
  "merged_into_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "idx_user_workstreams_user_wsid"
  ON "user_workstreams"("user_id", "workstream_id");

CREATE INDEX IF NOT EXISTS "idx_user_workstreams_user_active"
  ON "user_workstreams"("user_id") WHERE "is_active" = true;

-- Index on session_mappings for fast latest stitched_context lookup
CREATE INDEX IF NOT EXISTS "idx_session_mappings_user_ended_at"
  ON "session_mappings"("user_id", "ended_at" DESC)
  WHERE "stitched_context" IS NOT NULL;
