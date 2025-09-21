CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "graphrag_chunks" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "graphrag_chunks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"node_id" varchar(255) NOT NULL,
	"chunk_text" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"node_type" varchar(50) NOT NULL,
	"meta" json DEFAULT '{}'::json,
	"tenant_id" varchar(100) DEFAULT 'default',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graphrag_edges" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "graphrag_edges_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"src_chunk_id" bigint NOT NULL,
	"dst_chunk_id" bigint NOT NULL,
	"rel_type" varchar(50) NOT NULL,
	"weight" double precision DEFAULT 1,
	"directed" boolean DEFAULT true,
	"meta" json DEFAULT '{}'::json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "graphrag_chunks" ADD CONSTRAINT "graphrag_chunks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphrag_edges" ADD CONSTRAINT "graphrag_edges_src_chunk_id_graphrag_chunks_id_fk" FOREIGN KEY ("src_chunk_id") REFERENCES "public"."graphrag_chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphrag_edges" ADD CONSTRAINT "graphrag_edges_dst_chunk_id_graphrag_chunks_id_fk" FOREIGN KEY ("dst_chunk_id") REFERENCES "public"."graphrag_chunks"("id") ON DELETE cascade ON UPDATE no action;
