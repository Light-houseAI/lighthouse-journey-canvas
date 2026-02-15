-- Migration: Add groups and group_items tables
-- Allows users to organize sessions, workflows, and steps into custom groups

-- Create the group item type enum
DO $$ BEGIN
  CREATE TYPE group_item_type AS ENUM ('session', 'workflow', 'step');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create groups table
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id UUID REFERENCES timeline_nodes(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create group_items table
CREATE TABLE IF NOT EXISTS group_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  item_type group_item_type NOT NULL,
  session_mapping_id UUID NOT NULL REFERENCES session_mappings(id) ON DELETE CASCADE,
  workflow_id VARCHAR(100),
  step_id VARCHAR(100),
  metadata JSONB,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_item_per_group UNIQUE (group_id, session_mapping_id, workflow_id, step_id)
);

-- Add indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_groups_user_id ON groups(user_id);
CREATE INDEX IF NOT EXISTS idx_groups_node_id ON groups(node_id);
CREATE INDEX IF NOT EXISTS idx_group_items_group_id ON group_items(group_id);
CREATE INDEX IF NOT EXISTS idx_group_items_session_mapping_id ON group_items(session_mapping_id);
