-- Add workflow screenshots table for storing analyzed session screenshots with vector embeddings
-- This table enables hybrid search (BM25 + similarity) for workflow analysis

CREATE TABLE IF NOT EXISTS "workflow_screenshots" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "workflow_screenshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"node_id" varchar(255) NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"screenshot_path" text NOT NULL,
	"cloud_url" text,
	"timestamp" timestamp with time zone NOT NULL,
	"workflow_tag" varchar(100) NOT NULL,
	"summary" text,
	"analysis" text,
	"embedding" vector(1536),
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS "workflow_screenshots_user_id_idx" ON "workflow_screenshots" ("user_id");
CREATE INDEX IF NOT EXISTS "workflow_screenshots_node_id_idx" ON "workflow_screenshots" ("node_id");
CREATE INDEX IF NOT EXISTS "workflow_screenshots_session_id_idx" ON "workflow_screenshots" ("session_id");
CREATE INDEX IF NOT EXISTS "workflow_screenshots_workflow_tag_idx" ON "workflow_screenshots" ("workflow_tag");
CREATE INDEX IF NOT EXISTS "workflow_screenshots_timestamp_idx" ON "workflow_screenshots" ("timestamp" DESC);

-- Add vector similarity search index (IVFFlat for faster approximate nearest neighbor search)
CREATE INDEX IF NOT EXISTS "workflow_screenshots_embedding_idx" ON "workflow_screenshots"
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Add GIN index for full-text search on summary and analysis (for BM25-style lexical search)
CREATE INDEX IF NOT EXISTS "workflow_screenshots_summary_text_idx" ON "workflow_screenshots"
USING gin (to_tsvector('english', COALESCE(summary, '')));

CREATE INDEX IF NOT EXISTS "workflow_screenshots_analysis_text_idx" ON "workflow_screenshots"
USING gin (to_tsvector('english', COALESCE(analysis, '')));

-- Add foreign key constraint
ALTER TABLE "workflow_screenshots" ADD CONSTRAINT "workflow_screenshots_user_id_users_id_fk"
FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

-- Add check constraint for valid workflow tags
ALTER TABLE "workflow_screenshots" ADD CONSTRAINT "workflow_screenshots_valid_tag_check"
CHECK (workflow_tag IN (
	'research',
	'coding',
	'market_analysis',
	'documentation',
	'design',
	'testing',
	'debugging',
	'meeting',
	'planning',
	'learning',
	'code_review',
	'deployment',
	'analysis',
	'writing',
	'communication',
	'other'
));
