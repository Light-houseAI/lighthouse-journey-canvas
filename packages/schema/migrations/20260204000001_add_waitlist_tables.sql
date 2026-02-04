-- Migration: Add waitlist and invite_codes tables
-- Description: Creates tables for waitlist signup and invite code management

-- Create waitlist status enum
DO $$ BEGIN
    CREATE TYPE waitlist_status AS ENUM ('pending', 'invited', 'registered');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create waitlist table
CREATE TABLE IF NOT EXISTS waitlist (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    job_role VARCHAR(100),
    status waitlist_status NOT NULL DEFAULT 'pending',
    invited_at TIMESTAMPTZ,
    registered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create invite_codes table
CREATE TABLE IF NOT EXISTS invite_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(32) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    waitlist_id INTEGER REFERENCES waitlist(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_email ON invite_codes(email);
CREATE INDEX IF NOT EXISTS idx_invite_codes_waitlist_id ON invite_codes(waitlist_id);

-- Add comment for documentation
COMMENT ON TABLE waitlist IS 'Stores users who have signed up for early access via the landing page';
COMMENT ON TABLE invite_codes IS 'Stores unique invite codes sent to waitlist users for registration';
