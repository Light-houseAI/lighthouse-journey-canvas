-- Migration: Add refresh_tokens table and remove sessions table
-- Date: 2025-08-30
-- Description: Replace session-based authentication with JWT refresh token storage

-- Create refresh_tokens table for JWT authentication
CREATE TABLE refresh_tokens (
  token_id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMP,
  revoked_at TIMESTAMP,
  ip_address TEXT,
  user_agent TEXT
);

-- Create indexes for performance
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_revoked_at ON refresh_tokens(revoked_at) WHERE revoked_at IS NULL;

-- Drop sessions table if it exists (session-based auth no longer needed)
DROP TABLE IF EXISTS sessions;

-- Add comments for documentation
COMMENT ON TABLE refresh_tokens IS 'JWT refresh tokens for persistent authentication';
COMMENT ON COLUMN refresh_tokens.token_id IS 'Unique identifier from JWT payload';
COMMENT ON COLUMN refresh_tokens.user_id IS 'User who owns this refresh token';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'SHA-256 hash of the actual refresh token';
COMMENT ON COLUMN refresh_tokens.expires_at IS 'When this token expires (typically 30 days)';
COMMENT ON COLUMN refresh_tokens.created_at IS 'When this token was first issued';
COMMENT ON COLUMN refresh_tokens.last_used_at IS 'Last time this token was used for refresh';
COMMENT ON COLUMN refresh_tokens.revoked_at IS 'When this token was revoked (NULL if active)';
COMMENT ON COLUMN refresh_tokens.ip_address IS 'IP address where token was created (for security auditing)';
COMMENT ON COLUMN refresh_tokens.user_agent IS 'User agent where token was created (for security auditing)';
