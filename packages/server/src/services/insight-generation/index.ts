/**
 * Insight Generation Multi-Agent System
 *
 * This module implements the insight generation pipeline with:
 * - A1: Retrieval Agent (Hybrid RAG)
 * - A2: Judge Agent (LLM-as-judge)
 * - A3: Comparator Agent (Peer comparison)
 * - A4-Web: Web Best Practices Agent (Perplexity)
 * - A4-Company: Company Docs Agent (PyMUPDF + RAG)
 *
 * @module insight-generation
 */

// Types (primary type definitions)
export * from './types.js';

// Schemas (Zod schemas only, not type re-exports to avoid conflicts)
export {
  // Quality thresholds
  qualityThresholdsSchema,
  // User data schemas
  userStepSchema,
  userWorkflowSchema,
  sessionInfoSchema,
  extractedEntitySchema,
  extractedConceptSchema,
  evidenceBundleSchema,
  // Diagnostics schemas
  inefficiencyTypeSchema,
  inefficiencySchema,
  opportunityTypeSchema,
  opportunitySchema,
  workflowMetricsSchema,
  diagnosticsSchema,
  // Optimization schemas
  currentStepSchema,
  optimizedStepSchema,
  stepTransformationSchema,
  metricDeltasSchema,
  optimizationSourceSchema,
  citationSchema,
  optimizationBlockSchema,
  stepOptimizationPlanSchema,
  // Final output schemas
  executiveSummarySchema,
  finalWorkflowStepSchema,
  externalSourceSchema,
  supportingEvidenceSchema,
  insightGenerationMetadataSchema,
  insightGenerationResultSchema,
  // Critique schemas
  critiqueIssueTypeSchema,
  critiqueIssueSchema,
  critiqueResultSchema,
  // Routing schemas
  agentIdSchema,
  routingDecisionSchema,
  jobStatusSchema,
  jobProgressSchema,
  // Request/response schemas
  insightGenerationOptionsSchema,
  generateInsightsRequestSchema,
  generateInsightsResponseSchema,
  // Attached workflow/block context schemas (for /mention)
  attachedWorkflowContextSchema,
  attachedBlockContextSchema,
  attachedSlashContextSchema,
} from './schemas.js';

// Services
export { WorkflowAnonymizerService } from './workflow-anonymizer.service.js';
export type {
  RawSessionData,
  AnonymizedWorkflowPattern,
  AnonymizedStepPattern,
  AnonymizedStepSequence,
} from './workflow-anonymizer.service.js';
export { InsightGenerationService } from './insight-generation.service.js';
export type {
  InsightGenerationServiceDeps,
  InsightJob,
} from './insight-generation.service.js';
export { MemoryService, createMemoryService } from './memory.service.js';
export type {
  MemoryServiceConfig,
  MemoryServiceDeps,
  MemoryEntry,
  MemoryMetadata,
  AddMemoryInput,
  SearchMemoryInput,
  MemorySearchResult,
} from './memory.service.js';

// Graphs (LangGraph implementations)
export { createRetrievalGraph } from './graphs/retrieval-graph.js';
export type { RetrievalGraphDeps } from './graphs/retrieval-graph.js';
export { createJudgeGraph } from './graphs/judge-graph.js';
export type { JudgeGraphDeps } from './graphs/judge-graph.js';
export { createOrchestratorGraph } from './graphs/orchestrator-graph.js';
export type { OrchestratorGraphDeps } from './graphs/orchestrator-graph.js';
export { createComparatorGraph } from './graphs/comparator-graph.js';
export type { ComparatorGraphDeps } from './graphs/comparator-graph.js';
export { createWebBestPracticesGraph } from './graphs/web-best-practices-graph.js';
export type { WebBestPracticesGraphDeps } from './graphs/web-best-practices-graph.js';
export { createCompanyDocsGraph } from './graphs/company-docs-graph.js';
export type { CompanyDocsGraphDeps } from './graphs/company-docs-graph.js';

// State
export { InsightStateAnnotation, type InsightState } from './state/insight-state.js';

// Utils
export { LangChainAdapter } from './utils/langchain-adapter.js';
