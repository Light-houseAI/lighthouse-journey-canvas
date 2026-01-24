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

export interface GenerateInsightsRequest {
  query: string;
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

export interface OptimizationBlock {
  blockId: string;
  workflowName: string;
  workflowId: string;
  currentTimeTotal: number;
  optimizedTimeTotal: number;
  timeSaved: number;
  relativeImprovement: number;
  confidence: number;
  whyThisMatters: string;
  stepTransformations: StepTransformation[];
  source: 'peer_comparison' | 'web_best_practice' | 'company_docs' | 'heuristic';
}

export interface StepTransformation {
  transformationId: string;
  currentSteps: { stepId: string; tool: string; durationSeconds: number; description: string }[];
  optimizedSteps: {
    stepId: string;
    tool: string;
    estimatedDurationSeconds: number;
    description: string;
    claudeCodePrompt?: string;
    isNew: boolean;
  }[];
  timeSavedSeconds: number;
  confidence: number;
  rationale: string;
}

export interface InsightGenerationResult {
  queryId: string;
  query: string;
  userId: number;
  /** Direct answer to the user's query generated from aggregated agent context */
  userQueryAnswer: string;
  executiveSummary: {
    totalTimeReduced: number;
    totalRelativeImprovement: number;
    topInefficiencies: string[];
    claudeCodeInsertionPoints: string[];
    passesQualityThreshold: boolean;
  };
  optimizationPlan: {
    blocks: OptimizationBlock[];
    totalTimeSaved: number;
    totalRelativeImprovement: number;
    passesThreshold: boolean;
    thresholdReason?: string;
  };
  finalOptimizedWorkflow: {
    stepId: string;
    order: number;
    tool: string;
    description: string;
    estimatedDurationSeconds: number;
    isNew: boolean;
    claudeCodePrompt?: string;
  }[];
  supportingEvidence: {
    userStepReferences: string[];
    companyDocCitations?: { title: string; excerpt: string; url?: string }[];
    externalSources?: { url: string; title: string; relevance: string }[];
  };
  metadata: {
    queryId: string;
    agentsUsed: string[];
    totalProcessingTimeMs: number;
    peerDataAvailable: boolean;
    companyDocsAvailable: boolean;
    webSearchUsed: boolean;
  };
  createdAt: string;
  completedAt: string;
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
