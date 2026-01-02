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
  CrossSessionContextResponse,
  GetCrossSessionContextQuery,
  SearchEntitiesRequest,
  EntitySearchResponse,
  SearchConceptsRequest,
  ConceptSearchResponse,
  GraphRAGHealthResponse,
  GetTopWorkflowsRequest,
  TopWorkflowsResult,
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

// ============================================================================
// Graph RAG API Functions
// ============================================================================

/**
 * Get cross-session context from Graph RAG
 * Returns entities, concepts, patterns, and related sessions from previous work
 */
export async function getCrossSessionContext(
  nodeId: string,
  params?: GetCrossSessionContextQuery
): Promise<CrossSessionContextResponse> {
  const queryString = params
    ? `?${new URLSearchParams(params as any).toString()}`
    : '';

  const data = await httpClient.get<CrossSessionContextResponse>(
    `${BASE_URL}/${nodeId}/cross-session-context${queryString}`
  );

  return data;
}

/**
 * Search entities (technologies, tools, frameworks) by similarity
 */
export async function searchEntities(
  request: SearchEntitiesRequest
): Promise<EntitySearchResponse> {
  const data = await httpClient.post<EntitySearchResponse>(
    `${BASE_URL}/entities/search`,
    request
  );

  return data;
}

/**
 * Search concepts (programming patterns, activities) by similarity
 */
export async function searchConcepts(
  request: SearchConceptsRequest
): Promise<ConceptSearchResponse> {
  const data = await httpClient.post<ConceptSearchResponse>(
    `${BASE_URL}/concepts/search`,
    request
  );

  return data;
}

/**
 * Get health status of Graph RAG services (ArangoDB + PostgreSQL)
 */
export async function getGraphRAGHealth(): Promise<GraphRAGHealthResponse> {
  const data = await httpClient.get<GraphRAGHealthResponse>(
    `${BASE_URL}/health/graph`
  );

  return data;
}

// ============================================================================
// Top Workflow API Functions
// ============================================================================

/**
 * Get top/frequently repeated workflow patterns
 * Uses hybrid search (Graph RAG + semantic + BM25) to identify common patterns
 */
export async function getTopWorkflows(
  params?: Partial<GetTopWorkflowsRequest>
): Promise<TopWorkflowsResult | null> {
  const queryParams = new URLSearchParams();

  if (params?.limit) queryParams.set('limit', String(params.limit));
  if (params?.minOccurrences) queryParams.set('minOccurrences', String(params.minOccurrences));
  if (params?.lookbackDays) queryParams.set('lookbackDays', String(params.lookbackDays));
  if (params?.includeGraphRAG !== undefined) queryParams.set('includeGraphRAG', String(params.includeGraphRAG));

  const queryString = queryParams.toString();
  const url = `${BASE_URL}/top-workflows${queryString ? `?${queryString}` : ''}`;

  const data = await httpClient.get<TopWorkflowsResult>(url);
  return data || null;
}

/**
 * Get top workflow patterns for a specific node
 */
export async function getTopWorkflowsForNode(
  nodeId: string,
  params?: Partial<Omit<GetTopWorkflowsRequest, 'nodeId'>>
): Promise<TopWorkflowsResult | null> {
  const data = await httpClient.post<TopWorkflowsResult>(
    `${BASE_URL}/${nodeId}/top-workflows`,
    params || {}
  );

  return data || null;
}

// ============================================================================
// Hierarchical Workflow API Functions (3-Level Abstraction)
// Level 1: WorkflowPattern | Level 2: Block | Level 3: Step (drill-down)
// ============================================================================

export interface HierarchicalWorkflowsParams {
  limit?: number;
  minOccurrences?: number;
  minConfidence?: number;
  intentFilter?: string[];
  toolFilter?: string[];
  includeGlobal?: boolean;
}

export interface HierarchicalBlock {
  id: string;
  order: number;
  canonicalName: string;
  intent: string;
  primaryTool: string;
  toolVariants: string[];
  avgDurationSeconds: number;
  occurrenceCount: number;
  confidence: number;
  workflowTags: string[];
}

export interface BlockConnection {
  from: string;
  to: string;
  frequency: number;
  probability: number;
  strength: 'strong' | 'medium' | 'weak';
}

export interface HierarchicalWorkflowPattern {
  id: string;
  canonicalName: string;
  intentCategory: string;
  description: string;
  occurrenceCount: number;
  sessionCount: number;
  confidence: number;
  avgDurationSeconds: number;
  toolAgnostic: boolean;
  toolVariants: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  blocks: HierarchicalBlock[];
  blockConnections: BlockConnection[];
  tools: Array<{ name: string; category: string; usageCount: number }>;
  concepts: Array<{ name: string; category: string; relevance: number }>;
  recentSessions: Array<{ id: string; date: string; nodeTitle?: string }>;
}

