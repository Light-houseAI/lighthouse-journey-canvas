-- Check current session mappings
SELECT 
  sm.id,
  sm.session_id,
  sm.node_id,
  sm.workflow_name,
  sm.category,
  hn.type as node_type,
  hn.meta->>'title' as node_title
FROM session_mapping sm
JOIN hierarchy_nodes hn ON sm.node_id = hn.id
ORDER BY sm.created_at DESC
LIMIT 20;
