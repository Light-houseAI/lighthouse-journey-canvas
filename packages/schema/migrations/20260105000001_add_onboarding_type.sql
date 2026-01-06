-- Add onboarding_type enum and column to users table
-- This supports distinguishing between LinkedIn-based onboarding (legacy) and desktop app onboarding (new flow)

CREATE TYPE "public"."onboarding_type" AS ENUM('linkedin', 'desktop');--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN "onboarding_type" onboarding_type DEFAULT 'desktop';--> statement-breakpoint

-- Set existing users with completed onboarding to 'linkedin' type (legacy flow)
UPDATE "users" SET "onboarding_type" = 'linkedin' WHERE "has_completed_onboarding" = true;


