/**
 * Query Tracing Types
 *
 * Types for the internal query tracing dashboard that provides
 * visibility into the insight generation pipeline.
 */

// ============================================================================
// ENUMS
// ============================================================================

export type QueryTraceStatus = 'started' | 'completed' | 'failed';
export type AgentTraceStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type AgentId =
  | 'QUERY_CLASSIFIER'
  | 'A1_RETRIEVAL'
  | 'A2_JUDGE'
  | 'A3_COMPARATOR'
  | 'A4_WEB'
  | 'A4_COMPANY'
  | 'A5_FEATURE_ADOPTION';

// ============================================================================
// QUERY CLASSIFICATION
// ============================================================================

export interface QueryClassification {
  scope: string;
  intent: string;
  specificity: string;
  filters: Record<string, unknown>;
  routing: {
    maxResults: number;
    agentsToRun: string[];
    includePeerComparison: boolean;
    includeWebSearch: boolean;
    includeFeatureAdoption: boolean;
    useSemanticSearch: boolean;
  };
  confidence: number;
  reasoning: string;
}

export interface RoutingDecision {
  agentsToRun: string[];
  reason: string;
  peerDataUsable: boolean;
  companyDocsAvailable: boolean;
}

// ============================================================================
// AGENT TRACES
// ============================================================================

export interface AgentInputSummary {
  stateSnapshot: {
    hasUserEvidence: boolean;
    userEvidenceWorkflowCount?: number;
    userEvidenceStepCount?: number;
    hasPeerEvidence: boolean;
    peerEvidenceWorkflowCount?: number;
    hasUserDiagnostics: boolean;
    inefficiencyCount?: number;
    opportunityCount?: number;
    efficiencyScore?: number;
  };
  relevantInputFields: string[];
}

export interface AgentOutputSummary {
  stateChanges: string[];
  keyMetrics: Record<string, number | string | boolean>;
  errorsEncountered: string[];
}

export interface CritiqueResult {
  passed: boolean;
  issues: Array<{
    type: string;
    description: string;
    severity: string;
  }>;
}

export interface DataSourceTrace {
  id: string;
  agentTraceId: string;
  sourceName: string;
  sourceType: string;
  queryDescription: string | null;
  parametersUsed: Record<string, unknown> | null;
  resultCount: number | null;
  resultSummary: string | null;
  latencyMs: number | null;
  createdAt: string;
}

export interface AgentTrace {
  id: string;
  queryTraceId: string;
  agentId: string;
  agentName: string;
  executionOrder: number;
  status: AgentTraceStatus;
  inputSummary: AgentInputSummary | null;
  outputSummary: AgentOutputSummary | null;
  processingTimeMs: number | null;
  llmCallCount: number;
  llmTokensUsed: number;
  modelUsed: string | null;
  retryCount: number;
  critiqueResult: CritiqueResult | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface AgentTraceWithDataSources extends AgentTrace {
  dataSources: DataSourceTrace[];
  hasFullPayload: boolean;
}

// ============================================================================
// QUERY TRACES
// ============================================================================

export interface QueryTraceSummary {
  id: string;
  jobId: string | null;
  userId: number;
  rawQuery: string;
  agentPath: string | null;
  status: QueryTraceStatus;
  totalProcessingTimeMs: number | null;
  startedAt: string;
  completedAt: string | null;
  agentCount: number;
  hasErrors: boolean;
}

export interface QueryTrace {
  id: string;
  jobId: string | null;
  userId: number;
  rawQuery: string;
  queryClassification: QueryClassification | null;
  routingDecision: RoutingDecision | null;
  agentPath: string | null;
  totalProcessingTimeMs: number | null;
  status: QueryTraceStatus;
  hasAttachedSessions: boolean;
  attachedSessionCount: number;
  hasConversationMemory: boolean;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
}

export interface QueryTraceWithAgents extends QueryTrace {
  agentTraces: AgentTraceWithDataSources[];
}

// ============================================================================
// PAYLOAD
// ============================================================================

export interface TracePayload {
  id: string;
  agentTraceId: string;
  payloadType: 'input' | 'output';
  payload: unknown;
  sizeBytes: number;
  createdAt: string;
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface TraceListResponse {
  traces: QueryTraceSummary[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface AggregateStats {
  period: { start: string; end: string };
  totalQueries: number;
  completedQueries: number;
  failedQueries: number;
  avgProcessingTimeMs: number;
  p50ProcessingTimeMs: number;
  p95ProcessingTimeMs: number;
  p99ProcessingTimeMs: number;
  agentStats: Record<
    string,
    {
      invocationCount: number;
      avgTimeMs: number;
      successRate: number;
      avgLLMCalls: number;
      avgTokensUsed: number;
    }
  >;
  routingStats: {
    mostCommonPaths: Array<{ path: string; count: number }>;
    intentDistribution: Record<string, number>;
    scopeDistribution: Record<string, number>;
  };
  errorStats: {
    totalErrors: number;
    errorsByAgent: Record<string, number>;
  };
}

// ============================================================================
// FILTER OPTIONS
// ============================================================================

export interface TraceFilters {
  userId?: number;
  status?: QueryTraceStatus | 'all';
  startDate?: string;
  endDate?: string;
  hasErrors?: boolean;
}

export interface TracePagination {
  limit: number;
  offset: number;
}
