-- Migration: Add Mastra AI schema and pgvector extension
-- This is backward compatible and won't affect existing tables

-- Create separate schema for Mastra AI components
CREATE SCHEMA IF NOT EXISTS mastra_ai;

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Grant necessary permissions (adjust as needed for your user)
GRANT USAGE ON SCHEMA mastra_ai TO CURRENT_USER;
GRANT CREATE ON SCHEMA mastra_ai TO CURRENT_USER;

-- Add projects column to existing profiles table if it doesn't exist
-- (This column was already added based on your schema update)
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS projects JSON DEFAULT '[]';

-- Mastra will automatically create its tables in the mastra_ai schema:
-- - mastra_ai.threads (conversation threads)
-- - mastra_ai.messages (individual messages) 
-- - mastra_ai.resources (working memory for users)
-- - mastra_ai.conversations (vector index for semantic search)

-- Your existing tables remain untouched in the public schema:
-- - public.users (unchanged)
-- - public.profiles (enhanced with projects column)
-- - Chat messages stored in Mastra schema for AI conversations
-- - Your existing LinkedIn scraping and profile data unchanged