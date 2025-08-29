-- Fix PostgreSQL functions to use TIMESTAMP (without timezone) instead of TIMESTAMPTZ
-- This aligns with our schema change to store UTC timestamps without timezone

-- Drop existing functions first (PostgreSQL can't change return types)
DROP FUNCTION IF EXISTS get_node_descendants(uuid, integer);
DROP FUNCTION IF EXISTS get_node_ancestors(uuid, integer);

-- Recreate get_node_descendants function
CREATE OR REPLACE FUNCTION get_node_descendants(node_id UUID, max_depth INTEGER DEFAULT 10)
RETURNS TABLE(
    id UUID,
    type timeline_node_type,
    title TEXT,
    parent_id UUID,
    meta JSON,
    user_id INTEGER,
    created_at TIMESTAMP,  -- Changed from TIMESTAMPTZ
    updated_at TIMESTAMP,  -- Changed from TIMESTAMPTZ
    depth INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE descendants AS (
        -- Base case: the node itself
        SELECT 
            n.id, n.type, n.meta->>'title' as title, n.parent_id, n.meta, n.user_id, 
            n.created_at, n.updated_at, 0 as depth
        FROM timeline_nodes n
        WHERE n.id = node_id
        
        UNION ALL
        
        -- Recursive case: children of descendants
        SELECT 
            n.id, n.type, n.meta->>'title' as title, n.parent_id, n.meta, n.user_id,
            n.created_at, n.updated_at, d.depth + 1
        FROM timeline_nodes n
        INNER JOIN descendants d ON n.parent_id = d.id
        WHERE d.depth < max_depth
    )
    SELECT * FROM descendants ORDER BY depth, created_at;
END;
$$ LANGUAGE plpgsql;

-- Recreate get_node_ancestors function
CREATE OR REPLACE FUNCTION get_node_ancestors(node_id UUID, max_depth INTEGER DEFAULT 10)
RETURNS TABLE(
    id UUID,
    type timeline_node_type,
    title TEXT,
    parent_id UUID,
    meta JSON,
    user_id INTEGER,
    created_at TIMESTAMP,  -- Changed from TIMESTAMPTZ
    updated_at TIMESTAMP,  -- Changed from TIMESTAMPTZ
    depth INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE ancestors AS (
        -- Base case: the node itself
        SELECT 
            n.id, n.type, n.meta->>'title' as title, n.parent_id, n.meta, n.user_id,
            n.created_at, n.updated_at, 0 as depth
        FROM timeline_nodes n
        WHERE n.id = node_id
        
        UNION ALL
        
        -- Recursive case: parents of ancestors
        SELECT 
            n.id, n.type, n.meta->>'title' as title, n.parent_id, n.meta, n.user_id,
            n.created_at, n.updated_at, a.depth + 1
        FROM timeline_nodes n
        INNER JOIN ancestors a ON n.id = a.parent_id
        WHERE a.depth < max_depth
    )
    SELECT * FROM ancestors ORDER BY depth DESC;
END;
$$ LANGUAGE plpgsql;