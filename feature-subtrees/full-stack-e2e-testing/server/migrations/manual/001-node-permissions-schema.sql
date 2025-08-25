-- Node Permissions System Migration
-- Implements comprehensive permissions system for timeline nodes
-- Based on PRD: Node Privacy & Permissions System

-- ============================================================================
-- 1. CREATE ENUMS
-- ============================================================================

-- Visibility levels for node access
CREATE TYPE visibility_level AS ENUM (
  'overview',  -- Basic information: title, dates, type, org name
  'full'       -- Complete access: all metadata, description, details
);

-- Permission actions
CREATE TYPE permission_action AS ENUM (
  'view',
  'edit'
);

-- Subject types for policies
CREATE TYPE subject_type AS ENUM (
  'user',     -- Individual user access
  'org',      -- Organization-wide access
  'public'    -- Public access (anonymous users)
);

-- Policy effects
CREATE TYPE policy_effect AS ENUM (
  'ALLOW',
  'DENY'
);

-- Organization types
CREATE TYPE organization_type AS ENUM (
  'company',
  'educational_institution',
  'nonprofit',
  'other'
);

-- Organization member roles
CREATE TYPE org_member_role AS ENUM (
  'member',
  'admin',
  'alumni'
);

-- ============================================================================
-- 2. CREATE TABLES
-- ============================================================================

-- Organizations table for normalized organization data
CREATE TABLE organizations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type organization_type NOT NULL DEFAULT 'other',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization members mapping
CREATE TABLE org_members (
  org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role org_member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

-- Node access policies
CREATE TABLE node_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES timeline_nodes(id) ON DELETE CASCADE,
  level visibility_level NOT NULL,
  action permission_action NOT NULL DEFAULT 'view',
  subject_type subject_type NOT NULL,
  subject_id INTEGER, -- NULL for public, user_id or org_id otherwise
  effect policy_effect NOT NULL DEFAULT 'ALLOW',
  granted_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  -- Prevent duplicate policies
  UNIQUE(node_id, level, action, subject_type, subject_id)
);

-- ============================================================================
-- 3. ADD ORGANIZATION REFERENCE TO TIMELINE NODES
-- ============================================================================

-- Organization ID will be stored in meta.orgId for job and education nodes
-- No schema change needed for timeline_nodes table

-- ============================================================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Organizations indexes
CREATE INDEX idx_organizations_name ON organizations(name);
CREATE INDEX idx_organizations_type ON organizations(type);

-- Organization members indexes
CREATE INDEX idx_org_members_user ON org_members(user_id);
CREATE INDEX idx_org_members_org ON org_members(org_id);

-- Timeline nodes org reference
-- Indexes for organization queries will use meta->>orgId
CREATE INDEX idx_timeline_nodes_job_org ON timeline_nodes((meta->>'orgId')) WHERE type = 'job';
CREATE INDEX idx_timeline_nodes_education_org ON timeline_nodes((meta->>'orgId')) WHERE type = 'education';

-- Node policies indexes for fast permission checks
CREATE INDEX idx_node_policies_node ON node_policies(node_id);
CREATE INDEX idx_node_policies_subject ON node_policies(subject_type, subject_id);
CREATE INDEX idx_node_policies_lookup ON node_policies(node_id, action, level, subject_type, subject_id);
CREATE INDEX idx_node_policies_expires ON node_policies(expires_at) WHERE expires_at IS NOT NULL;

-- Composite index for common queries
CREATE INDEX idx_node_policies_access_check 
  ON node_policies(node_id, action, level, subject_type, subject_id) 
  WHERE effect = 'ALLOW';

-- ============================================================================
-- 5. PERMISSION CHECKING FUNCTIONS
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
-- 6. DATA MIGRATION - EXTRACT ORGANIZATIONS FROM EXISTING NODES
-- ============================================================================

-- Extract unique organizations from existing timeline_nodes metadata
INSERT INTO organizations (name, type)
SELECT DISTINCT 
  COALESCE(meta->>'company', meta->>'institution') as name,
  CASE 
    WHEN type = 'job' THEN 'company'::organization_type
    WHEN type = 'education' THEN 'educational_institution'::organization_type
    ELSE 'other'::organization_type
  END as type
FROM timeline_nodes
WHERE (meta ? 'company' OR meta ? 'institution')
  AND COALESCE(meta->>'company', meta->>'institution') IS NOT NULL
  AND COALESCE(meta->>'company', meta->>'institution') != ''
ON CONFLICT DO NOTHING; -- In case of duplicates

-- Update existing nodes to use orgId in meta instead of separate company/institution fields
UPDATE timeline_nodes n
SET meta = jsonb_set(n.meta, '{orgId}', to_jsonb(o.id::text::integer))
FROM organizations o
WHERE (
  (n.meta->>'company' = o.name AND n.type = 'job' AND o.type = 'company') OR
  (n.meta->>'institution' = o.name AND n.type = 'education' AND o.type = 'educational_institution')
);

-- Clean up old company/institution fields from meta
UPDATE timeline_nodes 
SET meta = meta - 'company' - 'institution'
WHERE type IN ('job', 'education') AND meta ? 'orgId';

-- ============================================================================
-- 7. AUDIT AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for organizations
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. VALIDATION AND CONSTRAINTS
-- ============================================================================

-- Constraint: subject_id must be provided for user and org subject types
ALTER TABLE node_policies 
ADD CONSTRAINT check_subject_id_required 
CHECK (
  (subject_type = 'public' AND subject_id IS NULL) OR
  (subject_type IN ('user', 'org') AND subject_id IS NOT NULL)
);

-- Constraint: Validate subject_id references correct table
-- Note: This would require checking both users and organizations tables
-- For now, we'll handle this validation in the application layer

-- ============================================================================
-- 9. PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Partial index for active (non-expired) policies
CREATE INDEX idx_node_policies_active 
  ON node_policies(node_id, subject_type, subject_id, effect) 
  WHERE expires_at IS NULL OR expires_at > NOW();

-- Index for batch permission checking
CREATE INDEX idx_node_policies_batch_check 
  ON node_policies(subject_type, subject_id, effect, level, action) 
  WHERE expires_at IS NULL OR expires_at > NOW();

-- VACUUM ANALYZE for statistics update
VACUUM ANALYZE organizations;
VACUUM ANALYZE org_members;
VACUUM ANALYZE node_policies;
VACUUM ANALYZE timeline_nodes;