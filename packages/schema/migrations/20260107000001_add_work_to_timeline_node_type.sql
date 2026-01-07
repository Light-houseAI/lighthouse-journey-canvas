-- Add 'work' to the timeline_node_type enum
-- This supports the Desktop companion which uses 'work' as a track type

ALTER TYPE "public"."timeline_node_type" ADD VALUE IF NOT EXISTS 'work';
