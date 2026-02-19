/**
 * Insight Generation Zod Schemas
 *
 * Runtime validation schemas for agent inputs/outputs.
 * These schemas ensure type safety across the multi-agent pipeline.
 */

import { z } from 'zod';

// ============================================================================
// QUALITY THRESHOLDS
// ============================================================================

export const qualityThresholdsSchema = z.object({
  absoluteSavingsSeconds: z.number().default(600), // 10 minutes
  relativeSavingsPercent: z.number().default(40), // 40%
  minAbsoluteSeconds: z.number().default(120), // 2 minutes
  minRelativePercent: z.number().default(10), // 10%
  minConfidence: z.number().default(0.6),
});

// ============================================================================
// USER STEP & WORKFLOW SCHEMAS
// ============================================================================

export const userStepSchema = z.object({
  stepId: z.string(),
  description: z.string(),
  tool: z.string(),
  toolCategory: z.string().optional(),
  durationSeconds: z.number(),
  timestamp: z.string(),
  workflowTag: z.string(),
  order: z.number(),
  metadata: z.record(z.any()).optional(),
});

export const userWorkflowSchema = z.object({
  workflowId: z.string(),
  name: z.string(),
  intent: z.string(),
  approach: z.string(),
  steps: z.array(userStepSchema),
  totalDurationSeconds: z.number(),
  tools: z.array(z.string()),
  sessionId: z.string(),
  startTime: z.string(),
  endTime: z.string(),
});

export const sessionInfoSchema = z.object({
  sessionId: z.string(),
  summary: z.string(),
  startTime: z.string(),
  endTime: z.string().optional(),
  durationSeconds: z.number(),
  workflowCount: z.number(),
});

export const extractedEntitySchema = z.object({
  name: z.string(),
  type: z.enum(['technology', 'tool', 'person', 'organization', 'concept', 'other']),
  frequency: z.number(),
  confidence: z.number(),
});

export const extractedConceptSchema = z.object({
  name: z.string(),
  category: z.string(),
  relevanceScore: z.number(),
});

export const evidenceBundleSchema = z.object({
  workflows: z.array(userWorkflowSchema),
  sessions: z.array(sessionInfoSchema),
  entities: z.array(extractedEntitySchema),
  concepts: z.array(extractedConceptSchema),
  totalStepCount: z.number(),
  totalDurationSeconds: z.number(),
  retrievalMetadata: z.object({
    queryTimeMs: z.number(),
    sourcesRetrieved: z.number(),
    retrievalMethod: z.enum(['hybrid', 'graph', 'vector']),
    embeddingModel: z.string(),
  }),
});

// ============================================================================
// STEP OPTIMIZATION SCHEMAS (A4 Output)
// ============================================================================

export const currentStepSchema = z.object({
  stepId: z.string(),
  tool: z.string(),
  durationSeconds: z.number(),
  description: z.string(),
});

export const optimizedStepSchema = z.object({
  stepId: z.string(),
  tool: z.string(),
  estimatedDurationSeconds: z.number(),
  description: z.string(),
  claudeCodePrompt: z.string().optional(),
  isNew: z.boolean(),
  replacesSteps: z.array(z.string()).optional(),
});

export const stepTransformationSchema = z.object({
  transformationId: z.string(),
  currentSteps: z.array(currentStepSchema),
  optimizedSteps: z.array(optimizedStepSchema),
  timeSavedSeconds: z.number(),
  confidence: z.number().min(0).max(1),
  rationale: z.string(),
});

export const metricDeltasSchema = z.object({
  contextSwitchesReduction: z.number().optional(),
  reworkLoopsReduction: z.number().optional(),
  idleTimeReduction: z.number().optional(),
  toolCountReduction: z.number().optional(),
});

export const optimizationSourceSchema = z.enum([
  'peer_comparison',
  'web_best_practice',
  'company_docs',
  'heuristic',
]);

export const citationSchema = z.object({
  documentId: z.string().optional(),
  title: z.string(),
  excerpt: z.string(),
  url: z.string().optional(),
  pageNumber: z.number().optional(),
});

export const optimizationBlockSchema = z.object({
  blockId: z.string(),
  workflowName: z.string(),
  workflowId: z.string(),
  currentTimeTotal: z.number(),
  optimizedTimeTotal: z.number(),
  timeSaved: z.number(),
  relativeImprovement: z.number(),
  confidence: z.number().min(0).max(1),
  whyThisMatters: z.string(),
  metricDeltas: metricDeltasSchema,
  stepTransformations: z.array(stepTransformationSchema),
  source: optimizationSourceSchema,
  citations: z.array(citationSchema).optional(),
  /** True when this is a NEW workflow suggestion, not an optimization of existing user workflow */
  isNewWorkflowSuggestion: z.boolean().optional(),
});

export const stepOptimizationPlanSchema = z.object({
  blocks: z.array(optimizationBlockSchema),
  totalTimeSaved: z.number(),
  totalRelativeImprovement: z.number(),
  passesThreshold: z.boolean(),
  thresholdReason: z.string().optional(),
});

