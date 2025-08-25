-- Node Insights System Migration
-- This migration adds the node_insights table for storing user insights on timeline nodes

-- Create insights table
CREATE TABLE IF NOT EXISTS node_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES timeline_nodes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  resources JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_node_insights_node_id ON node_insights(node_id);
CREATE INDEX IF NOT EXISTS idx_node_insights_created_at ON node_insights(created_at DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER IF NOT EXISTS update_node_insights_updated_at 
    BEFORE UPDATE ON node_insights 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE node_insights IS 'Stores user insights and learnings for timeline nodes';
COMMENT ON COLUMN node_insights.node_id IS 'References the timeline node this insight belongs to';
COMMENT ON COLUMN node_insights.description IS 'The main insight text content (max 2000 chars)';
COMMENT ON COLUMN node_insights.resources IS 'Array of URLs, book references, notes, etc. as JSON array of strings';
COMMENT ON COLUMN node_insights.created_at IS 'When the insight was created';
COMMENT ON COLUMN node_insights.updated_at IS 'When the insight was last modified';