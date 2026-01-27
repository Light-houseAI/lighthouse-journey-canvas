-- Add persona-related values to the timeline_node_type enum
-- These support the persona system for generating contextual suggestions in the Insight Assistant

-- Add 'learning' type (for learning personas)
ALTER TYPE "public"."timeline_node_type" ADD VALUE IF NOT EXISTS 'learning';

-- Add 'personal_project' type (for personal project personas)
ALTER TYPE "public"."timeline_node_type" ADD VALUE IF NOT EXISTS 'personal_project';

-- Add 'job_search' type (for job search personas)
ALTER TYPE "public"."timeline_node_type" ADD VALUE IF NOT EXISTS 'job_search';