// ============================================================================
// FINAL OUTPUT SCHEMAS
// ============================================================================

export const executiveSummarySchema = z.object({
  totalTimeReduced: z.number(),
  totalRelativeImprovement: z.number(),
  topInefficiencies: z.array(z.string()),
  claudeCodeInsertionPoints: z.array(z.string()),
  passesQualityThreshold: z.boolean(),
});

export const finalWorkflowStepSchema = z.object({
  stepId: z.string(),
  order: z.number(),
  tool: z.string(),
  description: z.string(),
  estimatedDurationSeconds: z.number(),
  isNew: z.boolean(),
  replacesSteps: z.array(z.string()).optional(),
  claudeCodePrompt: z.string().optional(),
});

export const externalSourceSchema = z.object({
  url: z.string(),
  title: z.string(),
  relevance: z.string(),
  fetchedAt: z.string(),
});

export const supportingEvidenceSchema = z.object({
  userStepReferences: z.array(z.string()),
  companyDocCitations: z.array(citationSchema).optional(),
  externalSources: z.array(externalSourceSchema).optional(),
  peerWorkflowPatterns: z.array(z.string()).optional(),
});

export const insightGenerationMetadataSchema = z.object({
  queryId: z.string(),
  agentsUsed: z.array(z.string()),
  totalProcessingTimeMs: z.number(),
  peerDataAvailable: z.boolean(),
  companyDocsAvailable: z.boolean(),
  webSearchUsed: z.boolean(),
  llmTokensUsed: z.number().optional(),
  modelVersion: z.string(),
});

export const insightGenerationResultSchema = z.object({
  queryId: z.string(),
  query: z.string(),
  userId: z.number(),
  userQueryAnswer: z.string(),
  executiveSummary: executiveSummarySchema,
  optimizationPlan: stepOptimizationPlanSchema.optional(),
  createdAt: z.string(),
  completedAt: z.string(),
  suggestedFollowUps: z.array(z.string()).optional(),
});

// ============================================================================
// CRITIQUE LOOP SCHEMAS
// ============================================================================

export const critiqueIssueTypeSchema = z.enum([
  'insufficient_evidence',
  'pii_detected',
  'low_confidence',
  'missing_citations',
  'generic_advice',
]);

export const critiqueIssueSchema = z.object({
  type: critiqueIssueTypeSchema,
  description: z.string(),
  severity: z.enum(['error', 'warning']),
  affectedIds: z.array(z.string()).optional(),
});

export const critiqueResultSchema = z.object({
  passed: z.boolean(),
  issues: z.array(critiqueIssueSchema),
  canRetry: z.boolean(),
  retryCount: z.number(),
  maxRetries: z.number(),
});

// ============================================================================
// ROUTING & ORCHESTRATION SCHEMAS
// ============================================================================

export const agentIdSchema = z.enum([
  'A1_RETRIEVAL',
  'A4_WEB',
  'A4_COMPANY',
]);

export const routingDecisionSchema = z.object({
  agentsToRun: z.array(agentIdSchema),
  reason: z.string(),
  companyDocsAvailable: z.boolean(),
});

export const jobStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
]);

export const jobProgressSchema = z.object({
  jobId: z.string(),
  status: jobStatusSchema,
  progress: z.number().min(0).max(100),
  currentStage: z.string(),
  stageDetails: z.string().optional(),
  estimatedRemainingMs: z.number().optional(),
});

// ============================================================================
// REQUEST/RESPONSE SCHEMAS
// ============================================================================

export const insightGenerationOptionsSchema = z.object({
  nodeId: z.string().uuid().optional(),
  lookbackDays: z.number().int().min(7).max(90).default(30),
  includeWebSearch: z.boolean().default(true),
  includeCompanyDocs: z.boolean().default(true),
  maxOptimizationBlocks: z.number().int().min(1).max(20).default(5),
});

// ============================================================================
// ATTACHED SESSION CONTEXT SCHEMAS
// ============================================================================

/**
 * Schema for semantic steps within attached workflows
 */
export const attachedSemanticStepSchema = z.object({
  step_name: z.string(),
  description: z.string(),
  duration_seconds: z.number(),
  tools_involved: z.array(z.string()),
});

/**
 * Schema for workflows within attached sessions
 */
export const attachedWorkflowSchema = z.object({
  workflow_summary: z.string(),
  semantic_steps: z.array(attachedSemanticStepSchema),
  classification: z.object({
    level_1_intent: z.string(),
    level_4_tools: z.array(z.string()),
  }).optional(),
  timestamps: z.object({
    duration_ms: z.number(),
  }).optional(),
});

/**
 * Schema for user-attached session context
 * Used when users explicitly select sessions via @mention
 */
export const attachedSessionContextSchema = z.object({
  sessionId: z.string(),
  title: z.string(),
  highLevelSummary: z.string().optional(),
  workflows: z.array(attachedWorkflowSchema),
  totalDurationSeconds: z.number(),
  appsUsed: z.array(z.string()),
});

