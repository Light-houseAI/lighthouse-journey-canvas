-- Migration Script: Move label data to meta.title
-- This is a one-time script to migrate existing label data into the meta column
-- Run this BEFORE applying the schema changes that remove the label column

-- Step 1: Update all existing timeline_nodes to move label into meta.title
-- This preserves existing meta data while adding the title field
UPDATE timeline_nodes 
SET meta = (
    jsonb_set(
        COALESCE(meta::jsonb, '{}'::jsonb),
        '{title}',
        to_jsonb(label)
    )
)::json
WHERE label IS NOT NULL AND label != '';

-- Step 2: Verify the migration worked
-- Check that all nodes now have meta.title
DO $$
DECLARE
    total_nodes INTEGER;
    nodes_with_title INTEGER;
    nodes_without_title INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_nodes FROM timeline_nodes;
    SELECT COUNT(*) INTO nodes_with_title FROM timeline_nodes WHERE meta->>'title' IS NOT NULL;
    SELECT COUNT(*) INTO nodes_without_title FROM timeline_nodes WHERE meta->>'title' IS NULL;
    
    RAISE NOTICE 'Migration verification:';
    RAISE NOTICE '  Total nodes: %', total_nodes;
    RAISE NOTICE '  Nodes with meta.title: %', nodes_with_title;
    RAISE NOTICE '  Nodes without meta.title: %', nodes_without_title;
    
    IF nodes_without_title > 0 THEN
        RAISE WARNING 'Found % nodes without meta.title - these may need manual intervention', nodes_without_title;
    ELSE
        RAISE NOTICE 'All nodes successfully migrated to meta.title';
    END IF;
END $$;

-- Step 3: Show sample data to verify
-- Display first 5 nodes to verify migration
SELECT 
    id,
    type,
    label as old_label,
    meta->>'title' as new_title,
    meta
FROM timeline_nodes 
ORDER BY created_at 
LIMIT 5;

-- Migration completion message
DO $$
BEGIN
    RAISE NOTICE 'Label to meta.title migration completed';
    RAISE NOTICE 'You can now safely run the schema update to remove the label column';
END $$;