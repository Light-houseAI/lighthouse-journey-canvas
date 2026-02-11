CREATE TYPE "public"."agent_trace_status" AS ENUM('pending', 'running', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."company_doc_processing_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."feedback_feature_type" AS ENUM('desktop_summary', 'workflow_analysis', 'top_workflow', 'ai_usage_overview');--> statement-breakpoint
CREATE TYPE "public"."feedback_rating" AS ENUM('thumbs_up', 'thumbs_down');--> statement-breakpoint
CREATE TYPE "public"."insight_job_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."nano_agent_execution_status" AS ENUM('pending', 'running', 'completed', 'failed', 'aborted');--> statement-breakpoint
CREATE TYPE "public"."nano_agent_flow_source_type" AS ENUM('custom', 'workflow_pattern', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."onboarding_type" AS ENUM('linkedin', 'desktop');--> statement-breakpoint
CREATE TYPE "public"."platform_step_type" AS ENUM('search', 'read', 'write', 'edit', 'navigate', 'copy', 'paste', 'review', 'compile', 'run', 'debug', 'commit', 'deploy', 'communicate', 'idle', 'other');--> statement-breakpoint
CREATE TYPE "public"."platform_workflow_type" AS ENUM('research', 'coding', 'documentation', 'debugging', 'testing', 'design', 'planning', 'learning', 'communication', 'analysis', 'deployment', 'code_review', 'market_analysis', 'writing', 'meeting', 'other');--> statement-breakpoint
CREATE TYPE "public"."query_trace_status" AS ENUM('started', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."role_category" AS ENUM('software_engineer', 'product_manager', 'designer', 'data_scientist', 'devops', 'qa_engineer', 'technical_writer', 'manager', 'other');--> statement-breakpoint
CREATE TYPE "public"."session_feedback_type" AS ENUM('category_changed', 'node_changed', 'both_changed', 'accepted', 'new_node_created');--> statement-breakpoint
CREATE TYPE "public"."session_mapping_action" AS ENUM('matched_existing', 'created_new', 'user_selected');--> statement-breakpoint
CREATE TYPE "public"."waitlist_status" AS ENUM('pending', 'invited', 'registered');--> statement-breakpoint
CREATE TYPE "public"."work_track_category" AS ENUM('job_search', 'interview_prep', 'networking', 'career_planning', 'resume_portfolio', 'personal_branding', 'online_course', 'certification_study', 'self_study', 'skill_practice', 'research', 'core_work', 'meetings', 'communication', 'code_review', 'planning_strategy', 'mentoring', 'work_project', 'side_project', 'open_source', 'freelance_work', 'admin_tasks', 'tool_setup', 'documentation', 'conference_event', 'health_wellness', 'general_browsing');--> statement-breakpoint
ALTER TYPE "public"."timeline_node_type" ADD VALUE 'work' BEFORE 'education';--> statement-breakpoint
ALTER TYPE "public"."timeline_node_type" ADD VALUE 'learning' BEFORE 'project';--> statement-breakpoint
ALTER TYPE "public"."timeline_node_type" ADD VALUE 'personal_project' BEFORE 'event';--> statement-breakpoint
ALTER TYPE "public"."timeline_node_type" ADD VALUE 'job_search' BEFORE 'event';--> statement-breakpoint
CREATE TABLE "agent_traces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_trace_id" uuid NOT NULL,
	"agent_id" varchar(50) NOT NULL,
	"agent_name" varchar(100) NOT NULL,
	"execution_order" integer NOT NULL,
	"status" "agent_trace_status" DEFAULT 'pending' NOT NULL,
	"input_summary" json,
	"output_summary" json,
	"processing_time_ms" integer,
	"llm_call_count" integer DEFAULT 0,
	"llm_tokens_used" integer DEFAULT 0,
	"model_used" varchar(100),
	"retry_count" integer DEFAULT 0,
	"critique_result" json,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_rag_documents" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "company_rag_documents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"filename" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"processing_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"processing_error" text,
	"chunk_count" integer DEFAULT 0,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_rag_documents_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "concept_embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"concept_name" varchar(255) NOT NULL,
	"category" varchar(100),
	"embedding" vector(1536) NOT NULL,
	"source_type" varchar(50),
	"frequency" integer DEFAULT 1 NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"meta" json DEFAULT '{}'::json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "concept_embeddings_concept_name_unique" UNIQUE("concept_name")
);
--> statement-breakpoint
CREATE TABLE "data_source_traces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_trace_id" uuid NOT NULL,
	"source_name" varchar(100) NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"query_description" text,
	"parameters_used" json,
	"result_count" integer,
	"result_summary" text,
	"latency_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_name" varchar(255) NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"frequency" integer DEFAULT 1 NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"meta" json DEFAULT '{}'::json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insight_generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"node_id" uuid,
	"query" text NOT NULL,
	"status" "insight_job_status" DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0,
	"current_stage" varchar(100),
	"agent_states" json DEFAULT '{}'::json,
	"result" json,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"email" varchar(255) NOT NULL,
	"waitlist_id" integer,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "nano_agent_executions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flow_id" uuid NOT NULL,
	"user_id" integer NOT NULL,
	"status" "nano_agent_execution_status" DEFAULT 'pending' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"total_steps" integer DEFAULT 0 NOT NULL,
	"step_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nano_agent_flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"source_type" "nano_agent_flow_source_type" DEFAULT 'custom' NOT NULL,
	"source_pattern_id" text,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_template" boolean DEFAULT false NOT NULL,
	"org_id" integer,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"run_count" integer DEFAULT 0 NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_step_patterns" (
	"id" serial PRIMARY KEY NOT NULL,
	"step_hash" varchar(64) NOT NULL,
	"step_type" "platform_step_type" NOT NULL,
	"tool_category" varchar(100),
	"avg_duration_seconds" integer NOT NULL,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"efficiency_indicators" json DEFAULT '{}'::json,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_workflow_patterns" (
	"id" serial PRIMARY KEY NOT NULL,
	"workflow_hash" varchar(64) NOT NULL,
	"workflow_type" "platform_workflow_type" NOT NULL,
	"role_category" "role_category",
	"step_count" integer NOT NULL,
	"avg_duration_seconds" integer NOT NULL,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"efficiency_score" numeric(5, 2),
	"step_sequence" json NOT NULL,
	"tool_patterns" json DEFAULT '{}'::json,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "query_traces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"user_id" integer NOT NULL,
	"raw_query" text NOT NULL,
	"query_classification" json,
	"routing_decision" json,
	"agent_path" varchar(255),
	"total_processing_time_ms" integer,
	"status" "query_trace_status" DEFAULT 'started' NOT NULL,
	"has_attached_sessions" boolean DEFAULT false,
	"attached_session_count" integer DEFAULT 0,
	"has_conversation_memory" boolean DEFAULT false,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_classification_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"session_mapping_id" uuid NOT NULL,
	"original_category" "work_track_category" NOT NULL,
	"original_node_id" uuid,
	"corrected_category" "work_track_category",
	"corrected_node_id" uuid,
	"feedback_type" "session_feedback_type" NOT NULL,
	"user_role" varchar(100),
	"user_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"desktop_session_id" varchar(100) NOT NULL,
	"category" "work_track_category" NOT NULL,
	"category_confidence" double precision,
	"node_id" uuid,
	"node_match_confidence" double precision,
	"mapping_action" "session_mapping_action",
	"workflow_name" text,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer,
	"summary_embedding" vector(1536),
	"high_level_summary" text,
	"generated_title" text,
	"user_notes" text,
	"summary" jsonb,
	"screenshot_descriptions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trace_payloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_trace_id" uuid NOT NULL,
	"payload_type" varchar(20) NOT NULL,
	"payload" jsonb NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"feature_type" "feedback_feature_type" NOT NULL,
	"rating" "feedback_rating" NOT NULL,
	"comment" text,
	"context_data" json DEFAULT '{}'::json,
	"node_id" uuid,
	"session_mapping_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"job_role" varchar(100),
	"status" "waitlist_status" DEFAULT 'pending' NOT NULL,
	"invited_at" timestamp with time zone,
	"registered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workflow_screenshots" (
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
	"meta" json DEFAULT '{}'::json,
	"arango_activity_key" varchar(255),
	"entities_extracted" json DEFAULT '[]'::json,
	"concepts_extracted" json DEFAULT '[]'::json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_type" "onboarding_type" DEFAULT 'desktop';--> statement-breakpoint
ALTER TABLE "agent_traces" ADD CONSTRAINT "agent_traces_query_trace_id_query_traces_id_fk" FOREIGN KEY ("query_trace_id") REFERENCES "public"."query_traces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_rag_documents" ADD CONSTRAINT "company_rag_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_source_traces" ADD CONSTRAINT "data_source_traces_agent_trace_id_agent_traces_id_fk" FOREIGN KEY ("agent_trace_id") REFERENCES "public"."agent_traces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_generation_jobs" ADD CONSTRAINT "insight_generation_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_generation_jobs" ADD CONSTRAINT "insight_generation_jobs_node_id_timeline_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."timeline_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_waitlist_id_waitlist_id_fk" FOREIGN KEY ("waitlist_id") REFERENCES "public"."waitlist"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nano_agent_executions" ADD CONSTRAINT "nano_agent_executions_flow_id_nano_agent_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."nano_agent_flows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nano_agent_executions" ADD CONSTRAINT "nano_agent_executions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nano_agent_flows" ADD CONSTRAINT "nano_agent_flows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nano_agent_flows" ADD CONSTRAINT "nano_agent_flows_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_traces" ADD CONSTRAINT "query_traces_job_id_insight_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."insight_generation_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "query_traces" ADD CONSTRAINT "query_traces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_classification_feedback" ADD CONSTRAINT "session_classification_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_classification_feedback" ADD CONSTRAINT "session_classification_feedback_session_mapping_id_session_mappings_id_fk" FOREIGN KEY ("session_mapping_id") REFERENCES "public"."session_mappings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_mappings" ADD CONSTRAINT "session_mappings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_mappings" ADD CONSTRAINT "session_mappings_node_id_timeline_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."timeline_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trace_payloads" ADD CONSTRAINT "trace_payloads_agent_trace_id_agent_traces_id_fk" FOREIGN KEY ("agent_trace_id") REFERENCES "public"."agent_traces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_node_id_timeline_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."timeline_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_session_mapping_id_session_mappings_id_fk" FOREIGN KEY ("session_mapping_id") REFERENCES "public"."session_mappings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_screenshots" ADD CONSTRAINT "workflow_screenshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;