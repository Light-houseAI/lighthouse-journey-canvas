CREATE TYPE "public"."event_type" AS ENUM('interview', 'networking', 'conference', 'workshop', 'other');--> statement-breakpoint
CREATE TABLE "updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" uuid NOT NULL,
	"notes" text,
	"meta" json DEFAULT '{}'::json NOT NULL,
	"rendered_text" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "updates" ADD CONSTRAINT "updates_node_id_timeline_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."timeline_nodes"("id") ON DELETE cascade ON UPDATE no action;
