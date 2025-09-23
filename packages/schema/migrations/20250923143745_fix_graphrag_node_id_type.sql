-- Drop existing foreign key constraint if it exists
ALTER TABLE "graphrag_chunks" DROP CONSTRAINT IF EXISTS "graphrag_chunks_node_id_fkey";--> statement-breakpoint
-- Clean up any invalid UUID values
UPDATE "graphrag_chunks" SET "node_id" = NULL WHERE "node_id" IS NOT NULL AND "node_id" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';--> statement-breakpoint
-- Convert column type from varchar to uuid
ALTER TABLE "graphrag_chunks" ALTER COLUMN "node_id" SET DATA TYPE uuid USING "node_id"::uuid;--> statement-breakpoint
-- Ensure column is nullable
ALTER TABLE "graphrag_chunks" ALTER COLUMN "node_id" DROP NOT NULL;--> statement-breakpoint
-- Add foreign key constraint
ALTER TABLE "graphrag_chunks" ADD CONSTRAINT "graphrag_chunks_node_id_timeline_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."timeline_nodes"("id") ON DELETE cascade ON UPDATE no action;