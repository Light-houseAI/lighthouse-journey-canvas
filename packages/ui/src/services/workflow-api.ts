/**
 * Workflow Analysis API Service
 *
 * Client-side API functions for workflow analysis endpoints
 */

import type {
  GetWorkflowAnalysisResponse,
  TriggerWorkflowAnalysisRequest,
  TriggerWorkflowAnalysisResponse,
  WorkflowAnalysisResult,
  HybridSearchQuery,
  HybridSearchResponse,
} from '@journey/schema';

import { apiClient } from './api-client';

const BASE_URL = '/api/v2/workflow-analysis';

/**
 * Get workflow analysis for a node
 */
export async function getWorkflowAnalysis(
  nodeId: string
): Promise<WorkflowAnalysisResult | null> {
  const response = await apiClient.get<GetWorkflowAnalysisResponse>(
    `${BASE_URL}/${nodeId}`
  );

  return response.data || null;
}

/**
 * Trigger new workflow analysis for a node
 */
export async function triggerWorkflowAnalysis(
  nodeId: string,
  options?: Omit<TriggerWorkflowAnalysisRequest, 'nodeId'>
): Promise<WorkflowAnalysisResult | null> {
  await apiClient.post<TriggerWorkflowAnalysisResponse>(
    `${BASE_URL}/${nodeId}/trigger`,
    options || {}
  );

  // After triggering, fetch the result
  return getWorkflowAnalysis(nodeId);
}

/**
 * Perform hybrid search across workflow screenshots
 */
export async function hybridSearchWorkflow(
  query: HybridSearchQuery
): Promise<HybridSearchResponse> {
  const response = await apiClient.post<HybridSearchResponse>(
    `${BASE_URL}/search`,
    query
  );

  return response;
}

/**
 * Ingest screenshots from Desktop-companion (called from desktop app, not UI)
 */
export async function ingestScreenshots(data: {
  sessionId: string;
  nodeId: string;
  screenshots: Array<{
    path: string;
    timestamp: number;
    cloudUrl?: string;
    summary?: string;
    context?: Record<string, any>;
  }>;
}): Promise<{ ingested: number; failed: number; screenshotIds: number[] }> {
  const response = await apiClient.post<{
    success: boolean;
    ingested: number;
    failed: number;
    screenshotIds: number[];
  }>(`${BASE_URL}/ingest`, data);

  return {
    ingested: response.ingested,
    failed: response.failed,
    screenshotIds: response.screenshotIds,
  };
}
