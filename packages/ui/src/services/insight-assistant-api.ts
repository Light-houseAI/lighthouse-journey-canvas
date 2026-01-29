/**
 * Insight Assistant API Service
 *
 * Client-side API functions for the Insight Assistant feature.
 * Includes both legacy proposals API and new multi-agent insight generation.
 */

import type {
  StrategyProposal,
  GenerateProposalsRequest,
  GenerateProposalsResponse,
  ProposalFeedbackRequest,
} from '../types/insight-assistant.types';
import { httpClient } from './http-client';

const BASE_URL = '/api/v2/insight-assistant';

// ============================================================================
// MULTI-AGENT INSIGHT GENERATION TYPES
// ============================================================================

export interface InsightGenerationOptions {
  nodeId?: string;
  lookbackDays?: number;
  includeWebSearch?: boolean;
  includePeerComparison?: boolean;
  includeCompanyDocs?: boolean;
  maxOptimizationBlocks?: number;
}

/** Current step in a transformation */
export interface CurrentStep {
  stepId: string;
  tool: string;
  durationSeconds: number;
  description: string;
}

/** Optimized step in a transformation */
export interface OptimizedStep {
  stepId: string;
  tool: string;
  estimatedDurationSeconds: number;
  description: string;
  claudeCodePrompt?: string;
  isNew: boolean;
  replacesSteps?: string[];
  /** Whether the suggested tool is already in the user's historical toolbox (tools they've used before) */
  isInUserToolbox?: boolean;
}

/** Step transformation within an optimization block */
export interface StepTransformation {
  transformationId: string;
  currentSteps: CurrentStep[];
  optimizedSteps: OptimizedStep[];
  timeSavedSeconds: number;
  confidence: number;
  rationale: string;
}

/** Optimization block (group of related transformations) */
export interface OptimizationBlock {
  blockId: string;
  workflowName: string;
  workflowId: string;
  currentTimeTotal: number;
  optimizedTimeTotal: number;
  timeSaved: number;
  relativeImprovement: number;
  confidence: number;
  /** Short, scannable title for the card header (5-8 words max) */
  title?: string;
  /** Detailed explanation of why this optimization matters */
  whyThisMatters: string;
  stepTransformations: StepTransformation[];
  source: 'peer' | 'web' | 'company_docs' | 'heuristic';
  citations?: {
    title: string;
    excerpt: string;
    url?: string;
  }[];
}

/** Step-level optimization plan */
export interface StepOptimizationPlan {
  blocks: OptimizationBlock[];
  totalTimeSaved: number;
  totalRelativeImprovement: number;
  passesThreshold: boolean;
  thresholdReason?: string;
}

/**
 * Attached session context for analysis
 * Contains full workflow/step data from user-selected sessions via @mention
 */
export interface AttachedSessionContext {
  sessionId: string;
  title: string;
  highLevelSummary?: string;
  workflows: {
    workflow_summary: string;
    semantic_steps: {
      step_name: string;
      description: string;
      duration_seconds: number;
      tools_involved: string[];
    }[];
    classification?: {
      level_1_intent: string;
      level_4_tools: string[];
    };
    timestamps?: { duration_ms: number };
  }[];
  totalDurationSeconds: number;
  appsUsed: string[];
}

export interface GenerateInsightsRequest {
  query: string;
  /** User-attached sessions for analysis (bypasses NLQ retrieval in A1) */
  sessionContext?: AttachedSessionContext[];
  options?: InsightGenerationOptions;
}

export interface GenerateInsightsResponse {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
}

export interface JobProgress {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentStage: string;
}

/**
 * FIX-9: Agent execution diagnostics for transparency
 */
export interface AgentDiagnostics {
  /** Which agents were scheduled to run based on query classification */
  agentsScheduled: string[];
  /** Which agents actually ran successfully */
  agentsRan: string[];
  /** Agents that were skipped (with reasons) */
  agentsSkipped: Array<{
    agentId: string;
    reason: string;
  }>;
  /** Source breakdown: how many blocks came from each source */
  sourceBreakdown: Record<string, number>;
  /** Whether heuristic fallback was used (when A3 skipped) */
  usedHeuristicFallback: boolean;
  /** Total processing time in milliseconds */
  totalProcessingMs?: number;
}

/**
 * Feature adoption tip from A5 agent
 * Suggests underused features within tools the user already has
 * Displayed separately as "Workflow Tips" (not as step transformations)
 */
export interface FeatureAdoptionTip {
  tipId: string;
  /** Tool name (must be from user's toolbox) */
  toolName: string;
  /** Specific feature name within the tool */
  featureName: string;
  /** How to activate the feature (shortcut, command, etc.) */
  triggerOrShortcut: string;
  /** User-friendly, non-intrusive message explaining the suggestion */
  message: string;
  /** What workflow pattern/behavior this addresses */
  addressesPattern: string;
  /** Estimated time saved per use in seconds */
  estimatedSavingsSeconds: number;
  /** Confidence score (0-1) */
  confidence: number;
}

export interface InsightGenerationResult {
  queryId: string;
  query: string;
  userId: number;
  /** Direct answer to the user's query generated from aggregated agent context */
  userQueryAnswer: string;
  /** Executive Summary with key metrics */
  executiveSummary: {
    totalTimeReduced: number;
    totalRelativeImprovement: number;
    topInefficiencies: string[];
    claudeCodeInsertionPoints: string[];
    passesQualityThreshold: boolean;
  };
  /** Optimization strategies with detailed blocks */
  optimizationPlan?: StepOptimizationPlan;
  createdAt: string;
  completedAt: string;
  /** LLM-generated follow-up questions based on the analysis context */
  suggestedFollowUps?: string[];
  /** FIX-9: Diagnostics about which agents ran and their contribution */
  agentDiagnostics?: AgentDiagnostics;
  /** A5: Feature adoption tips - displayed separately as "Workflow Tips" */
  featureAdoptionTips?: FeatureAdoptionTip[];
}

