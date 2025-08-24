-- Resource Sharing Schema
-- Supports both user-specific and shared resources with granular permissions

-- 1. Resource Permissions Table
-- Maps users to specific resources with specific permissions
CREATE TABLE resource_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL, -- 'profile', 'project', 'node', etc.
  resource_id VARCHAR(100) NOT NULL, -- The actual resource ID
  permission_type VARCHAR(50) NOT NULL, -- 'read', 'write', 'delete', 'share'
  granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Who granted this permission
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL, -- Optional expiration
  is_active BOOLEAN DEFAULT true,
  metadata JSONB, -- Additional context (role in project, etc.)
  
  -- Ensure no duplicate permissions
  UNIQUE(user_id, resource_type, resource_id, permission_type)
);

-- 2. Resource Ownership Table
-- Tracks who owns what resources (separate from permissions)
CREATE TABLE resource_ownership (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Ensure single ownership per resource
  UNIQUE(resource_type, resource_id)
);

-- 3. Sharing Invitations Table
-- Track pending invitations to access resources
CREATE TABLE sharing_invitations (
  id SERIAL PRIMARY KEY,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(100) NOT NULL,
  invited_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_user INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permissions VARCHAR(50)[] NOT NULL, -- Array of permissions offered
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'expired'
  invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
  responded_at TIMESTAMP NULL,
  
  UNIQUE(resource_type, resource_id, invited_user)
);

-- Indexes for performance
CREATE INDEX idx_resource_permissions_user_resource ON resource_permissions(user_id, resource_type, resource_id);
CREATE INDEX idx_resource_permissions_resource ON resource_permissions(resource_type, resource_id);
CREATE INDEX idx_resource_ownership_owner ON resource_ownership(owner_id, resource_type);
CREATE INDEX idx_resource_ownership_resource ON resource_ownership(resource_type, resource_id);
CREATE INDEX idx_sharing_invitations_user ON sharing_invitations(invited_user, status);

-- Example data for understanding the schema

-- User 17 owns a project
INSERT INTO resource_ownership (owner_id, resource_type, resource_id) 
VALUES (17, 'project', 'proj_123');

-- User 17 automatically gets all permissions on their own resource
INSERT INTO resource_permissions (user_id, resource_type, resource_id, permission_type, granted_by)
VALUES 
  (17, 'project', 'proj_123', 'read', 17),
  (17, 'project', 'proj_123', 'write', 17),
  (17, 'project', 'proj_123', 'delete', 17),
  (17, 'project', 'proj_123', 'share', 17);

-- User 17 shares read/write access with User 18
INSERT INTO resource_permissions (user_id, resource_type, resource_id, permission_type, granted_by)
VALUES 
  (18, 'project', 'proj_123', 'read', 17),
  (18, 'project', 'proj_123', 'write', 17);

-- User 17 invites User 19 to collaborate (pending invitation)
INSERT INTO sharing_invitations (resource_type, resource_id, invited_by, invited_user, permissions)
VALUES ('project', 'proj_123', 17, 19, ARRAY['read', 'write']);

-- View to get all user permissions (combining ownership + shared)
CREATE VIEW user_resource_access AS
SELECT DISTINCT
  rp.user_id,
  rp.resource_type,
  rp.resource_id,
  rp.permission_type,
  CASE 
    WHEN ro.owner_id IS NOT NULL THEN 'owner'
    ELSE 'shared'
  END as access_type,
  rp.granted_by,
  rp.granted_at
FROM resource_permissions rp
LEFT JOIN resource_ownership ro ON (
  ro.resource_type = rp.resource_type 
  AND ro.resource_id = rp.resource_id 
  AND ro.owner_id = rp.user_id
)
WHERE rp.is_active = true
  AND (rp.expires_at IS NULL OR rp.expires_at > CURRENT_TIMESTAMP);

-- Function to check if user has permission on resource
CREATE OR REPLACE FUNCTION user_has_resource_permission(
  p_user_id INTEGER,
  p_resource_type VARCHAR(50),
  p_resource_id VARCHAR(100),
  p_permission_type VARCHAR(50)
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_resource_access 
    WHERE user_id = p_user_id 
      AND resource_type = p_resource_type 
      AND resource_id = p_resource_id 
      AND permission_type = p_permission_type
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get all resources user has access to
CREATE OR REPLACE FUNCTION get_user_accessible_resources(
  p_user_id INTEGER,
  p_resource_type VARCHAR(50),
  p_permission_type VARCHAR(50) DEFAULT 'read'
) RETURNS TABLE(
  resource_id VARCHAR(100),
  access_type TEXT,
  permissions TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ura.resource_id,
    MAX(ura.access_type) as access_type,
    ARRAY_AGG(DISTINCT ura.permission_type) as permissions
  FROM user_resource_access ura
  WHERE ura.user_id = p_user_id 
    AND ura.resource_type = p_resource_type
    AND ura.permission_type = p_permission_type
  GROUP BY ura.resource_id;
END;
$$ LANGUAGE plpgsql;