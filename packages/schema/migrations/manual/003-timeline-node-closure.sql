-- Migration: Add timeline node closure table for efficient hierarchy queries
-- This implements the transitive closure pattern recommended for hierarchical permissions
-- Based on: hierarchical_privacy_permissions_design_node.md

-- Create the closure table for efficient ancestor/descendant queries
CREATE TABLE timeline_node_closure (
  ancestor_id UUID NOT NULL REFERENCES timeline_nodes(id) ON DELETE CASCADE,
  descendant_id UUID NOT NULL REFERENCES timeline_nodes(id) ON DELETE CASCADE,
  depth INTEGER NOT NULL CHECK (depth >= 0),
  PRIMARY KEY (ancestor_id, descendant_id)
);

-- Indexes for performance
CREATE INDEX idx_timeline_node_closure_descendant ON timeline_node_closure(descendant_id);
CREATE INDEX idx_timeline_node_closure_ancestor ON timeline_node_closure(ancestor_id);
CREATE INDEX idx_timeline_node_closure_depth ON timeline_node_closure(depth);

-- Function to maintain closure table on node inserts
CREATE OR REPLACE FUNCTION maintain_timeline_node_closure()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Add self-reference (depth 0)
    INSERT INTO timeline_node_closure (ancestor_id, descendant_id, depth)
    VALUES (NEW.id, NEW.id, 0);
    
    -- Add relationships to all ancestors if this node has a parent
    IF NEW.parent_id IS NOT NULL THEN
      INSERT INTO timeline_node_closure (ancestor_id, descendant_id, depth)
      SELECT ancestor_id, NEW.id, depth + 1
      FROM timeline_node_closure
      WHERE descendant_id = NEW.parent_id;
    END IF;
    
    RETURN NEW;
  
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle parent changes
    IF OLD.parent_id IS DISTINCT FROM NEW.parent_id THEN
      -- Remove old ancestor relationships (except self-reference)
      DELETE FROM timeline_node_closure
      WHERE descendant_id = NEW.id AND depth > 0;
      
      -- Add new ancestor relationships if new parent exists
      IF NEW.parent_id IS NOT NULL THEN
        INSERT INTO timeline_node_closure (ancestor_id, descendant_id, depth)
        SELECT ancestor_id, NEW.id, depth + 1
        FROM timeline_node_closure
        WHERE descendant_id = NEW.parent_id;
      END IF;
      
      -- Update all descendants of this node
      WITH RECURSIVE descendants AS (
        SELECT id, parent_id, 0 as level FROM timeline_nodes WHERE id = NEW.id
        UNION ALL
        SELECT n.id, n.parent_id, d.level + 1
        FROM timeline_nodes n
        JOIN descendants d ON n.parent_id = d.id
      )
      UPDATE timeline_node_closure SET depth = NULL WHERE descendant_id IN (
        SELECT id FROM descendants WHERE level > 0
      );
      
      -- Recompute closure for all descendants
      -- This is simplified - in production you'd want more efficient subtree recomputation
      DELETE FROM timeline_node_closure 
      WHERE descendant_id IN (
        SELECT descendant_id FROM timeline_node_closure WHERE ancestor_id = NEW.id AND depth > 0
      ) AND depth > 0;
      
      -- Rebuild closure for subtree
      WITH RECURSIVE subtree_closure AS (
        -- Base case: direct children
        SELECT NEW.id as ancestor_id, id as descendant_id, 1 as depth
        FROM timeline_nodes 
        WHERE parent_id = NEW.id
        
        UNION ALL
        
        -- Recursive case: deeper descendants
        SELECT sc.ancestor_id, n.id, sc.depth + 1
        FROM subtree_closure sc
        JOIN timeline_nodes n ON n.parent_id = sc.descendant_id
      )
      INSERT INTO timeline_node_closure (ancestor_id, descendant_id, depth)
      SELECT ancestor_id, descendant_id, depth FROM subtree_closure
      ON CONFLICT DO NOTHING;
    END IF;
    
    RETURN NEW;
  
  ELSIF TG_OP = 'DELETE' THEN
    -- Closure entries are automatically deleted by CASCADE
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to maintain closure table
CREATE TRIGGER timeline_node_closure_maintain
  AFTER INSERT OR UPDATE OR DELETE ON timeline_nodes
  FOR EACH ROW EXECUTE FUNCTION maintain_timeline_node_closure();

-- Populate closure table for existing nodes
-- This builds the transitive closure for all existing timeline nodes
WITH RECURSIVE node_paths AS (
  -- Base case: all nodes reference themselves at depth 0
  SELECT id as ancestor_id, id as descendant_id, 0 as depth
  FROM timeline_nodes
  
  UNION ALL
  
  -- Recursive case: follow parent relationships
  SELECT np.ancestor_id, tn.id, np.depth + 1
  FROM node_paths np
  JOIN timeline_nodes tn ON tn.parent_id = np.descendant_id
)
INSERT INTO timeline_node_closure (ancestor_id, descendant_id, depth)
SELECT ancestor_id, descendant_id, depth
FROM node_paths
ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;

-- Add helpful comments
COMMENT ON TABLE timeline_node_closure IS 'Transitive closure table for efficient hierarchy queries in timeline nodes';
COMMENT ON COLUMN timeline_node_closure.depth IS 'Distance from ancestor to descendant (0 = self-reference)';