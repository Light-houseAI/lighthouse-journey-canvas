-- Initialize test database with required extensions and schema
-- This runs automatically when the Docker container starts

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create mastra_ai schema for AI memory features
CREATE SCHEMA IF NOT EXISTS mastra_ai;

-- Create main schema tables (based on shared/schema.ts)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    interest TEXT,
    has_completed_onboarding BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    raw_data JSONB NOT NULL,
    filtered_data JSONB NOT NULL,
    projects JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_skills (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    level TEXT,
    confidence REAL NOT NULL,
    source TEXT NOT NULL,
    context TEXT,
    keywords TEXT DEFAULT '[]',
    first_mentioned TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_mentioned TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    mention_count INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON user_skills(user_id);

-- Create template database for copying
CREATE DATABASE lighthouse_test_template WITH TEMPLATE lighthouse_test;

COMMENT ON DATABASE lighthouse_test IS 'Main test database with fixture data';
COMMENT ON DATABASE lighthouse_test_template IS 'Template database for parallel test isolation';