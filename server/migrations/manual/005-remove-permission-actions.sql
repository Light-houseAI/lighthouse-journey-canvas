-- Migration: Remove unused permission actions (edit, share, delete)
-- Only 'view' permission is now supported for cross-user access
-- Edit, Share, and Delete operations are owner-only

-- First, update any existing policies to use 'view' action if they use other actions
UPDATE node_policies 
SET action = 'view'::permission_action 
WHERE action IN ('edit', 'share', 'delete');

-- Note: We cannot directly remove enum values in PostgreSQL without recreating the type
-- This would require dropping and recreating the enum, which could cause issues
-- For now, we'll leave the enum values but only use 'view' in the application
-- In a future migration, if needed, we can clean up the enum type

-- Add a comment to document the simplified permission model
COMMENT ON TYPE permission_action IS 'Permission actions - currently only "view" is used for cross-user access. Edit/Share/Delete are owner-only operations.';