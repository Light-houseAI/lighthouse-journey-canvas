-- Migration: Add company_documents table for RAG document storage
-- This table tracks uploaded company documents (PDF/DOCX) for the Insight Assistant feature

-- Create company_documents table
CREATE TABLE IF NOT EXISTS company_documents (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_key VARCHAR(500) NOT NULL UNIQUE,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL,

  -- Processing status tracking
  processing_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  processing_error TEXT,
  chunk_count INTEGER DEFAULT 0,

  -- Timestamps
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_company_docs_user_id ON company_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_company_docs_status ON company_documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_company_docs_created ON company_documents(created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE company_documents IS 'Stores metadata for uploaded company documents used in RAG-based insight generation';
COMMENT ON COLUMN company_documents.processing_status IS 'Status of document processing: pending, processing, completed, failed';
COMMENT ON COLUMN company_documents.chunk_count IS 'Number of chunks created from this document in graphrag_chunks table';
