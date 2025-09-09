-- Add pgVector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- GraphRAG Chunks Table
-- Stores chunked content from timeline nodes for vector search
CREATE TABLE IF NOT EXISTS graphrag_chunks (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  node_id VARCHAR(255) NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(1536) NOT NULL, -- OpenAI text-embedding-3-small dimension
  node_type VARCHAR(50) NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  tenant_id VARCHAR(100) DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for performance
  CONSTRAINT graphrag_chunks_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Optimize vector similarity search with HNSW index
CREATE INDEX IF NOT EXISTS graphrag_chunks_embedding_hnsw_idx ON graphrag_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Standard indexes for filtering
CREATE INDEX IF NOT EXISTS graphrag_chunks_user_id_idx ON graphrag_chunks (user_id);
CREATE INDEX IF NOT EXISTS graphrag_chunks_node_id_idx ON graphrag_chunks (node_id);
CREATE INDEX IF NOT EXISTS graphrag_chunks_tenant_id_idx ON graphrag_chunks (tenant_id);
CREATE INDEX IF NOT EXISTS graphrag_chunks_node_type_idx ON graphrag_chunks (node_type);
CREATE INDEX IF NOT EXISTS graphrag_chunks_updated_at_idx ON graphrag_chunks (updated_at DESC);

-- GraphRAG Edges Table  
-- Stores relationships between chunks for graph-aware search
CREATE TABLE IF NOT EXISTS graphrag_edges (
  id BIGSERIAL PRIMARY KEY,
  src_chunk_id BIGINT NOT NULL,
  dst_chunk_id BIGINT NOT NULL,
  rel_type VARCHAR(50) NOT NULL, -- 'parent_child', 'temporal', 'semantic', etc.
  weight FLOAT DEFAULT 1.0,
  directed BOOLEAN DEFAULT true,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT graphrag_edges_src_chunk_fkey FOREIGN KEY (src_chunk_id) REFERENCES graphrag_chunks(id) ON DELETE CASCADE,
  CONSTRAINT graphrag_edges_dst_chunk_fkey FOREIGN KEY (dst_chunk_id) REFERENCES graphrag_chunks(id) ON DELETE CASCADE,
  CONSTRAINT no_self_loops CHECK (src_chunk_id != dst_chunk_id)
);

-- Indexes for efficient graph traversal
CREATE INDEX IF NOT EXISTS graphrag_edges_src_chunk_idx ON graphrag_edges (src_chunk_id);
CREATE INDEX IF NOT EXISTS graphrag_edges_dst_chunk_idx ON graphrag_edges (dst_chunk_id);
CREATE INDEX IF NOT EXISTS graphrag_edges_rel_type_idx ON graphrag_edges (rel_type);
CREATE INDEX IF NOT EXISTS graphrag_edges_weight_idx ON graphrag_edges (weight DESC);

-- Unique constraint to prevent duplicate edges
CREATE UNIQUE INDEX IF NOT EXISTS graphrag_edges_unique_directed 
ON graphrag_edges (src_chunk_id, dst_chunk_id, rel_type) 
WHERE directed = true;

-- For undirected edges, ensure only one direction is stored
CREATE UNIQUE INDEX IF NOT EXISTS graphrag_edges_unique_undirected 
ON graphrag_edges (LEAST(src_chunk_id, dst_chunk_id), GREATEST(src_chunk_id, dst_chunk_id), rel_type) 
WHERE directed = false;