-- Migration: Add additional permission actions to support enhanced permissions
-- This extends the permission_action enum to include edit, share, and delete actions

-- Add new values to the permission_action enum
ALTER TYPE permission_action ADD VALUE IF NOT EXISTS 'edit';
ALTER TYPE permission_action ADD VALUE IF NOT EXISTS 'share';
ALTER TYPE permission_action ADD VALUE IF NOT EXISTS 'delete';

-- Note: PostgreSQL enum additions are automatically available to existing tables
-- The node_policies table will now accept these new action values