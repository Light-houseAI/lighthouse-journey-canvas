-- Add summary JSONB column to session_mappings table
-- This column stores the full AI-generated summary including chapters (V1) or workflows (V2) with semantic_steps
-- Used by insight generation to extract start/end activities and detailed workflow data
ALTER TABLE "session_mappings" ADD COLUMN IF NOT EXISTS "summary" jsonb;

-- Add comment for documentation
COMMENT ON COLUMN "session_mappings"."summary" IS 'Full AI-generated summary from Desktop-companion including schema_version, highLevelSummary, chapters (V1), or workflows (V2) with semantic_steps';
