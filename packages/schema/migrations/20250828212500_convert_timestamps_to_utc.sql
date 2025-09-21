-- Convert all timestamp columns from 'timestamp with time zone' to 'timestamp without time zone' (UTC)
-- This ensures consistent UTC storage without timezone information

-- Timeline nodes table
ALTER TABLE "timeline_nodes" 
  ALTER COLUMN "created_at" TYPE timestamp WITHOUT TIME ZONE 
  USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "timeline_nodes" 
  ALTER COLUMN "updated_at" TYPE timestamp WITHOUT TIME ZONE 
  USING "updated_at" AT TIME ZONE 'UTC';

-- Node insights table  
ALTER TABLE "node_insights" 
  ALTER COLUMN "created_at" TYPE timestamp WITHOUT TIME ZONE 
  USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "node_insights" 
  ALTER COLUMN "updated_at" TYPE timestamp WITHOUT TIME ZONE 
  USING "updated_at" AT TIME ZONE 'UTC';

-- Node policies table
ALTER TABLE "node_policies"
  ALTER COLUMN "created_at" TYPE timestamp WITHOUT TIME ZONE 
  USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "node_policies" 
  ALTER COLUMN "expires_at" TYPE timestamp WITHOUT TIME ZONE 
  USING "expires_at" AT TIME ZONE 'UTC';

-- Organizations table
ALTER TABLE "organizations"
  ALTER COLUMN "created_at" TYPE timestamp WITHOUT TIME ZONE 
  USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "organizations" 
  ALTER COLUMN "updated_at" TYPE timestamp WITHOUT TIME ZONE 
  USING "updated_at" AT TIME ZONE 'UTC';

-- Org members table  
ALTER TABLE "org_members"
  ALTER COLUMN "joined_at" TYPE timestamp WITHOUT TIME ZONE 
  USING "joined_at" AT TIME ZONE 'UTC';

-- Users table (already without timezone, but let's ensure consistency)
-- ALTER TABLE "users" 
--   ALTER COLUMN "created_at" TYPE timestamp WITHOUT TIME ZONE 
--   USING "created_at" AT TIME ZONE 'UTC';

-- Update any functions that might reference TIMESTAMPTZ to use TIMESTAMP instead
-- Note: The database functions will still work as NOW() returns current timestamp