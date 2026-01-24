-- Add platform tables for insight generation multi-agent system
-- These tables store anonymized workflow patterns for peer comparison
-- and track insight generation job status

-- ============================================================================
-- Platform Workflow Patterns Table (Anonymized cross-user data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "platform_workflow_patterns" (
	"id" serial PRIMARY KEY,
	"workflow_hash" varchar(64) NOT NULL,
	"workflow_type" varchar(100) NOT NULL,
	"role_category" varchar(100),
	"step_count" integer NOT NULL,
	"avg_duration_seconds" integer NOT NULL,
	"occurrence_count" integer NOT NULL DEFAULT 1,
	"efficiency_score" numeric(5,2),
	"step_sequence" jsonb NOT NULL,
	"tool_patterns" jsonb,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for platform_workflow_patterns
CREATE INDEX IF NOT EXISTS "platform_workflow_patterns_hash_idx"
	ON "platform_workflow_patterns" ("workflow_hash");
CREATE INDEX IF NOT EXISTS "platform_workflow_patterns_type_idx"
	ON "platform_workflow_patterns" ("workflow_type", "role_category");
CREATE INDEX IF NOT EXISTS "platform_workflow_patterns_efficiency_idx"
	ON "platform_workflow_patterns" ("efficiency_score" DESC NULLS LAST);

-- Vector similarity search index for semantic matching
CREATE INDEX IF NOT EXISTS "platform_workflow_patterns_embedding_idx"
	ON "platform_workflow_patterns"
	USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- Platform Step Patterns Table (Anonymized step-level data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "platform_step_patterns" (
	"id" serial PRIMARY KEY,
	"step_hash" varchar(64) NOT NULL,
	"step_type" varchar(100) NOT NULL,
	"tool_category" varchar(100),
	"avg_duration_seconds" integer NOT NULL,
	"occurrence_count" integer NOT NULL DEFAULT 1,
	"efficiency_indicators" jsonb,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for platform_step_patterns
CREATE INDEX IF NOT EXISTS "platform_step_patterns_hash_idx"
	ON "platform_step_patterns" ("step_hash");
CREATE INDEX IF NOT EXISTS "platform_step_patterns_type_idx"
	ON "platform_step_patterns" ("step_type", "tool_category");

-- Vector similarity search index for step matching
CREATE INDEX IF NOT EXISTS "platform_step_patterns_embedding_idx"
	ON "platform_step_patterns"
	USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- Insight Generation Jobs Table (Async job tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "insight_generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" integer NOT NULL,
	"node_id" uuid,
	"query" text NOT NULL,
	"status" varchar(50) NOT NULL DEFAULT 'pending',
	"progress" integer DEFAULT 0,
	"current_stage" varchar(100),
	"agent_states" jsonb,
	"result" jsonb,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for insight_generation_jobs
CREATE INDEX IF NOT EXISTS "insight_generation_jobs_user_idx"
	ON "insight_generation_jobs" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "insight_generation_jobs_status_idx"
	ON "insight_generation_jobs" ("status", "created_at" DESC);

-- Foreign key constraints
ALTER TABLE "insight_generation_jobs" ADD CONSTRAINT "insight_generation_jobs_user_id_fk"
	FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "insight_generation_jobs" ADD CONSTRAINT "insight_generation_jobs_node_id_fk"
	FOREIGN KEY ("node_id") REFERENCES "public"."timeline_nodes"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- Check constraint for valid job status
ALTER TABLE "insight_generation_jobs" ADD CONSTRAINT "insight_generation_jobs_status_check"
	CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'));

-- Check constraint for valid workflow types
ALTER TABLE "platform_workflow_patterns" ADD CONSTRAINT "platform_workflow_patterns_type_check"
	CHECK (workflow_type IN (
		'research',
		'coding',
		'documentation',
		'debugging',
		'testing',
		'design',
		'planning',
		'learning',
		'communication',
		'analysis',
		'deployment',
		'code_review',
		'market_analysis',
		'writing',
		'meeting',
		'other'
	));

-- Check constraint for valid step types
ALTER TABLE "platform_step_patterns" ADD CONSTRAINT "platform_step_patterns_type_check"
	CHECK (step_type IN (
		'search',
		'read',
		'write',
		'edit',
		'navigate',
		'copy',
		'paste',
		'review',
		'compile',
		'run',
		'debug',
		'commit',
		'deploy',
		'communicate',
		'idle',
		'other'
	));

-- Check constraint for valid role categories
ALTER TABLE "platform_workflow_patterns" ADD CONSTRAINT "platform_workflow_patterns_role_check"
	CHECK (role_category IS NULL OR role_category IN (
		'software_engineer',
		'product_manager',
		'designer',
		'data_scientist',
		'devops',
		'qa_engineer',
		'technical_writer',
		'manager',
		'other'
	));
