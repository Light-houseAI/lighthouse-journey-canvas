/**
 * Query Tracing Types
 *
 * Type definitions for the query tracing system that provides
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
// INPUT TYPES
// ============================================================================

export interface StartTraceInput {
  jobId?: string;
  userId: number;
  rawQuery: string;
  queryClassification?: QueryClassificationData;
  hasAttachedSessions: boolean;
  attachedSessionCount: number;
  hasConversationMemory: boolean;
}

export interface QueryClassificationData {
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

export interface RoutingDecisionData {
  agentsToRun: string[];
  reason: string;
  peerDataUsable: boolean;
  companyDocsAvailable: boolean;
}

export interface StartAgentTraceInput {
  queryTraceId: string;
  agentId: AgentId;
  agentName: string;
  executionOrder: number;
  inputSummary: AgentInputSummary;
}

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

export interface CompleteAgentTraceInput {
  agentTraceId: string;
  status: 'completed' | 'failed' | 'skipped';
  outputSummary: AgentOutputSummary;
  processingTimeMs: number;
  llmCallCount?: number;
  llmTokensUsed?: number;
  modelUsed?: string;
  critiqueResult?: CritiqueResultData;
  retryCount?: number;
}

export interface AgentOutputSummary {
  stateChanges: string[];
  keyMetrics: Record<string, number | string | boolean>;
  errorsEncountered: string[];
}

export interface CritiqueResultData {
  passed: boolean;
  issues: Array<{
    type: string;
    description: string;
    severity: string;
  }>;
}

export interface CompleteTraceInput {
  traceId: string;
  status: 'completed' | 'failed';
  agentPath: string;
  totalProcessingTimeMs: number;
  routingDecision?: RoutingDecisionData;
}

export interface RecordDataSourceInput {
  agentTraceId: string;
  sourceName: string;
  sourceType: 'database' | 'api' | 'embedding_search';
  queryDescription?: string;
  parametersUsed?: Record<string, unknown>;
  resultCount?: number;
  resultSummary?: string;
  latencyMs?: number;
}

export interface StorePayloadInput {
  agentTraceId: string;
  payloadType: 'input' | 'output';
  payload: unknown;
}

// ============================================================================
// TRACE CONTEXT
// ============================================================================

/**
 * Trace context that flows through the agent pipeline via state
 */
export interface TraceContext {
  /** UUID for the query trace */
  traceId: string | null;
  /** Current execution order (incremented as agents complete) */
  executionOrder: number;
  /** Whether tracing is enabled */
  enabled: boolean;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface TraceServiceConfig {
  /** Maximum number of writes to batch before flushing */
  batchSize: number;
  /** Interval in milliseconds to flush pending writes */
  flushIntervalMs: number;
  /** Maximum payload size in bytes before truncation */
  maxPayloadSizeBytes: number;
  /** Whether to store full payloads (for failed queries only by default) */
  storeFullPayloads: boolean;
  /** Retention period in days for traces */
  retentionDays: number;
}

export const DEFAULT_TRACE_CONFIG: TraceServiceConfig = {
  batchSize: 10,
  flushIntervalMs: 1000,
  maxPayloadSizeBytes: 100 * 1024, // 100KB
  storeFullPayloads: false, // Only store for failed queries
  retentionDays: 30,
};
