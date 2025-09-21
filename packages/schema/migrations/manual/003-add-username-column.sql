-- Add username column to users table
-- This enables username-based timeline viewing functionality

-- Add user_name column (nullable for backward compatibility)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS user_name TEXT;

-- Add unique constraint to prevent duplicate usernames
ALTER TABLE users 
ADD CONSTRAINT users_user_name_unique UNIQUE (user_name);

-- Create index for efficient username lookups
CREATE INDEX IF NOT EXISTS idx_users_user_name ON users(user_name) WHERE user_name IS NOT NULL;

-- Migration completion log
INSERT INTO auth_audit_log (event_type, action, resource, success, reason, details, created_at)
VALUES (
  'USERNAME_MIGRATION',
  'MIGRATION', 
  'database',
  true,
  'Username column added to users table successfully',
  '{"migration": "003-add-username-column.sql", "version": "1.0"}',
  CURRENT_TIMESTAMP
);