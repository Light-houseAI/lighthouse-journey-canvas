/**
 * Workflow Analysis API Schemas
 *
 * Schemas for workflow analysis feature that provides AI-powered
 * head analyst insights using hybrid search (BM25 + similarity)
 * on captured session screenshots stored in vector database.
 */

import { z } from 'zod';

// ============================================================================
// WORKFLOW TAG ENUM
// ============================================================================

/**
 * Workflow tag categories for screenshot classification
 */
export const WorkflowTag = {
  Research: 'research',
  Coding: 'coding',
  MarketAnalysis: 'market_analysis',
  Documentation: 'documentation',
  Design: 'design',
  Testing: 'testing',
  Debugging: 'debugging',
  Meeting: 'meeting',
  Planning: 'planning',
  Learning: 'learning',
  CodeReview: 'code_review',
  Deployment: 'deployment',
  Analysis: 'analysis',
  Writing: 'writing',
  Communication: 'communication',
  Other: 'other',
} as const;

export type WorkflowTagType = typeof WorkflowTag[keyof typeof WorkflowTag];

export const workflowTagSchema = z.enum([
  'research',
  'coding',
  'market_analysis',
  'documentation',
  'design',
  'testing',
  'debugging',
  'meeting',
  'planning',
  'learning',
  'code_review',
  'deployment',
  'analysis',
  'writing',
  'communication',
  'other',
]);

// ============================================================================
// WORKFLOW SCREENSHOT SCHEMAS
// ============================================================================

/**
 * Single workflow screenshot with analysis
 */
export const workflowScreenshotSchema = z.object({
  id: z.number(),
  userId: z.number(),
  nodeId: z.string(),
  sessionId: z.string(),
  screenshotPath: z.string(),
  cloudUrl: z.string().nullable(),
  timestamp: z.string().datetime(),
  workflowTag: workflowTagSchema,
  summary: z.string().nullable(),
  analysis: z.string().nullable(),
  meta: z.record(z.any()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type WorkflowScreenshot = z.infer<typeof workflowScreenshotSchema>;

// ============================================================================
// WORKFLOW ANALYSIS REQUEST/RESPONSE SCHEMAS
// ============================================================================

/**
 * Request to trigger workflow analysis for a node
 * This kicks off the AI head analyst process
 */
export const triggerWorkflowAnalysisRequestSchema = z.object({
  nodeId: z.string().uuid(),
  // Optional: Force re-analysis even if recent analysis exists
  forceReanalysis: z.boolean().optional().default(false),
  // Optional: Specific prompt to guide the analysis
  customPrompt: z.string().max(1000).optional(),
});

export type TriggerWorkflowAnalysisRequest = z.infer<
  typeof triggerWorkflowAnalysisRequestSchema
>;

/**
 * Response when triggering workflow analysis
 */
export const triggerWorkflowAnalysisResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  analysisJobId: z.string().uuid().optional(),
  // If analysis already exists and not forcing re-analysis
  existingAnalysisId: z.string().uuid().optional(),
});

export type TriggerWorkflowAnalysisResponse = z.infer<
  typeof triggerWorkflowAnalysisResponseSchema
>;

/**
 * Hybrid search query for workflow screenshots
 * Combines lexical search (BM25) and semantic similarity (vector)
 */
export const hybridSearchQuerySchema = z.object({
  query: z.string().min(1).max(500),
  nodeId: z.string().uuid().optional(), // Filter by specific node
  workflowTags: z.array(workflowTagSchema).optional(), // Filter by workflow tags
  limit: z.number().positive().max(50).default(10),
  // Weight for lexical vs semantic search (0-1, default 0.5 for 50/50)
  lexicalWeight: z.number().min(0).max(1).default(0.5),
  // Minimum similarity threshold for vector search
  similarityThreshold: z.number().min(0).max(1).default(0.3),
  // Date range filters
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type HybridSearchQuery = z.infer<typeof hybridSearchQuerySchema>;

/**
 * Search result item from hybrid search
 */
export const searchResultItemSchema = z.object({
  screenshot: workflowScreenshotSchema,
  score: z.number(), // Combined hybrid score
  lexicalScore: z.number().optional(), // BM25 score
  semanticScore: z.number().optional(), // Cosine similarity score
  highlightedText: z.string().optional(), // Text snippets with query matches
});

export type SearchResultItem = z.infer<typeof searchResultItemSchema>;

/**
 * Response for hybrid search query
 */
export const hybridSearchResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    results: z.array(searchResultItemSchema),
    totalResults: z.number(),
    query: z.string(),
    searchType: z.enum(['hybrid', 'lexical', 'semantic']),
    executionTimeMs: z.number().optional(),
  }),
});

export type HybridSearchResponse = z.infer<typeof hybridSearchResponseSchema>;

/**
 * Workflow analysis insight generated by AI
 */
export const workflowInsightSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'pattern',
    'repetitive_workflow',
    'app_usage',
    'bottleneck',
    'efficiency_gain',
    'best_practice',
    'improvement_area',
    'time_distribution',
    'context_switch',
  ]),
  title: z.string(),
  description: z.string(),
  impact: z.enum(['high', 'medium', 'low']),
  confidence: z.number().min(0).max(1),
  supportingScreenshots: z.array(z.number()), // Screenshot IDs
  recommendations: z.array(z.string()).optional(),
  metrics: z.record(z.any()).optional(),
});

export type WorkflowInsight = z.infer<typeof workflowInsightSchema>;

/**
 * Complete workflow analysis result
 * This is the "head analyst" AI-generated report
 */
