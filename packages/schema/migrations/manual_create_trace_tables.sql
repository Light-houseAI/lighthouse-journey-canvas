-- Manual migration to create trace tables for query tracing dashboard
-- Run this with: psql $DATABASE_URL -f migrations/manual_create_trace_tables.sql

-- Create enums if they don't exist
DO $$ BEGIN
    CREATE TYPE query_trace_status AS ENUM ('started', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE agent_trace_status AS ENUM ('pending', 'running', 'completed', 'failed', 'skipped');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create query_traces table
CREATE TABLE IF NOT EXISTS query_traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES insight_generation_jobs(id) ON DELETE SET NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    raw_query TEXT NOT NULL,
    query_classification JSON,
    routing_decision JSON,
    agent_path VARCHAR(255),
    total_processing_time_ms INTEGER,
    status query_trace_status NOT NULL DEFAULT 'started',
    has_attached_sessions BOOLEAN NOT NULL DEFAULT false,
    attached_session_count INTEGER NOT NULL DEFAULT 0,
    has_conversation_memory BOOLEAN NOT NULL DEFAULT false,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create agent_traces table
CREATE TABLE IF NOT EXISTS agent_traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_trace_id UUID NOT NULL REFERENCES query_traces(id) ON DELETE CASCADE,
    agent_id VARCHAR(50) NOT NULL,
    agent_name VARCHAR(100) NOT NULL,
    execution_order INTEGER NOT NULL DEFAULT 0,
    status agent_trace_status NOT NULL DEFAULT 'pending',
    input_summary JSON,
    output_summary JSON,
    processing_time_ms INTEGER,
    llm_call_count INTEGER NOT NULL DEFAULT 0,
    llm_tokens_used INTEGER NOT NULL DEFAULT 0,
    model_used VARCHAR(100),
    retry_count INTEGER NOT NULL DEFAULT 0,
    critique_result JSON,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create trace_payloads table (for full I/O storage on failed queries)
CREATE TABLE IF NOT EXISTS trace_payloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_trace_id UUID NOT NULL REFERENCES agent_traces(id) ON DELETE CASCADE,
    payload_type VARCHAR(20) NOT NULL,
    payload JSON NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create data_source_traces table
CREATE TABLE IF NOT EXISTS data_source_traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_trace_id UUID NOT NULL REFERENCES agent_traces(id) ON DELETE CASCADE,
    source_name VARCHAR(100) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    query_description TEXT,
    parameters_used JSON,
    result_count INTEGER,
    result_summary TEXT,
    latency_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_query_traces_user_id ON query_traces(user_id);
CREATE INDEX IF NOT EXISTS idx_query_traces_started_at ON query_traces(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_traces_status ON query_traces(status);
CREATE INDEX IF NOT EXISTS idx_agent_traces_query_trace_id ON agent_traces(query_trace_id);
CREATE INDEX IF NOT EXISTS idx_agent_traces_agent_id ON agent_traces(agent_id);
CREATE INDEX IF NOT EXISTS idx_data_source_traces_agent_trace_id ON data_source_traces(agent_trace_id);
CREATE INDEX IF NOT EXISTS idx_trace_payloads_agent_trace_id ON trace_payloads(agent_trace_id);

-- Success message
SELECT 'Trace tables created successfully!' as result;
