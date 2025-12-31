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

export const getExperienceMatchesParamsSchema = z.object({
  nodeId: z.string().uuid(),
});

export const getExperienceMatchesQuerySchema = z.object({
  forceRefresh: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

export type SearchProfilesRequest = z.infer<typeof searchProfilesRequestSchema>;
// GetExperienceMatchesParams and GetExperienceMatchesQuery are already exported from types.ts

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * GraphRAG node insight
 */
export const graphragNodeInsightSchema = z.object({
  text: z.string(),
  category: z.string(),
});

/**
 * Matched timeline node with insights
 */
export const matchedTimelineNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  meta: z.record(z.any()),
  score: z.number(),
  insights: z.array(graphragNodeInsightSchema).optional(),
});

/**
 * Career insight from matched candidate's job search journey (LIG-207)
 */
export const careerInsightSchema = z.object({
  text: z.string(),
  relevance: z.enum(['high', 'medium']),
  category: z.enum([
    'transition',
    'skill-building',
    'networking',
    'preparation',
  ]),
});

/**
 * Individual match result - full profile data for UI display
 */
export const experienceMatchSchema = z.object({
  id: z.string(), // User ID as string
  name: z.string(),
  email: z.string(),
  username: z.string().optional(),
  currentRole: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  matchScore: z.string(), // Match score percentage
  whyMatched: z.array(z.string()),
  skills: z.array(z.string()),
  matchedNodes: z.array(matchedTimelineNodeSchema),
  careerInsights: z.array(careerInsightSchema).optional(), // LIG-207: Actionable insights
});

/**
 * GraphRAG Search Response Schema
 */
export const graphragSearchResponseSchema = z.object({
  results: z.array(experienceMatchSchema),
  totalResults: z.number(),
  query: z.string(),
});

export type GraphRAGNodeInsight = z.infer<typeof graphragNodeInsightSchema>;
export type MatchedTimelineNode = z.infer<typeof matchedTimelineNodeSchema>;
export type CareerInsight = z.infer<typeof careerInsightSchema>;
export type ExperienceMatch = z.infer<typeof experienceMatchSchema>;
export type GraphRAGSearchResponse = z.infer<
  typeof graphragSearchResponseSchema
>;

// ============================================================================
// Workflow Analysis Graph RAG Schemas
// ============================================================================

/**
 * Entity result from cross-session retrieval
 */
export const entityResultSchema = z.object({
  entityName: z.string(),
  entityType: z.string(),
  frequency: z.number(),
  usageCount: z.number().optional(),
  similarity: z.number().optional(),
  lastSeen: z.string(), // ISO date string
  source: z.enum(['graph', 'vector', 'both']),
});

/**
 * Concept result from cross-session retrieval
 */
export const conceptResultSchema = z.object({
  conceptName: z.string(),
  category: z.string(),
  frequency: z.number(),
  usageCount: z.number().optional(),
  similarity: z.number().optional(),
  lastSeen: z.string(), // ISO date string
  source: z.enum(['graph', 'vector', 'both']),
});

/**
 * Session result from cross-session retrieval
 */
export const sessionResultSchema = z.object({
  sessionId: z.string(),
  workflowClassification: z.string(),
  startTime: z.string(), // ISO date string
  endTime: z.string().optional(), // ISO date string
  activityCount: z.number(),
  similarity: z.number().optional(),
});

/**
 * Workflow pattern result
 */
export const workflowPatternResultSchema = z.object({
  transition: z.string(),
  frequency: z.number(),
  avgTransitionTime: z.number().optional(),
});

/**
 * Cross-session retrieval metadata
 */
export const crossSessionMetadataSchema = z.object({
  graphQueryTimeMs: z.number(),
  vectorQueryTimeMs: z.number(),
  totalTimeMs: z.number(),
  graphResultCount: z.number(),
  vectorResultCount: z.number(),
  fusedResultCount: z.number(),
});

/**
 * Cross-session context response
 */
export const crossSessionContextResponseSchema = z.object({
  entities: z.array(entityResultSchema),
  concepts: z.array(conceptResultSchema),
  relatedSessions: z.array(sessionResultSchema),
  workflowPatterns: z.array(workflowPatternResultSchema),
  temporalSequence: z.array(
    z.object({
      sessionId: z.string(),
      timestamp: z.string(), // ISO date string
    })
  ),
  retrievalMetadata: crossSessionMetadataSchema,
});

/**
 * Request schema for cross-session context retrieval
 */
export const getCrossSessionContextQuerySchema = z.object({
  lookbackDays: z.coerce.number().int().min(1).max(365).optional().default(30),
  maxResults: z.coerce.number().int().min(1).max(100).optional().default(20),
  includeGraph: z
    .string()
    .optional()
    .transform((val) => val !== 'false')
    .default('true'),
  includeVectors: z
    .string()
    .optional()
    .transform((val) => val !== 'false')
    .default('true'),
});

/**
 * Request schema for entity search
 */
export const searchEntitiesRequestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  limit: z.number().int().min(1).max(100).optional().default(10),
  minSimilarity: z.number().min(0).max(1).optional().default(0.5),
  entityType: z.string().optional(),
});

/**
 * Request schema for concept search
 */
export const searchConceptsRequestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  limit: z.number().int().min(1).max(100).optional().default(10),
  minSimilarity: z.number().min(0).max(1).optional().default(0.5),
  category: z.string().optional(),
});

/**
 * Entity search response
 */
export const entitySearchResponseSchema = z.object({
  results: z.array(entityResultSchema),
  totalResults: z.number(),
  query: z.string(),
});

/**
 * Concept search response
 */
export const conceptSearchResponseSchema = z.object({
  results: z.array(conceptResultSchema),
  totalResults: z.number(),
  query: z.string(),
});

/**
 * Health check response for Graph RAG services
 */
export const graphRAGHealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  arangodb: z.object({
    connected: z.boolean(),
    latencyMs: z.number().optional(),
    collections: z.number().optional(),
    error: z.string().optional(),
  }),
  postgresql: z.object({
    connected: z.boolean(),
    latencyMs: z.number().optional(),
    entityEmbeddings: z.number().optional(),
    conceptEmbeddings: z.number().optional(),
    error: z.string().optional(),
  }),
  services: z.object({
    entityExtraction: z.boolean(),
    crossSessionRetrieval: z.boolean(),
    graphService: z.boolean(),
  }),
});

// Export types
export type EntityResult = z.infer<typeof entityResultSchema>;
export type ConceptResult = z.infer<typeof conceptResultSchema>;
export type SessionResult = z.infer<typeof sessionResultSchema>;
export type WorkflowPatternResult = z.infer<typeof workflowPatternResultSchema>;
export type CrossSessionMetadata = z.infer<typeof crossSessionMetadataSchema>;
export type CrossSessionContextResponse = z.infer<
  typeof crossSessionContextResponseSchema
>;
export type GetCrossSessionContextQuery = z.infer<
  typeof getCrossSessionContextQuerySchema
>;
export type SearchEntitiesRequest = z.infer<typeof searchEntitiesRequestSchema>;
export type SearchConceptsRequest = z.infer<typeof searchConceptsRequestSchema>;
export type EntitySearchResponse = z.infer<typeof entitySearchResponseSchema>;
export type ConceptSearchResponse = z.infer<typeof conceptSearchResponseSchema>;
export type GraphRAGHealthResponse = z.infer<
  typeof graphRAGHealthResponseSchema
>;
