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

import { httpClient } from './http-client';

const BASE_URL = '/api/v2/workflow-analysis';

/**
 * Get workflow analysis for a node
 */
export async function getWorkflowAnalysis(
  nodeId: string
): Promise<WorkflowAnalysisResult | null> {
  // httpClient.get already unwraps the response.data
  const data = await httpClient.get<GetWorkflowAnalysisResponse['data']>(
    `${BASE_URL}/${nodeId}`
  );

  return data || null;
}

/**
 * Trigger new workflow analysis for a node
 */
export async function triggerWorkflowAnalysis(
  nodeId: string,
  options?: Omit<TriggerWorkflowAnalysisRequest, 'nodeId'>
): Promise<WorkflowAnalysisResult | null> {
  await httpClient.post<TriggerWorkflowAnalysisResponse>(
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
  // httpClient.post already unwraps the response.data
  const data = await httpClient.post<HybridSearchResponse['data']>(
    `${BASE_URL}/search`,
    query
  );

  return { success: true, data };
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
  // httpClient.post already unwraps the response
  const result = await httpClient.post<{
    ingested: number;
    failed: number;
    screenshotIds: number[];
  }>(`${BASE_URL}/ingest`, data);

  return result;
}
