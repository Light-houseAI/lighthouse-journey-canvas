-- Add screenshot_descriptions JSONB column to session_mappings table
-- This column stores granular screenshot-level descriptions from Gemini Vision analysis
-- Used by insight generation to access fine-grained activity context for better recommendations

ALTER TABLE "session_mappings" ADD COLUMN IF NOT EXISTS "screenshot_descriptions" jsonb;

-- Add comment for documentation
COMMENT ON COLUMN "session_mappings"."screenshot_descriptions" IS 'Screenshot-level descriptions from Gemini Vision analysis. Keyed by timestamp, contains description, app, and category fields. Only includes meaningful screenshots.';
