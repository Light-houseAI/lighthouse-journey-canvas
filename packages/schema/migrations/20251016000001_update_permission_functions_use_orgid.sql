-- Update permission functions to use orgId from node metadata instead of org_members table

-- Function to check if a user can access a node at a specific level
CREATE OR REPLACE FUNCTION can_access_node(
  p_user_id INTEGER,
  p_node_id UUID,
  p_action permission_action DEFAULT 'view',
  p_level visibility_level DEFAULT 'overview'
) RETURNS BOOLEAN AS $$
DECLARE
  node_owner INTEGER;
  node_org_id INTEGER;
  user_has_org_access BOOLEAN := FALSE;
BEGIN
  -- Get node owner
  SELECT user_id INTO node_owner FROM timeline_nodes WHERE id = p_node_id;

  -- Owner always has full access
  IF node_owner = p_user_id THEN
    RETURN TRUE;
  END IF;

  -- Get orgId from node metadata if it exists
  SELECT (meta->>'orgId')::INTEGER INTO node_org_id
  FROM timeline_nodes
  WHERE id = p_node_id;

  -- Check if user has org-based access by checking if they have any job/education nodes with the same orgId
  IF node_org_id IS NOT NULL AND p_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM timeline_nodes
      WHERE user_id = p_user_id
        AND type IN ('job', 'education')
        AND (meta->>'orgId')::INTEGER = node_org_id
    ) INTO user_has_org_access;
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
        (np.subject_type = 'org' AND user_has_org_access)
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
            (np2.subject_type = 'org' AND user_has_org_access)
          )
          AND (np2.expires_at IS NULL OR np2.expires_at > NOW())
      )
  );
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
  WITH accessible_nodes AS (
    SELECT DISTINCT n.id,
      CASE
        WHEN can_access_node(p_user_id, n.id, p_action, 'full') THEN 'full'::visibility_level
        WHEN can_access_node(p_user_id, n.id, p_action, 'overview') THEN 'overview'::visibility_level
        ELSE NULL
      END as access_level,
      can_access_node(p_user_id, n.id, 'edit', 'full') as can_edit
    FROM timeline_nodes n
    WHERE
      -- Owner access
      n.user_id = p_user_id
      OR can_access_node(p_user_id, n.id, p_action, p_min_level)
  )
  SELECT an.id, an.access_level, an.can_edit
  FROM accessible_nodes an
  WHERE an.access_level IS NOT NULL
    AND (p_min_level = 'overview' OR an.access_level = 'full');
END;
$$ LANGUAGE plpgsql;
