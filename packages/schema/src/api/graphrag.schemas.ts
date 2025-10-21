/**
 * GraphRAG API Schemas
 * Request and response schemas for pgvector-based GraphRAG search
 */

import { z } from 'zod';

// ============================================================================
// Request Schemas
// ============================================================================

export const searchProfilesRequestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  limit: z.number().int().min(1).max(100).optional().default(20),
  tenantId: z.string().optional(),
  excludeUserId: z.number().int().optional(),
  similarityThreshold: z.number().min(0).max(1).optional(),
});

export type SearchProfilesRequest = z.infer<typeof searchProfilesRequestSchema>;

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
