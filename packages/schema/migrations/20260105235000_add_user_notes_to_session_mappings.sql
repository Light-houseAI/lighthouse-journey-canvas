-- Add user_notes column to session_mappings table
-- This column stores user-provided context, goals, or details to improve AI summary accuracy
ALTER TABLE "session_mappings" ADD COLUMN IF NOT EXISTS "user_notes" text;
