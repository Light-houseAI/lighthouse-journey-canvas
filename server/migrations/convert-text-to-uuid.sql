-- Migration Script: Convert TEXT IDs to UUIDs
-- This migration converts existing TEXT-based IDs to proper UUIDs
-- Run this BEFORE applying the schema changes that modify column types

-- First, let's check if we have any existing data
DO $$
DECLARE
    node_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO node_count FROM timeline_nodes;
    RAISE NOTICE 'Found % existing timeline nodes to migrate', node_count;
END $$;

-- Step 1: Add temporary UUID columns
ALTER TABLE timeline_nodes ADD COLUMN IF NOT EXISTS new_id UUID DEFAULT gen_random_uuid();
ALTER TABLE timeline_nodes ADD COLUMN IF NOT EXISTS new_parent_id UUID;

-- Step 2: Create a mapping table to track TEXT ID -> UUID conversions
CREATE TEMPORARY TABLE id_mappings AS
SELECT 
    id as old_id, 
    new_id as uuid_id 
FROM timeline_nodes;

-- Step 3: Update the new_parent_id column using the mapping
UPDATE timeline_nodes 
SET new_parent_id = (
    SELECT uuid_id 
    FROM id_mappings 
    WHERE old_id = timeline_nodes.parent_id
)
WHERE parent_id IS NOT NULL;

-- Step 4: Verify the mapping worked
DO $$
DECLARE
    total_nodes INTEGER;
    mapped_parents INTEGER;
    null_parents INTEGER;
    orphaned_refs INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_nodes FROM timeline_nodes;
    SELECT COUNT(*) INTO mapped_parents FROM timeline_nodes WHERE parent_id IS NOT NULL AND new_parent_id IS NOT NULL;
    SELECT COUNT(*) INTO null_parents FROM timeline_nodes WHERE parent_id IS NULL;
    SELECT COUNT(*) INTO orphaned_refs FROM timeline_nodes WHERE parent_id IS NOT NULL AND new_parent_id IS NULL;
    
    RAISE NOTICE 'Migration verification:';
    RAISE NOTICE '  Total nodes: %', total_nodes;
    RAISE NOTICE '  Successfully mapped parent references: %', mapped_parents;
    RAISE NOTICE '  Root nodes (no parent): %', null_parents;
    RAISE NOTICE '  Orphaned references (failed mapping): %', orphaned_refs;
    
    IF orphaned_refs > 0 THEN
        RAISE WARNING 'Found % orphaned parent references - these need manual intervention', orphaned_refs;
    END IF;
END $$;

-- Step 5: Drop the old constraints and indexes that reference the old columns
-- Note: We'll recreate these after the column swap

-- Drop foreign key constraint
ALTER TABLE timeline_nodes DROP CONSTRAINT IF EXISTS timeline_nodes_parent_id_fkey;

-- Drop check constraint
ALTER TABLE timeline_nodes DROP CONSTRAINT IF EXISTS no_self_reference;

-- Drop indexes on old columns
DROP INDEX IF EXISTS timeline_nodes_parent_id_idx;

-- Step 6: Drop old columns and rename new ones
ALTER TABLE timeline_nodes DROP COLUMN id;
ALTER TABLE timeline_nodes DROP COLUMN parent_id;

ALTER TABLE timeline_nodes RENAME COLUMN new_id TO id;
ALTER TABLE timeline_nodes RENAME COLUMN new_parent_id TO parent_id;

-- Step 7: Set the new id column as primary key
ALTER TABLE timeline_nodes ADD PRIMARY KEY (id);

-- Step 8: Add back the foreign key constraint
ALTER TABLE timeline_nodes ADD CONSTRAINT timeline_nodes_parent_id_fkey 
    FOREIGN KEY (parent_id) REFERENCES timeline_nodes(id) ON DELETE SET NULL;

-- Step 9: Add back the self-reference check constraint
ALTER TABLE timeline_nodes ADD CONSTRAINT no_self_reference 
    CHECK (id != parent_id);

-- Step 10: Recreate indexes
CREATE INDEX timeline_nodes_parent_id_idx ON timeline_nodes(parent_id);
CREATE INDEX timeline_nodes_user_parent_idx ON timeline_nodes(user_id, parent_id);

-- Step 11: Show sample of converted data
SELECT 
    id,
    type,
    meta->>'title' as title,
    parent_id,
    user_id,
    created_at
FROM timeline_nodes 
ORDER BY created_at 
LIMIT 5;

-- Migration completion message
DO $$
BEGIN
    RAISE NOTICE 'ID conversion to UUID completed successfully';
    RAISE NOTICE 'All timeline_nodes now use UUID primary keys';
    RAISE NOTICE 'You can now safely apply the updated schema definitions';
END $$;