// ============================================================================
// ATTACHED WORKFLOW/BLOCK CONTEXT SCHEMAS (for / mention)
// ============================================================================

/**
 * Schema for user-attached workflow pattern context
 * Used when users explicitly select workflows via /mention
 */
export const attachedWorkflowContextSchema = z.object({
  type: z.literal('workflow'),
  workflowId: z.string(),
  canonicalName: z.string(),
  intentCategory: z.string(),
  description: z.string(),
  occurrenceCount: z.number(),
  sessionCount: z.number(),
  avgDurationSeconds: z.number(),
  blocks: z.array(z.object({
    canonicalName: z.string(),
    intent: z.string(),
    primaryTool: z.string(),
    avgDurationSeconds: z.number(),
  })),
  tools: z.array(z.string()),
});

/**
 * Schema for user-attached block/step context
 * Used when users select individual steps via /mention detail view
 */
export const attachedBlockContextSchema = z.object({
  type: z.literal('block'),
  blockId: z.string(),
  canonicalName: z.string(),
  intent: z.string(),
  primaryTool: z.string(),
  avgDurationSeconds: z.number(),
  parentWorkflowId: z.string(),
  parentWorkflowName: z.string(),
});

export const attachedSlashContextSchema = z.discriminatedUnion('type', [
  attachedWorkflowContextSchema,
  attachedBlockContextSchema,
]);

export const generateInsightsRequestSchema = z.object({
  query: z.string().min(10).max(2000),
  /** User-attached sessions for analysis (bypasses NLQ retrieval in A1) */
  sessionContext: z.array(attachedSessionContextSchema).optional(),
  /** User-attached workflows/steps for analysis via /mention */
  workflowContext: z.array(attachedSlashContextSchema).optional(),
  options: insightGenerationOptionsSchema.optional(),
});

export const generateInsightsResponseSchema = z.object({
  jobId: z.string().uuid(),
  status: jobStatusSchema,
  estimatedDurationMs: z.number().optional(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type QualityThresholds = z.infer<typeof qualityThresholdsSchema>;
export type UserStep = z.infer<typeof userStepSchema>;
export type UserWorkflow = z.infer<typeof userWorkflowSchema>;
export type SessionInfo = z.infer<typeof sessionInfoSchema>;
export type ExtractedEntity = z.infer<typeof extractedEntitySchema>;
export type ExtractedConcept = z.infer<typeof extractedConceptSchema>;
export type EvidenceBundle = z.infer<typeof evidenceBundleSchema>;
export type CurrentStep = z.infer<typeof currentStepSchema>;
export type OptimizedStep = z.infer<typeof optimizedStepSchema>;
export type StepTransformation = z.infer<typeof stepTransformationSchema>;
export type MetricDeltas = z.infer<typeof metricDeltasSchema>;
export type OptimizationSource = z.infer<typeof optimizationSourceSchema>;
export type Citation = z.infer<typeof citationSchema>;
export type OptimizationBlock = z.infer<typeof optimizationBlockSchema>;
export type StepOptimizationPlan = z.infer<typeof stepOptimizationPlanSchema>;
export type ExecutiveSummary = z.infer<typeof executiveSummarySchema>;
export type FinalWorkflowStep = z.infer<typeof finalWorkflowStepSchema>;
export type ExternalSource = z.infer<typeof externalSourceSchema>;
export type SupportingEvidence = z.infer<typeof supportingEvidenceSchema>;
export type InsightGenerationMetadata = z.infer<typeof insightGenerationMetadataSchema>;
export type InsightGenerationResult = z.infer<typeof insightGenerationResultSchema>;
export type CritiqueIssueType = z.infer<typeof critiqueIssueTypeSchema>;
export type CritiqueIssue = z.infer<typeof critiqueIssueSchema>;
export type CritiqueResult = z.infer<typeof critiqueResultSchema>;
export type AgentId = z.infer<typeof agentIdSchema>;
export type RoutingDecision = z.infer<typeof routingDecisionSchema>;
export type JobStatus = z.infer<typeof jobStatusSchema>;
export type JobProgress = z.infer<typeof jobProgressSchema>;
export type InsightGenerationOptions = z.infer<typeof insightGenerationOptionsSchema>;
export type AttachedSemanticStep = z.infer<typeof attachedSemanticStepSchema>;
export type AttachedWorkflow = z.infer<typeof attachedWorkflowSchema>;
export type AttachedSessionContext = z.infer<typeof attachedSessionContextSchema>;
export type AttachedWorkflowContext = z.infer<typeof attachedWorkflowContextSchema>;
export type AttachedBlockContext = z.infer<typeof attachedBlockContextSchema>;
export type AttachedSlashContext = z.infer<typeof attachedSlashContextSchema>;
export type GenerateInsightsRequest = z.infer<typeof generateInsightsRequestSchema>;
export type GenerateInsightsResponse = z.infer<typeof generateInsightsResponseSchema>;
