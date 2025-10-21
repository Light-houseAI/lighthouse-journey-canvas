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