// Full API response shape (before httpClient unwraps it)
export interface HierarchicalWorkflowsApiResponse {
  success: boolean;
  data: {
    workflows: HierarchicalWorkflowPattern[];
    metadata: {
      totalPatterns: number;
      queryParams: Record<string, any>;
      generatedAt: string;
    };
  } | null;
  message?: string;
}

// What httpClient.get returns after unwrapping .data
export interface HierarchicalWorkflowsResponse {
  workflows: HierarchicalWorkflowPattern[];
  metadata: {
    totalPatterns: number;
    queryParams: Record<string, any>;
    generatedAt: string;
  };
}

export interface BlockStep {
  id: string;
  order: number;
  actionType: string;
  description: string;
  rawInput: string | null;
  timestamp: string;
  confidence: number;
  screenshot: {
    id: number;
    thumbnailUrl: string;
    appName: string;
  } | null;
}

export interface BlockStepsResponse {
  success: boolean;
  data: {
    block: {
      id: string;
      canonicalName: string;
      intent: string;
      tool: string;
      duration: number;
      confidence: number;
    };
    steps: BlockStep[];
    metadata: {
      totalSteps: number;
      extractionMethod: string;
      lastExtracted: string;
    };
  } | null;
  message?: string;
}

export interface BlockTransitionsResponse {
  success: boolean;
  data: {
    blockSlug: string;
    outgoing: Array<{
      toBlock: string;
      frequency: number;
      probability: number;
      strength: string;
    }>;
    incoming: Array<{
      fromBlock: string;
      frequency: number;
      probability: number;
      strength: string;
    }>;
  } | null;
  message?: string;
}

/**
 * Get hierarchical top workflows (Level 1 + Level 2)
 * Returns workflow patterns with their constituent blocks
 */
export async function getHierarchicalTopWorkflows(
  params?: HierarchicalWorkflowsParams
): Promise<HierarchicalWorkflowsResponse> {
  const queryParams = new URLSearchParams();

  if (params?.limit) queryParams.set('limit', String(params.limit));
  if (params?.minOccurrences) queryParams.set('minOccurrences', String(params.minOccurrences));
  if (params?.minConfidence) queryParams.set('minConfidence', String(params.minConfidence));
  if (params?.intentFilter) queryParams.set('intentFilter', params.intentFilter.join(','));
  if (params?.toolFilter) queryParams.set('toolFilter', params.toolFilter.join(','));
  if (params?.includeGlobal !== undefined) queryParams.set('includeGlobal', String(params.includeGlobal));

  const queryString = queryParams.toString();
  const url = `${BASE_URL}/hierarchical/top-workflows${queryString ? `?${queryString}` : ''}`;

  const data = await httpClient.get<HierarchicalWorkflowsResponse>(url);
  return data;
}

/**
 * Get a single workflow pattern with blocks
 */
export async function getWorkflowPattern(
  workflowId: string
): Promise<{ success: boolean; data: HierarchicalWorkflowPattern | null; message?: string }> {
  const data = await httpClient.get<{ success: boolean; data: HierarchicalWorkflowPattern | null; message?: string }>(
    `${BASE_URL}/hierarchical/workflows/${workflowId}`
  );
  return data;
}

/**
 * Drill down into a block to get its steps (Level 3)
 */
export async function getBlockSteps(
  blockId: string,
  extractIfMissing: boolean = true
): Promise<BlockStepsResponse> {
  const url = `${BASE_URL}/hierarchical/blocks/${blockId}/steps?extractIfMissing=${extractIfMissing}`;
  const data = await httpClient.get<BlockStepsResponse>(url);
  return data;
}

/**
 * Get block transitions (incoming and outgoing)
 */
export async function getBlockTransitions(
  blockId: string
): Promise<BlockTransitionsResponse> {
  const data = await httpClient.get<BlockTransitionsResponse>(
    `${BASE_URL}/hierarchical/blocks/${blockId}/transitions`
  );
  return data;
}

/**
 * Extract blocks from a session's screenshots
 */
export async function extractBlocksFromSession(
  sessionId: string,
  screenshots: Array<{
    id: number;
    summary: string | null;
    analysis?: string | null;
    appName: string;
    timestamp: string;
    cloudUrl?: string;
  }>,
  forceReextract: boolean = false
): Promise<{
  success: boolean;
  data: {
    sessionId: string;
    blocksExtracted: number;
    blocks: Array<{
      id: string;
      canonicalName: string;
      intent: string;
      tool: string;
      screenshotCount: number;
      durationSeconds: number;
      confidence: number;
    }>;
  } | null;
  message?: string;
}> {
  const data = await httpClient.post(
    `${BASE_URL}/hierarchical/sessions/${sessionId}/extract-blocks`,
    { screenshots, forceReextract }
  );
  return data as any;
}
