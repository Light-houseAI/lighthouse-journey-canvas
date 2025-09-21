-- Add missing database functions and triggers from manual migrations
-- This migration consolidates essential functions that were missing from the main schema

-- ============================================================================
-- 1. PERMISSION SYSTEM FUNCTIONS
-- ============================================================================

-- Function to check if a user can access a node at a specific level
CREATE OR REPLACE FUNCTION can_access_node(
  p_user_id INTEGER,
  p_node_id UUID,
  p_action permission_action DEFAULT 'view',
  p_level visibility_level DEFAULT 'overview'
) RETURNS BOOLEAN AS $$
DECLARE
  node_owner INTEGER;
  user_org_ids INTEGER[];
BEGIN
  -- Get node owner
  SELECT user_id INTO node_owner FROM timeline_nodes WHERE id = p_node_id;
  
  -- Owner always has full access
  IF node_owner = p_user_id THEN
    RETURN TRUE;
  END IF;
  
  -- Get user's organization memberships
  IF p_user_id IS NOT NULL THEN
    SELECT ARRAY_AGG(org_id) INTO user_org_ids 
    FROM org_members 
    WHERE user_id = p_user_id;
  END IF;
  
  -- Check for explicit ALLOW policies that aren't overridden by DENY
  RETURN EXISTS (
    SELECT 1 FROM node_policies np
    WHERE np.node_id = p_node_id
      AND np.action = p_action
      AND np.level = p_level
      AND np.effect = 'ALLOW'
      AND (
        (np.subject_type = 'public') OR
        (np.subject_type = 'user' AND np.subject_id = p_user_id) OR
        (np.subject_type = 'org' AND np.subject_id = ANY(user_org_ids))
      )
      AND (np.expires_at IS NULL OR np.expires_at > NOW())
      -- Not explicitly denied (DENY overrides ALLOW)
      AND NOT EXISTS (
        SELECT 1 FROM node_policies np2
        WHERE np2.node_id = np.node_id
          AND np2.action = np.action
          AND np2.level = np.level
          AND np2.effect = 'DENY'
          AND (
            (np2.subject_type = 'user' AND np2.subject_id = p_user_id) OR
            (np2.subject_type = 'org' AND np2.subject_id = ANY(user_org_ids))
          )
          AND (np2.expires_at IS NULL OR np2.expires_at > NOW())
      )
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get user's maximum access level for a node
CREATE OR REPLACE FUNCTION get_node_access_level(
  p_user_id INTEGER,
  p_node_id UUID
) RETURNS visibility_level AS $$
BEGIN
  -- Check full access first
  IF can_access_node(p_user_id, p_node_id, 'view', 'full') THEN
    RETURN 'full';
  END IF;
  
  -- Check overview access
  IF can_access_node(p_user_id, p_node_id, 'view', 'overview') THEN
    RETURN 'overview';
  END IF;
  
  -- No access
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to get accessible nodes for a user with their access levels
CREATE OR REPLACE FUNCTION get_accessible_nodes(
  p_user_id INTEGER,
  p_action permission_action DEFAULT 'view',
  p_min_level visibility_level DEFAULT 'overview'
) RETURNS TABLE(
  node_id UUID,
  access_level visibility_level,
  can_edit BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH user_context AS (
    SELECT 
      p_user_id as user_id,
      ARRAY(SELECT org_id FROM org_members WHERE user_id = p_user_id) as org_ids
  ),
  accessible_nodes AS (
    SELECT DISTINCT n.id,
      CASE 
        WHEN can_access_node(uc.user_id, n.id, p_action, 'full') THEN 'full'::visibility_level
        WHEN can_access_node(uc.user_id, n.id, p_action, 'overview') THEN 'overview'::visibility_level
        ELSE NULL
      END as access_level,
      can_access_node(uc.user_id, n.id, 'edit', 'full') as can_edit
    FROM timeline_nodes n
    CROSS JOIN user_context uc
    WHERE 
      -- Owner access
      n.user_id = uc.user_id
      OR can_access_node(uc.user_id, n.id, p_action, p_min_level)
  )
  SELECT an.id, an.access_level, an.can_edit
  FROM accessible_nodes an
  WHERE an.access_level IS NOT NULL
    AND (p_min_level = 'overview' OR an.access_level = 'full');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. TIMELINE NODE HIERARCHY FUNCTIONS
-- ============================================================================

-- REMOVED: Function for automatic updated_at timestamp - handled in business logic instead

-- REMOVED: SQL triggers for updated_at automation - handled in business logic instead

-- Function to get all descendants of a node (recursive)
CREATE OR REPLACE FUNCTION get_node_descendants(node_id UUID, max_depth INTEGER DEFAULT 10)
RETURNS TABLE(
    id UUID,
    type timeline_node_type,
    title TEXT,
    parent_id UUID,
    meta JSON,
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

-- Function to get all ancestors of a node (recursive)
CREATE OR REPLACE FUNCTION get_node_ancestors(node_id UUID, max_depth INTEGER DEFAULT 10)
RETURNS TABLE(
    id UUID,
    type timeline_node_type,
    title TEXT,
    parent_id UUID,
    meta JSON,
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

-- Function to check if moving a node would create a cycle
CREATE OR REPLACE FUNCTION would_create_cycle(node_id UUID, new_parent_id UUID)
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

-- REMOVED: Functions for hierarchy validation - handled in business logic instead

-- REMOVED: SQL constraint trigger for hierarchy validation - handled in business logic instead

-- ============================================================================
-- 3. CLOSURE TABLE MAINTENANCE FUNCTION
-- ============================================================================

-- REMOVED: Function for closure table maintenance - handled in business logic instead

-- REMOVED: SQL trigger for closure table maintenance - handled in business logic instead

-- ============================================================================
-- 4. GENERAL UTILITY FUNCTIONS
-- ============================================================================

-- REMOVED: Function for general updated_at timestamp automation - handled in business logic instead

-- REMOVED: SQL triggers for updated_at automation on organizations and node_insights - handled in business logic instead