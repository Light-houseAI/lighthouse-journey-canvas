-- Auth System Database Migration
-- Creates tables for roles, permissions, and audit logging

-- Add permissions and roles tables
CREATE TABLE IF NOT EXISTS user_roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER REFERENCES user_roles(id) ON DELETE CASCADE,
  permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Modify users table to add role support (initially without default to avoid FK constraint issues)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role_id INTEGER,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add audit log table
CREATE TABLE IF NOT EXISTS auth_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  event_type VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  resource VARCHAR(100),
  success BOOLEAN NOT NULL,
  ip_address INET,
  user_agent TEXT,
  reason VARCHAR(255),
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_id ON auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_created_at ON auth_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_event_type ON auth_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_success ON auth_audit_log(success);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

-- Insert default roles
INSERT INTO user_roles (name, description) VALUES 
('user', 'Standard user with basic permissions')
ON CONFLICT (name) DO NOTHING;

-- Insert permissions
INSERT INTO permissions (name, description, resource, action) VALUES
-- Profile permissions
('profile:read:own', 'Read own profile', 'profile', 'read'),
('profile:write:own', 'Write own profile', 'profile', 'write'),

-- Node permissions
('node:create', 'Create nodes', 'node', 'create'),
('node:read:own', 'Read own nodes', 'node', 'read'),
('node:update:own', 'Update own nodes', 'node', 'update'),
('node:delete:own', 'Delete own nodes', 'node', 'delete')
ON CONFLICT (name) DO NOTHING;

-- Set up role permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM user_roles r, permissions p
WHERE r.name = 'user' AND p.name IN (
  'profile:read:own',
  'profile:write:own',
  'node:create',
  'node:read:own',
  'node:update:own',
  'node:delete:own'
)
ON CONFLICT DO NOTHING;

-- Update existing users to have the default 'user' role
UPDATE users 
SET role_id = (SELECT id FROM user_roles WHERE name = 'user')
WHERE role_id IS NULL;

-- Now add the foreign key constraint after data is populated
-- Drop and recreate constraint to handle re-runs safely
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_id_fkey;
ALTER TABLE users 
ADD CONSTRAINT users_role_id_fkey 
FOREIGN KEY (role_id) REFERENCES user_roles(id);

-- Migration completion log
INSERT INTO auth_audit_log (event_type, action, resource, success, reason, details, created_at)
VALUES (
  'AUTH_SYSTEM_MIGRATION',
  'MIGRATION',
  'database',
  true,
  'Auth system migration completed successfully',
  '{"migration": "auth-system-schema.sql", "version": "1.0"}',
  CURRENT_TIMESTAMP
);