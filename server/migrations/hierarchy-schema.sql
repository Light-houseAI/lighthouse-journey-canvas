-- Hierarchical Timeline System Migration
-- Creates the timeline_nodes table and related infrastructure
-- Compatible with existing Lighthouse database schema

-- Create timeline_node_type enum for Lighthouse's 6 node types
DO $$ BEGIN
    CREATE TYPE timeline_node_type AS ENUM (
        'job',
        'education', 
        'project',
        'event',
        'action',
        'careerTransition'
    );
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'Type timeline_node_type already exists, skipping creation';
END $$;

-- Create timeline_nodes table with hierarchy support
CREATE TABLE IF NOT EXISTS timeline_nodes (
    id TEXT PRIMARY KEY,
    type timeline_node_type NOT NULL,
    label TEXT NOT NULL CHECK (length(label) >= 2 AND length(label) <= 255),
    parent_id TEXT REFERENCES timeline_nodes(id) ON DELETE SET NULL,
    meta JSONB NOT NULL DEFAULT '{}',
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Constraint to prevent self-referential relationships
    CONSTRAINT no_self_reference CHECK (id != parent_id)
);

-- Create performance indexes for hierarchy operations
CREATE INDEX IF NOT EXISTS timeline_nodes_user_id_idx ON timeline_nodes(user_id);
CREATE INDEX IF NOT EXISTS timeline_nodes_parent_id_idx ON timeline_nodes(parent_id);
CREATE INDEX IF NOT EXISTS timeline_nodes_type_idx ON timeline_nodes(type);
CREATE INDEX IF NOT EXISTS timeline_nodes_user_parent_idx ON timeline_nodes(user_id, parent_id);
CREATE INDEX IF NOT EXISTS timeline_nodes_user_type_idx ON timeline_nodes(user_id, type);
CREATE INDEX IF NOT EXISTS timeline_nodes_created_at_idx ON timeline_nodes(created_at);

-- Create composite index for common filtering operations
CREATE INDEX IF NOT EXISTS timeline_nodes_user_type_parent_idx ON timeline_nodes(user_id, type, parent_id);

-- Create GIN index for JSONB metadata queries (optional, for future use)
CREATE INDEX IF NOT EXISTS timeline_nodes_meta_gin_idx ON timeline_nodes USING GIN (meta);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timeline_nodes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on row updates
DROP TRIGGER IF EXISTS update_timeline_nodes_updated_at ON timeline_nodes;
CREATE TRIGGER update_timeline_nodes_updated_at
    BEFORE UPDATE ON timeline_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_timeline_nodes_updated_at();

