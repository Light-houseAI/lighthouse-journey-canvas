-- Migration: Upgrade vector indexes from IVFFlat to HNSW and add missing indexes
--
-- WHY: HNSW provides better recall at lower latency for ANN search.
--      IVFFlat requires sequential posting-list scan; HNSW uses graph-based
--      logarithmic traversal. Also adds missing indexes on graphrag_chunks
--      and session_mappings which previously had no vector index (full scans).
--
-- SAFE: DROP INDEX only removes the index structure, NOT table data.
--       All rows and embeddings remain intact. New indexes are built from existing data.
--       For production, run with CONCURRENTLY to avoid table locks.

-- 1. Replace IVFFlat with HNSW on workflow_screenshots
--    (was: ivfflat with lists=100, cosine ops)
DROP INDEX IF EXISTS "workflow_screenshots_embedding_idx";

CREATE INDEX IF NOT EXISTS "workflow_screenshots_embedding_hnsw_idx"
ON "workflow_screenshots"
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 128);

-- 2. Add HNSW index on graphrag_chunks (previously had NO vector index)
CREATE INDEX IF NOT EXISTS "graphrag_chunks_embedding_hnsw_idx"
ON "graphrag_chunks"
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 128);

-- 3. Add HNSW index on session_mappings (previously had NO vector index)
CREATE INDEX IF NOT EXISTS "session_mappings_summary_embedding_hnsw_idx"
ON "session_mappings"
USING hnsw (summary_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 128);

-- 4. Add composite B-tree index for pre-filtering before vector scan
CREATE INDEX IF NOT EXISTS "workflow_screenshots_user_workflow_idx"
ON "workflow_screenshots" (user_id, workflow_tag);
