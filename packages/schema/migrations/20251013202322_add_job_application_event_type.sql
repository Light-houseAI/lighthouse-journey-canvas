-- Add 'job-application' to the event_type enum
-- First, check if the enum exists and create it if not
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type') THEN
        CREATE TYPE "public"."event_type" AS ENUM('interview', 'networking', 'conference', 'workshop', 'job-application', 'other');
    ELSE
        -- Only add if it doesn't already exist
        IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = 'job-application'
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'event_type')
        ) THEN
            ALTER TYPE "public"."event_type" ADD VALUE 'job-application';
        END IF;
    END IF;
END $$;
