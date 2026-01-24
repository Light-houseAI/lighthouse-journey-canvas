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
// DIAGNOSTICS SCHEMAS (A2 Output)
// ============================================================================

export const inefficiencyTypeSchema = z.enum([
  'repetitive_search',
  'context_switching',
  'rework_loop',
  'manual_automation',
  'idle_time',
  'tool_fragmentation',
  'information_gathering',
  'other',
]);

export const inefficiencySchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  stepIds: z.array(z.string()),
  type: inefficiencyTypeSchema,
  description: z.string(),
  estimatedWastedSeconds: z.number(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
});

export const opportunityTypeSchema = z.enum([
  'automation',
  'consolidation',
  'tool_switch',
  'workflow_reorder',
  'elimination',
  'claude_code_integration',
]);

export const opportunitySchema = z.object({
  id: z.string(),
  inefficiencyId: z.string(),
  type: opportunityTypeSchema,
  description: z.string(),
  estimatedSavingsSeconds: z.number(),
  suggestedTool: z.string().optional(),
  claudeCodeApplicable: z.boolean(),
  confidence: z.number().min(0).max(1),
});

export const workflowMetricsSchema = z.object({
  totalWorkflowTime: z.number(),
  activeTime: z.number(),
  idleTime: z.number(),
  contextSwitches: z.number(),
  reworkLoops: z.number(),
  uniqueToolsUsed: z.number(),
  toolDistribution: z.record(z.number()),
  workflowTagDistribution: z.record(z.number()),
  averageStepDuration: z.number(),
});

export const diagnosticsSchema = z.object({
  workflowId: z.string(),
  workflowName: z.string(),
  metrics: workflowMetricsSchema,
  inefficiencies: z.array(inefficiencySchema),
  opportunities: z.array(opportunitySchema),
  overallEfficiencyScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  analysisTimestamp: z.string(),
});

// ============================================================================
// STEP OPTIMIZATION SCHEMAS (A3/A4 Output)
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
  executiveSummary: executiveSummarySchema,
  optimizationPlan: stepOptimizationPlanSchema,
  finalOptimizedWorkflow: z.array(finalWorkflowStepSchema),
  supportingEvidence: supportingEvidenceSchema,
  metadata: insightGenerationMetadataSchema,
  createdAt: z.string(),
  completedAt: z.string(),
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
  'A2_JUDGE',
  'A3_COMPARATOR',
  'A4_WEB',
  'A4_COMPANY',
]);

export const routingDecisionSchema = z.object({
  agentsToRun: z.array(agentIdSchema),
  reason: z.string(),
  peerDataUsable: z.boolean(),
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
  includePeerComparison: z.boolean().default(true),
  includeCompanyDocs: z.boolean().default(true),
  maxOptimizationBlocks: z.number().int().min(1).max(20).default(5),
});

export const generateInsightsRequestSchema = z.object({
  query: z.string().min(10).max(2000),
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
export type InefficiencyType = z.infer<typeof inefficiencyTypeSchema>;
export type Inefficiency = z.infer<typeof inefficiencySchema>;
export type OpportunityType = z.infer<typeof opportunityTypeSchema>;
export type Opportunity = z.infer<typeof opportunitySchema>;
export type WorkflowMetrics = z.infer<typeof workflowMetricsSchema>;
export type Diagnostics = z.infer<typeof diagnosticsSchema>;
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
export type GenerateInsightsRequest = z.infer<typeof generateInsightsRequestSchema>;
export type GenerateInsightsResponse = z.infer<typeof generateInsightsResponseSchema>;
