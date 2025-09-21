CREATE TYPE "public"."org_member_role" AS ENUM('member');--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('company', 'educational_institution');--> statement-breakpoint
CREATE TYPE "public"."permission_action" AS ENUM('view');--> statement-breakpoint
CREATE TYPE "public"."policy_effect" AS ENUM('ALLOW', 'DENY');--> statement-breakpoint
CREATE TYPE "public"."subject_type" AS ENUM('user', 'org', 'public');--> statement-breakpoint
CREATE TYPE "public"."timeline_node_type" AS ENUM('job', 'education', 'project', 'event', 'action', 'careerTransition');--> statement-breakpoint
CREATE TYPE "public"."visibility_level" AS ENUM('overview', 'full');--> statement-breakpoint
CREATE TABLE "node_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" uuid NOT NULL,
	"description" text NOT NULL,
	"resources" json DEFAULT '[]'::json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "node_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" uuid NOT NULL,
	"level" "visibility_level" NOT NULL,
	"action" "permission_action" DEFAULT 'view' NOT NULL,
	"subject_type" "subject_type" NOT NULL,
	"subject_id" integer,
	"effect" "policy_effect" DEFAULT 'ALLOW' NOT NULL,
	"granted_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "org_members" (
	"org_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" "org_member_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "organization_type" NOT NULL,
	"metadata" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" serial NOT NULL,
	"username" text NOT NULL,
	"raw_data" json NOT NULL,
	"filtered_data" json NOT NULL,
	"projects" json DEFAULT '[]'::json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" timeline_node_type NOT NULL,
	"parent_id" uuid,
	"meta" json DEFAULT '{}'::json NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"level" text,
	"confidence" real NOT NULL,
	"source" text NOT NULL,
	"context" text,
	"keywords" text DEFAULT '[]',
	"first_mentioned" timestamp DEFAULT now() NOT NULL,
	"last_mentioned" timestamp DEFAULT now() NOT NULL,
	"mention_count" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"user_name" text,
	"interest" text,
	"has_completed_onboarding" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_user_name_unique" UNIQUE("user_name")
);
--> statement-breakpoint
ALTER TABLE "node_insights" ADD CONSTRAINT "node_insights_node_id_timeline_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."timeline_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_policies" ADD CONSTRAINT "node_policies_node_id_timeline_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."timeline_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_policies" ADD CONSTRAINT "node_policies_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_nodes" ADD CONSTRAINT "timeline_nodes_parent_id_timeline_nodes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."timeline_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_nodes" ADD CONSTRAINT "timeline_nodes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;