-- Function to get all descendants of a node (recursive)
CREATE OR REPLACE FUNCTION get_node_descendants(node_id TEXT, max_depth INTEGER DEFAULT 10)
RETURNS TABLE(
    id TEXT,
    type timeline_node_type,
    label TEXT,
    parent_id TEXT,
    meta JSONB,
    user_id INTEGER,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    depth INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE descendants AS (
        -- Base case: the node itself
        SELECT 
            n.id, n.type, n.label, n.parent_id, n.meta, n.user_id, 
            n.created_at, n.updated_at, 0 as depth
        FROM timeline_nodes n
        WHERE n.id = node_id
        
        UNION ALL
        
        -- Recursive case: children of descendants
        SELECT 
            n.id, n.type, n.label, n.parent_id, n.meta, n.user_id,
            n.created_at, n.updated_at, d.depth + 1
        FROM timeline_nodes n
        INNER JOIN descendants d ON n.parent_id = d.id
        WHERE d.depth < max_depth
    )
    SELECT * FROM descendants ORDER BY depth, created_at;
END;
$$ LANGUAGE plpgsql;

-- Function to get all ancestors of a node (recursive)
CREATE OR REPLACE FUNCTION get_node_ancestors(node_id TEXT, max_depth INTEGER DEFAULT 10)
RETURNS TABLE(
    id TEXT,
    type timeline_node_type,
    label TEXT,
    parent_id TEXT,
    meta JSONB,
    user_id INTEGER,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    depth INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE ancestors AS (
        -- Base case: the node itself
        SELECT 
            n.id, n.type, n.label, n.parent_id, n.meta, n.user_id,
            n.created_at, n.updated_at, 0 as depth
        FROM timeline_nodes n
        WHERE n.id = node_id
        
        UNION ALL
        
        -- Recursive case: parents of ancestors
        SELECT 
            n.id, n.type, n.label, n.parent_id, n.meta, n.user_id,
            n.created_at, n.updated_at, a.depth + 1
        FROM timeline_nodes n
        INNER JOIN ancestors a ON n.id = a.parent_id
        WHERE a.depth < max_depth
    )
    SELECT * FROM ancestors ORDER BY depth DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to check if moving a node would create a cycle
CREATE OR REPLACE FUNCTION would_create_cycle(node_id TEXT, new_parent_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    ancestor_record RECORD;
BEGIN
    -- If new_parent_id is NULL, no cycle is possible
    IF new_parent_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- If node_id equals new_parent_id, it would create a direct cycle
    IF node_id = new_parent_id THEN
        RETURN TRUE;
    END IF;
    
    -- Check if node_id appears in the ancestor chain of new_parent_id
    FOR ancestor_record IN 
        SELECT id FROM get_node_ancestors(new_parent_id)
    LOOP
        IF ancestor_record.id = node_id THEN
            RETURN TRUE;
        END IF;
    END LOOP;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to get hierarchy statistics for a user
CREATE OR REPLACE FUNCTION get_user_hierarchy_stats(input_user_id INTEGER)
RETURNS JSON AS $$
DECLARE
    total_nodes INTEGER;
    nodes_by_type JSON;
    root_count INTEGER;
    max_depth INTEGER;
    result JSON;
BEGIN
    -- Get total node count
    SELECT COUNT(*) INTO total_nodes
    FROM timeline_nodes 
    WHERE user_id = input_user_id;
    
    -- Get node counts by type
    SELECT json_object_agg(type, count) INTO nodes_by_type
    FROM (
        SELECT type, COUNT(*) as count
        FROM timeline_nodes 
        WHERE user_id = input_user_id
        GROUP BY type
    ) type_counts;
    
    -- Get root node count
    SELECT COUNT(*) INTO root_count
    FROM timeline_nodes
    WHERE user_id = input_user_id AND parent_id IS NULL;
    
    -- Calculate maximum depth (simplified approach)
    WITH RECURSIVE depth_calc AS (
        SELECT id, 0 as depth
        FROM timeline_nodes
        WHERE user_id = input_user_id AND parent_id IS NULL
        
        UNION ALL
        
        SELECT n.id, d.depth + 1
        FROM timeline_nodes n
        INNER JOIN depth_calc d ON n.parent_id = d.id
        WHERE n.user_id = input_user_id
    )
    SELECT COALESCE(MAX(depth), 0) INTO max_depth FROM depth_calc;
    
    -- Build result JSON
    result := json_build_object(
        'totalNodes', total_nodes,
        'nodesByType', COALESCE(nodes_by_type, '{}'::json),
        'rootNodes', root_count,
        'maxDepth', max_depth
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to validate hierarchy rules (business logic in database)
CREATE OR REPLACE FUNCTION validate_parent_child_relationship(parent_type timeline_node_type, child_type timeline_node_type)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN CASE parent_type
        WHEN 'careerTransition' THEN child_type IN ('action', 'event', 'project')
        WHEN 'job' THEN child_type IN ('project', 'event', 'action')
        WHEN 'education' THEN child_type IN ('project', 'event', 'action')
        WHEN 'action' THEN child_type IN ('project')
        WHEN 'event' THEN child_type IN ('project', 'action')
        WHEN 'project' THEN FALSE -- project nodes cannot have children
        ELSE FALSE
    END;
END;
$$ LANGUAGE plpgsql;

-- Constraint trigger to enforce hierarchy rules
CREATE OR REPLACE FUNCTION check_hierarchy_rules()
RETURNS TRIGGER AS $$
DECLARE
    parent_record RECORD;
BEGIN
    -- Skip validation if no parent
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Get parent node details
    SELECT type INTO parent_record
    FROM timeline_nodes
    WHERE id = NEW.parent_id;
    
    -- Check if parent exists
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent node % does not exist', NEW.parent_id;
    END IF;
    
    -- Validate parent-child relationship
    IF NOT validate_parent_child_relationship(parent_record.type, NEW.type) THEN
        RAISE EXCEPTION 'Invalid hierarchy: % cannot be a child of %', NEW.type, parent_record.type;
    END IF;
    
    -- Check for cycle creation (only on INSERT and UPDATE of parent_id)
    IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.parent_id IS DISTINCT FROM NEW.parent_id)) THEN
        IF would_create_cycle(NEW.id, NEW.parent_id) THEN
            RAISE EXCEPTION 'Operation would create a cycle in the hierarchy';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create constraint trigger for hierarchy validation
DROP TRIGGER IF EXISTS hierarchy_rules_trigger ON timeline_nodes;
CREATE CONSTRAINT TRIGGER hierarchy_rules_trigger
    AFTER INSERT OR UPDATE ON timeline_nodes
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION check_hierarchy_rules();

-- Create view for easy querying of nodes with parent information
CREATE OR REPLACE VIEW timeline_nodes_with_parent AS
SELECT 
    n.id,
    n.type,
    n.label,
    n.parent_id,
    n.meta,
    n.user_id,
    n.created_at,
    n.updated_at,
    p.type as parent_type,
    p.label as parent_label
FROM timeline_nodes n
LEFT JOIN timeline_nodes p ON n.parent_id = p.id;

-- Sample data insertion (for testing - remove in production)
-- This creates a sample hierarchy for testing purposes
DO $$
DECLARE
    sample_user_id INTEGER;
    career_transition_id TEXT;
    action_id TEXT;
    project_id TEXT;
BEGIN
    -- Only insert sample data if no timeline_nodes exist
    IF (SELECT COUNT(*) FROM timeline_nodes) = 0 THEN
        -- Get first user ID (assuming at least one user exists)
        SELECT id INTO sample_user_id FROM users LIMIT 1;
        
        IF sample_user_id IS NOT NULL THEN
            -- Generate UUIDs for sample nodes
            career_transition_id := gen_random_uuid()::text;
            action_id := gen_random_uuid()::text;
            project_id := gen_random_uuid()::text;
            
            -- Insert sample career transition (root)
            INSERT INTO timeline_nodes (id, type, label, parent_id, meta, user_id)
            VALUES (
                career_transition_id,
                'careerTransition',
                'Transition to Tech Lead',
                NULL,
                '{"fromRole": "Senior Developer", "toRole": "Tech Lead", "reason": "Career advancement"}',
                sample_user_id
            );
            
            -- Insert sample action (child of career transition)
            INSERT INTO timeline_nodes (id, type, label, parent_id, meta, user_id)
            VALUES (
                action_id,
                'action',
                'Complete Leadership Training',
                career_transition_id,
                '{"category": "skill-development", "status": "completed", "impact": "Improved team management skills"}',
                sample_user_id
            );
            
            -- Insert sample project (child of action)
            INSERT INTO timeline_nodes (id, type, label, parent_id, meta, user_id)
            VALUES (
                project_id,
                'project',
                'Lead Team Restructuring Project',
                action_id,
                '{"description": "Reorganized development team structure", "technologies": ["team-management", "agile"], "projectType": "professional", "status": "completed"}',
                sample_user_id
            );
            
            RAISE NOTICE 'Sample hierarchy created for user %', sample_user_id;
        ELSE
            RAISE NOTICE 'No users found - skipping sample data creation';
        END IF;
    ELSE
        RAISE NOTICE 'Timeline nodes already exist - skipping sample data creation';
    END IF;
END $$;

-- Grant permissions (adjust based on your user/role setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON timeline_nodes TO lighthouse_app;
-- GRANT USAGE ON SEQUENCE timeline_nodes_id_seq TO lighthouse_app;

-- Final verification queries (commented out - uncomment for manual verification)
/*
-- Verify table creation
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'timeline_nodes'
ORDER BY ordinal_position;

-- Verify indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'timeline_nodes';

-- Verify constraints
SELECT 
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'timeline_nodes';

-- Test sample data
SELECT 
    id,
    type,
    label,
    parent_id,
    meta,
    user_id
FROM timeline_nodes
ORDER BY created_at;
*/

-- Migration completion log
DO $$
BEGIN
    RAISE NOTICE 'Hierarchical Timeline System migration completed successfully';
    RAISE NOTICE 'Created: timeline_node_type enum, timeline_nodes table, indexes, functions, triggers, and views';
    RAISE NOTICE 'The system is now ready for use with the Lighthouse Timeline API v2';
END $$;