export interface InsightJob {
  id: string;
  userId: number;
  query: string;
  options?: InsightGenerationOptions;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentStage: string;
  result?: InsightGenerationResult;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

// ============================================================================
// MULTI-AGENT API FUNCTIONS
// ============================================================================

/**
 * Start an async multi-agent insight generation job
 */
export async function startInsightGeneration(
  request: GenerateInsightsRequest
): Promise<GenerateInsightsResponse> {
  const data = await httpClient.post<GenerateInsightsResponse>(
    `${BASE_URL}/generate`,
    request
  );
  return data;
}

/**
 * Get job status and result
 */
export async function getInsightJob(jobId: string): Promise<InsightJob> {
  const data = await httpClient.get<InsightJob>(`${BASE_URL}/jobs/${jobId}`);
  return data;
}

/**
 * Poll for job completion (alternative to SSE)
 */
export async function pollForJobCompletion(
  jobId: string,
  onProgress?: (progress: JobProgress) => void,
  pollIntervalMs: number = 1000,
  maxAttempts: number = 120
): Promise<InsightJob> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const job = await getInsightJob(jobId);

    if (onProgress) {
      onProgress({
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        currentStage: job.currentStage,
      });
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return job;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    attempts++;
  }

  throw new Error('Job polling timeout');
}

/**
 * Generate quick insights synchronously (simpler, faster)
 */
export async function generateQuickInsights(
  request: GenerateInsightsRequest
): Promise<InsightGenerationResult | null> {
  const data = await httpClient.post<{ result: InsightGenerationResult | null }>(
    `${BASE_URL}/quick-insights`,
    request
  );
  return data.result;
}

/**
 * Cancel a running insight generation job
 */
export async function cancelInsightJob(jobId: string): Promise<{ cancelled: boolean }> {
  const data = await httpClient.delete<{ cancelled: boolean }>(
    `${BASE_URL}/jobs/${jobId}`
  );
  return data;
}

// ============================================================================
// PERSONA-BASED SUGGESTIONS API
// ============================================================================

export type PersonaType = 'work' | 'personal_project' | 'job_search' | 'learning';

export interface PersonaSuggestion {
  id: string;
  personaType: PersonaType;
  personaDisplayName: string;
  nodeId: string;
  suggestedQuery: string;
  buttonLabel: string;
  reasoning: string;
  priority: number;
}

export interface PersonaSummary {
  type: PersonaType;
  displayName: string;
  nodeId: string;
  isActive: boolean;
}

export interface WorkflowCTA {
  label: string;
  text: string;
}

export interface GetPersonaSuggestionsResponse {
  suggestions: PersonaSuggestion[];
  activePersonas: PersonaSummary[];
  cta: WorkflowCTA | null;
}

/**
 * Get persona-based query suggestions
 * Returns contextual suggestions based on user's active personas
 */
export async function getPersonaSuggestions(options?: {
  limit?: number;
  personaTypes?: PersonaType[];
}): Promise<GetPersonaSuggestionsResponse> {
  const params = new URLSearchParams();
  if (options?.limit) {
    params.set('limit', String(options.limit));
  }
  if (options?.personaTypes && options.personaTypes.length > 0) {
    params.set('personaTypes', options.personaTypes.join(','));
  }

  const queryString = params.toString();
  const url = queryString
    ? `${BASE_URL}/suggestions?${queryString}`
    : `${BASE_URL}/suggestions`;

  const data = await httpClient.get<GetPersonaSuggestionsResponse>(url);
  return data;
}

// ============================================================================
// LEGACY PROPOSALS API (still works, simpler single-LLM approach)
// ============================================================================

/**
 * Generate strategy proposals based on a query
 */
export async function generateProposals(
  request: GenerateProposalsRequest
): Promise<GenerateProposalsResponse> {
  const data = await httpClient.post<{
    proposals: StrategyProposal[];
    queryId: string;
  }>(`${BASE_URL}/proposals`, request);

  return data;
}

/**
 * Submit feedback for a strategy proposal
 */
export async function submitProposalFeedback(
  proposalId: string,
  feedback: ProposalFeedbackRequest
): Promise<{
  proposalId: string;
  feedback: 'up' | 'down' | null;
  isBookmarked: boolean;
}> {
  const data = await httpClient.post<{
    proposalId: string;
    feedback: 'up' | 'down' | null;
    isBookmarked: boolean;
  }>(`${BASE_URL}/proposals/${proposalId}/feedback`, feedback);

  return data;
}

/**
 * Get saved/bookmarked proposals
 */
export async function getProposals(options?: {
  bookmarkedOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{
  proposals: StrategyProposal[];
  total: number;
  hasMore: boolean;
}> {
  const params = new URLSearchParams();
  if (options?.bookmarkedOnly) {
    params.set('bookmarkedOnly', 'true');
  }
  if (options?.limit) {
    params.set('limit', String(options.limit));
  }
  if (options?.offset) {
    params.set('offset', String(options.offset));
  }

  const queryString = params.toString();
  const url = queryString
    ? `${BASE_URL}/proposals?${queryString}`
    : `${BASE_URL}/proposals`;

  const data = await httpClient.get<{
    proposals: StrategyProposal[];
    total: number;
    hasMore: boolean;
  }>(url);

  return data;
}
