/**
 * GraphRAG API Schemas
 * Request and response schemas for pgvector-based GraphRAG search
 */

import { z } from 'zod';

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * GraphRAG Search Response Schema
 * Using z.any() for now - will be refined when structure is finalized
 */
export const graphragSearchResponseSchema = z.any();

export type GraphRAGSearchResponse = z.infer<
  typeof graphragSearchResponseSchema
>;
