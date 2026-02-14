-- Migration: Add peer insights preferences
--
-- WHY: Enables cross-user peer learning via opt-in sharing/receiving of
--      anonymized session insights. Creates user_preferences table for
--      toggle state and adds per-session sharing column to session_mappings.
--      Also adds HNSW indexes on the 3 embedding columns that don't have them yet
--      (summary_embedding already has HNSW from 20260208000001 migration).

-- 1. Create user_preferences table for receive/share toggles
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  receive_peer_insights BOOLEAN NOT NULL DEFAULT false,
  share_peer_insights BOOLEAN NOT NULL DEFAULT false,
  share_scope_default VARCHAR(20) NOT NULL DEFAULT 'all',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add per-session sharing column to session_mappings
ALTER TABLE session_mappings
  ADD COLUMN IF NOT EXISTS peer_sharing_enabled BOOLEAN DEFAULT false;

-- 3. Partial index for quick lookup of sharing users
CREATE INDEX IF NOT EXISTS idx_user_preferences_sharing
  ON user_preferences(user_id) WHERE share_peer_insights = true;

-- 4. Composite partial index for peer session search pre-filtering
CREATE INDEX IF NOT EXISTS idx_session_mappings_peer_sharing
  ON session_mappings(user_id, peer_sharing_enabled)
  WHERE peer_sharing_enabled = true AND summary_embedding IS NOT NULL;

-- 5. Add HNSW indexes for the 3 embedding columns that don't have indexes yet
--    (summary_embedding already has HNSW from 20260208000001 migration)
--    These are needed for the multi-vector cosine search in searchPeerSessionsByMultiEmbedding
CREATE INDEX IF NOT EXISTS "session_mappings_hls_embedding_hnsw_idx"
  ON session_mappings
  USING hnsw (high_level_summary_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 128);

CREATE INDEX IF NOT EXISTS "session_mappings_ss_embedding_hnsw_idx"
  ON session_mappings
  USING hnsw (screenshot_descriptions_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 128);

CREATE INDEX IF NOT EXISTS "session_mappings_ga_embedding_hnsw_idx"
  ON session_mappings
  USING hnsw (gap_analysis_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 128);
