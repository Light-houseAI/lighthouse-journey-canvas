-- Add generated_title column to session_mappings table
-- This stores LLM-generated titles derived from highLevelSummary when no user-defined title exists

ALTER TABLE session_mappings ADD COLUMN IF NOT EXISTS generated_title TEXT;

COMMENT ON COLUMN session_mappings.generated_title IS 'LLM-generated title derived from highLevelSummary when no user-defined workflowName exists';
