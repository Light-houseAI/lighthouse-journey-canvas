CREATE TABLE "timeline_node_closure" (
	"ancestor_id" uuid NOT NULL,
	"descendant_id" uuid NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "timeline_node_closure_ancestor_id_descendant_id_pk" PRIMARY KEY("ancestor_id","descendant_id")
);
--> statement-breakpoint
ALTER TABLE "timeline_node_closure" ADD CONSTRAINT "timeline_node_closure_ancestor_id_timeline_nodes_id_fk" FOREIGN KEY ("ancestor_id") REFERENCES "public"."timeline_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_node_closure" ADD CONSTRAINT "timeline_node_closure_descendant_id_timeline_nodes_id_fk" FOREIGN KEY ("descendant_id") REFERENCES "public"."timeline_nodes"("id") ON DELETE cascade ON UPDATE no action;