export const workflowAnalysisResultSchema = z.object({
  id: z.string().uuid(),
  nodeId: z.string().uuid(),
  userId: z.number(),

  // High-level executive summary
  executiveSummary: z.string(),

  // Detailed insights
  insights: z.array(workflowInsightSchema),

  // Workflow breakdown by tag
  workflowDistribution: z.array(
    z.object({
      tag: workflowTagSchema,
      count: z.number(),
      totalDurationSeconds: z.number(),
      percentage: z.number(),
    })
  ),

  // Key metrics
  metrics: z.object({
    totalScreenshots: z.number(),
    totalSessions: z.number(),
    totalDurationSeconds: z.number(),
    averageSessionDurationSeconds: z.number(),
    mostProductiveHours: z.array(z.number()).optional(),
    contextSwitches: z.number().optional(),
  }),

  // Top recommendations
  recommendations: z.array(z.string()),

  // Analysis metadata
  analyzedAt: z.string().datetime(),
  dataRangeStart: z.string().datetime(),
  dataRangeEnd: z.string().datetime(),
  screenshotsAnalyzed: z.number(),
});

export type WorkflowAnalysisResult = z.infer<typeof workflowAnalysisResultSchema>;

/**
 * Response for getting workflow analysis
 */
export const getWorkflowAnalysisResponseSchema = z.object({
  success: z.boolean(),
  data: workflowAnalysisResultSchema.nullable(),
  message: z.string().optional(),
});

export type GetWorkflowAnalysisResponse = z.infer<
  typeof getWorkflowAnalysisResponseSchema
>;

// ============================================================================
// INGEST SCREENSHOTS REQUEST (from Desktop-companion)
// ============================================================================

/**
 * Request to ingest screenshots from a desktop session
 */
export const ingestScreenshotsRequestSchema = z.object({
  sessionId: z.string(),
  nodeId: z.string().uuid(),
  screenshots: z.array(
    z.object({
      path: z.string(),
      timestamp: z.number(), // Unix timestamp
      cloudUrl: z.string().optional(),
      summary: z.string().optional(),
      // From Desktop-companion's Gemini analysis
      context: z.record(z.any()).optional(),
    })
  ),
});

export type IngestScreenshotsRequest = z.infer<
  typeof ingestScreenshotsRequestSchema
>;

/**
 * Response for ingesting screenshots
 */
export const ingestScreenshotsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  ingested: z.number(),
  failed: z.number(),
  screenshotIds: z.array(z.number()),
});

export type IngestScreenshotsResponse = z.infer<
  typeof ingestScreenshotsResponseSchema
>;

// ============================================================================
// TOP WORKFLOW SCHEMAS
// ============================================================================

/**
 * A single step in a top workflow sequence
 */
export const topWorkflowStepSchema = z.object({
  id: z.string(),
  order: z.number(),
  title: z.string(),
  description: z.string(),
  workflowTag: workflowTagSchema,
  averageDurationSeconds: z.number(),
  occurrenceCount: z.number(),
  confidence: z.number().min(0).max(1),
  apps: z.array(z.string()).optional(),
  relatedScreenshotIds: z.array(z.coerce.number()).optional(), // Coerce strings from PostgreSQL bigint
});

export type TopWorkflowStep = z.infer<typeof topWorkflowStepSchema>;

/**
 * Connection between workflow steps (for flow diagram)
 */
export const topWorkflowConnectionSchema = z.object({
  from: z.string(),
  to: z.string(),
  frequency: z.number(),
  type: z.enum(['solid', 'dashed']),
});

export type TopWorkflowConnection = z.infer<typeof topWorkflowConnectionSchema>;

/**
 * A complete top workflow pattern with steps and connections
 */
export const topWorkflowPatternSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  frequency: z.number(),
  totalOccurrences: z.number(),
  averageDurationSeconds: z.number(),
  confidence: z.number().min(0).max(1),
  steps: z.array(topWorkflowStepSchema),
  connections: z.array(topWorkflowConnectionSchema),
  relatedTags: z.array(workflowTagSchema),
  insights: z.array(z.string()).optional(),
  optimizationSuggestions: z.array(z.string()).optional(),
});

export type TopWorkflowPattern = z.infer<typeof topWorkflowPatternSchema>;

/**
 * Request to get top workflows
 */
export const getTopWorkflowsRequestSchema = z.object({
  nodeId: z.string().uuid().optional(),
  limit: z.coerce.number().positive().max(10).default(5),
  minOccurrences: z.coerce.number().positive().default(2),
  lookbackDays: z.coerce.number().positive().default(30),
  includeGraphRAG: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean().default(true)
  ),
});

export type GetTopWorkflowsRequest = z.infer<typeof getTopWorkflowsRequestSchema>;

/**
 * Response containing top workflow patterns
 */
export const topWorkflowsResultSchema = z.object({
  id: z.string().uuid(),
  userId: z.number(),
  nodeId: z.string().optional(), // Can be UUID or undefined
  patterns: z.array(topWorkflowPatternSchema),
  totalScreenshotsAnalyzed: z.number(),
  uniqueSequencesFound: z.number(),
  analyzedAt: z.string(), // ISO datetime string
  dataRangeStart: z.string(), // ISO datetime string
  dataRangeEnd: z.string(), // ISO datetime string
  searchStrategy: z.object({
    graphRAGUsed: z.boolean(),
    semanticSearchUsed: z.boolean(),
    bm25SearchUsed: z.boolean(),
    hybridWeight: z.number().optional(),
  }),
});

export type TopWorkflowsResult = z.infer<typeof topWorkflowsResultSchema>;

/**
 * Response for getting top workflows
 */
export const getTopWorkflowsResponseSchema = z.object({
  success: z.boolean(),
  data: topWorkflowsResultSchema.nullable(),
  message: z.string().optional(),
});

export type GetTopWorkflowsResponse = z.infer<typeof getTopWorkflowsResponseSchema>;
