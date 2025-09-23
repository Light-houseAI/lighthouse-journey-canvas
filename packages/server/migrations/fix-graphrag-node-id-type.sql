-- Migration: Change graphrag_chunks.node_id from VARCHAR to UUID
-- This ensures type consistency with timeline_nodes.id

-- Step 1: Drop the existing index if it exists
DROP INDEX IF EXISTS idx_chunks_node_id;

-- Step 2: Alter the column type using USING clause
-- This handles the conversion from VARCHAR to UUID
-- First, handle any empty strings or invalid values
UPDATE graphrag_chunks
SET node_id = NULL
WHERE node_id = '' OR node_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Now alter the column type
ALTER TABLE graphrag_chunks
ALTER COLUMN node_id
SET DATA TYPE uuid
USING node_id::uuid;

-- Ensure the column is nullable (it should be for user-level chunks)
ALTER TABLE graphrag_chunks
ALTER COLUMN node_id DROP NOT NULL;

-- Step 3: Recreate the index with the new type
CREATE INDEX idx_chunks_node_id ON graphrag_chunks(node_id);

-- Step 4: Add a comment for documentation
COMMENT ON COLUMN graphrag_chunks.node_id IS 'Reference to timeline_nodes.id (UUID)';

-- Note: This migration assumes all existing node_id values are valid UUIDs
-- Run this validation query first to check:
-- SELECT node_id FROM graphrag_chunks
-- WHERE node_id IS NOT NULL
-- AND node_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';