/**
 * AI Usage Overview API Schemas
 *
 * Schemas for AI Usage Overview feature that provides insights into
 * how the user interacts with AI tools in their workflows.
 *
 * Uses the hybrid graph RAG system to pull data from:
 * - Entity & Concept embeddings (from LLM-extracted screenshots)
 * - ArangoDB graph for usage relationships (USES, RELATES_TO)
 * - PostgreSQL vector similarity for semantic patterns
 */

import { z } from 'zod';

// ============================================================================
// AI TOOL USAGE SCHEMAS
// ============================================================================

/**
 * AI tool/entity with usage metrics
 */
export const aiToolUsageSchema = z.object({
  name: z.string(),
  category: z.enum([
    'llm',
    'code_assistant',
    'image_generation',
    'search',
    'automation',
    'analytics',
    'other',
  ]),
  usageCount: z.number(),
  sessionCount: z.number(),
  lastUsed: z.string(), // ISO date string
  averageSessionDuration: z.number().optional(),
  confidence: z.number().min(0).max(1),
  trends: z.object({
    weeklyChange: z.number(), // Percentage change from last week
    monthlyChange: z.number(), // Percentage change from last month
  }).optional(),
});

export type AIToolUsage = z.infer<typeof aiToolUsageSchema>;

/**
 * AI-related concept or practice
 */
export const aiConceptUsageSchema = z.object({
  name: z.string(),
  category: z.enum([
    'prompt_engineering',
    'ai_assisted_coding',
    'ai_debugging',
    'ai_research',
    'ai_content_generation',
    'ai_data_analysis',
    'ai_automation',
    'other',
  ]),
  frequency: z.number(),
  sessionCount: z.number(),
  lastSeen: z.string(), // ISO date string
  confidence: z.number().min(0).max(1),
  relatedTools: z.array(z.string()).optional(),
});

export type AIConceptUsage = z.infer<typeof aiConceptUsageSchema>;

/**
 * Workflow that involves AI tools
 */
export const aiWorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  aiToolsUsed: z.array(z.string()),
  occurrenceCount: z.number(),
  avgDurationSeconds: z.number(),
  confidence: z.number().min(0).max(1),
  lastOccurred: z.string(), // ISO date string
});

export type AIWorkflow = z.infer<typeof aiWorkflowSchema>;

/**
 * AI usage trend data point
 */
export const aiUsageTrendPointSchema = z.object({
  date: z.string(), // ISO date string (day or week)
  sessionCount: z.number(),
  toolUsageCount: z.number(),
  topTools: z.array(z.string()),
});

export type AIUsageTrendPoint = z.infer<typeof aiUsageTrendPointSchema>;

/**
 * AI usage session summary
 */
export const aiSessionSummarySchema = z.object({
  sessionId: z.string(),
  date: z.string(), // ISO date string
  durationSeconds: z.number(),
  aiToolsUsed: z.array(z.string()),
  aiConceptsApplied: z.array(z.string()),
  workflowName: z.string().optional(),
  summary: z.string().optional(),
});

export type AISessionSummary = z.infer<typeof aiSessionSummarySchema>;

// ============================================================================
// AI USAGE OVERVIEW RESPONSE SCHEMA
// ============================================================================

/**
 * Key metrics for AI usage
 */
export const aiUsageMetricsSchema = z.object({
  totalSessions: z.number(),
  sessionsWithAI: z.number(),
  aiAdoptionRate: z.number(), // Percentage of sessions using AI tools
  totalAIToolUsages: z.number(),
  uniqueAITools: z.number(),
  mostUsedTool: z.string().optional(),
  avgAIToolsPerSession: z.number(),
  totalTimeWithAI: z.number(), // Seconds
});

export type AIUsageMetrics = z.infer<typeof aiUsageMetricsSchema>;

/**
 * Complete AI Usage Overview result
 */
export const aiUsageOverviewResultSchema = z.object({
  nodeId: z.string(),
  userId: z.number(),

  // Key metrics summary
  metrics: aiUsageMetricsSchema,

  // Top AI tools used (from entity_embeddings)
  topAITools: z.array(aiToolUsageSchema),

  // AI-related concepts and practices (from concept_embeddings)
  aiConcepts: z.array(aiConceptUsageSchema),

  // Top workflows that include AI usage
  topAIWorkflows: z.array(aiWorkflowSchema),

  // Usage trends over time
  usageTrends: z.array(aiUsageTrendPointSchema),

  // Recent AI-involving sessions
  recentAISessions: z.array(aiSessionSummarySchema),

  // Retrieval metadata
  retrievalMetadata: z.object({
    graphQueryTimeMs: z.number(),
    vectorQueryTimeMs: z.number(),
    totalTimeMs: z.number(),
    entitiesScanned: z.number(),
    conceptsScanned: z.number(),
    sessionsAnalyzed: z.number(),
  }),

  // Analysis metadata
  analyzedAt: z.string().datetime(),
  dataRangeStart: z.string().datetime(),
  dataRangeEnd: z.string().datetime(),
});

export type AIUsageOverviewResult = z.infer<typeof aiUsageOverviewResultSchema>;

// ============================================================================
// REQUEST/RESPONSE SCHEMAS
// ============================================================================

/**
 * Request to get AI usage overview for a node
 */
export const getAIUsageOverviewQuerySchema = z.object({
  lookbackDays: z.coerce.number().int().min(1).max(365).optional().default(30),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
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

export type GetAIUsageOverviewQuery = z.infer<typeof getAIUsageOverviewQuerySchema>;

/**
 * Response for getting AI usage overview
 */
export const getAIUsageOverviewResponseSchema = z.object({
  success: z.boolean(),
  data: aiUsageOverviewResultSchema.nullable(),
  message: z.string().optional(),
});

export type GetAIUsageOverviewResponse = z.infer<typeof getAIUsageOverviewResponseSchema>;

/**
 * Request to trigger AI usage analysis
 */
export const triggerAIUsageAnalysisRequestSchema = z.object({
  nodeId: z.string(),
  forceReanalysis: z.boolean().optional().default(false),
  lookbackDays: z.number().int().min(1).max(365).optional().default(30),
});

export type TriggerAIUsageAnalysisRequest = z.infer<typeof triggerAIUsageAnalysisRequestSchema>;

/**
 * Response for triggering AI usage analysis
 */
export const triggerAIUsageAnalysisResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  analysisJobId: z.string().uuid().optional(),
});

export type TriggerAIUsageAnalysisResponse = z.infer<typeof triggerAIUsageAnalysisResponseSchema>;
