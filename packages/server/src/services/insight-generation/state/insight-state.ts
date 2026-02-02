/**
 * LangGraph State Definition for Insight Generation
 *
 * Defines the state schema that flows through the multi-agent pipeline:
 * - A1 (Retrieval) → A2 (Judge) → Orchestrator → A3/A4
 *
 * Uses LangGraph's Annotation system for type-safe state management.
 */

import { Annotation } from '@langchain/langgraph';
import type {
  EvidenceBundle,
  Diagnostics,
  StepOptimizationPlan,
  InsightGenerationResult,
  CritiqueResult,
  RoutingDecision,
  JobStatus,
  AttachedSessionContext,
  RetrievedMemories,
  UserToolbox,
  FeatureAdoptionTip,
  StitchedContext,
} from '../types.js';
import type { QueryClassification } from '../classifiers/query-classifier.js';

// ============================================================================
// STATE ANNOTATION
// ============================================================================

/**
 * Main state annotation for the insight generation graph.
 *
 * State flows through agents:
 * 1. Input: query, userId, options
 * 2. A1 adds: userEvidence, peerEvidence, a1CritiqueResult
 * 3. A2 adds: userDiagnostics, peerDiagnostics, a2CritiqueResult
 * 4. Orchestrator adds: routingDecision
 * 5. A3/A4 add: optimization plans
 * 6. Merge node adds: mergedPlan, finalResult
 */
export const InsightStateAnnotation = Annotation.Root({
  // -------------------------------------------------------------------------
  // INPUT STATE
  // -------------------------------------------------------------------------

  /** The user's natural language query */
  query: Annotation<string>({
    reducer: (_, b) => b,
    default: () => '',
  }),

  /** User ID for data retrieval */
  userId: Annotation<number>({
    reducer: (_, b) => b,
    default: () => 0,
  }),

  /** Optional node ID to scope the analysis */
  nodeId: Annotation<string | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  /** How many days to look back for session data */
  lookbackDays: Annotation<number>({
    reducer: (_, b) => b,
    default: () => 30,
  }),

  /** Whether to include web search (A4-Web) - defaults to false, web search is used as fallback */
  includeWebSearch: Annotation<boolean>({
    reducer: (_, b) => b,
    default: () => false,
  }),

  /** Whether to include peer comparison (A3) */
  includePeerComparison: Annotation<boolean>({
    reducer: (_, b) => b,
    default: () => true,
  }),

  /** Whether to include company docs (A4-Company) */
  includeCompanyDocs: Annotation<boolean>({
    reducer: (_, b) => b,
    default: () => true,
  }),

  /** Whether to filter noise (Slack, communication apps) from evidence */
  filterNoise: Annotation<boolean>({
    reducer: (_, b) => b,
    default: () => true,
  }),

  // -------------------------------------------------------------------------
  // URL HANDLING (for user-provided links)
  // -------------------------------------------------------------------------

  /** URLs extracted from user query */
  userProvidedUrls: Annotation<string[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),

  /** Content fetched from user-provided URLs via Perplexity */
  urlFetchedContent: Annotation<string | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  // -------------------------------------------------------------------------
  // ATTACHED SESSION CONTEXT
  // -------------------------------------------------------------------------

  /**
   * User-attached sessions for analysis (full workflow data)
   * When provided, A1 will skip NLQ retrieval and use this directly as userEvidence
   */
  attachedSessionContext: Annotation<AttachedSessionContext[] | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  // -------------------------------------------------------------------------
  // CONVERSATION MEMORY (for follow-up questions)
  // -------------------------------------------------------------------------

  /**
   * Retrieved conversation memories from previous interactions
   * Used to provide context for follow-up questions
   */
  conversationMemory: Annotation<RetrievedMemories | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  // -------------------------------------------------------------------------
  // PERSONA CONTEXT
  // -------------------------------------------------------------------------

  /** Active user personas derived from timeline nodes */
  userPersonas: Annotation<Array<{
    type: string;
    nodeId: string;
    displayName: string;
    context: Record<string, unknown>;
  }> | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  /** Formatted persona context for LLM consumption */
  activePersonaContext: Annotation<string | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  // -------------------------------------------------------------------------
  // A1 RETRIEVAL OUTPUT
  // -------------------------------------------------------------------------

  /** Evidence bundle from user's data (sessions, workflows, steps) */
  userEvidence: Annotation<EvidenceBundle | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  /** Evidence bundle from anonymized platform data (peer workflows) */
  peerEvidence: Annotation<EvidenceBundle | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  /**
   * Two-tier stitched context for cross-session analysis
   * Tier 1: Outcome-based workstreams (project-level grouping)
   * Tier 2: Tool-mastery groups (skill-level analysis)
   */
  stitchedContext: Annotation<StitchedContext | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  /** Critique result for A1 retrieval */
  a1CritiqueResult: Annotation<CritiqueResult | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  /** Query classification from A1 retrieval - used for domain filtering of peer evidence */
  queryClassification: Annotation<QueryClassification | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  /** Number of A1 retries */
  a1RetryCount: Annotation<number>({
    reducer: (a, b) => Math.max(a, b),
    default: () => 0,
  }),

  // -------------------------------------------------------------------------
  // USER TOOLBOX (Historical Tools)
  // -------------------------------------------------------------------------

  /** User's historical toolbox - all tools/apps they have used across ALL sessions */
  userToolbox: Annotation<UserToolbox | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  // -------------------------------------------------------------------------
  // A3 WORKFLOW ALIGNMENTS (for multi-workflow comparison)
  // -------------------------------------------------------------------------

  /** Aligned workflow pairs from A3 alignment phase */
  workflowAlignments: Annotation<Array<{
    userWorkflowId: string;
    peerWorkflowId: string;
    alignmentScore: number;
  }> | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  // -------------------------------------------------------------------------
  // A2 JUDGE OUTPUT
  // -------------------------------------------------------------------------

  /** Diagnostics for user's workflows */
  userDiagnostics: Annotation<Diagnostics | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  /** Diagnostics for peer workflows */
  peerDiagnostics: Annotation<Diagnostics | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  /** Critique result for A2 judgment */
  a2CritiqueResult: Annotation<CritiqueResult | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  /** Number of A2 retries */
  a2RetryCount: Annotation<number>({
    reducer: (a, b) => Math.max(a, b),
    default: () => 0,
  }),

  // -------------------------------------------------------------------------
  // ORCHESTRATOR OUTPUT
  // -------------------------------------------------------------------------

  /** Routing decision from orchestrator */
  routingDecision: Annotation<RoutingDecision | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  // -------------------------------------------------------------------------
  // DOWNSTREAM AGENT OUTPUTS
  // -------------------------------------------------------------------------

  /** Optimization plan from A3 (peer comparison) */
  peerOptimizationPlan: Annotation<StepOptimizationPlan | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  /** Optimization plan from A4-Web (Perplexity search) */
  webOptimizationPlan: Annotation<StepOptimizationPlan | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  /** Optimization plan from A4-Company (company docs) */
  companyOptimizationPlan: Annotation<StepOptimizationPlan | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  /** Feature adoption tips from A5 (separate from optimization blocks) */
  featureAdoptionTips: Annotation<FeatureAdoptionTip[] | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  /**
   * Cached web search result for user's query (from Perplexity)
   * Run in parallel with downstream agents to reduce finalization time
   */
  cachedWebSearchResult: Annotation<{ content: string; citations: string[] } | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  // -------------------------------------------------------------------------
  // FINAL OUTPUT
  // -------------------------------------------------------------------------

  /** Merged optimization plan after threshold filtering */
  mergedPlan: Annotation<StepOptimizationPlan | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  /** Generated answer to the user's query from aggregated context */
  userQueryAnswer: Annotation<string | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  /** Final result ready for API response */
  finalResult: Annotation<InsightGenerationResult | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  // -------------------------------------------------------------------------
  // CONTROL FLOW
  // -------------------------------------------------------------------------

  /** Current processing stage for progress tracking */
  currentStage: Annotation<string>({
    reducer: (_, b) => b,
    default: () => 'initializing',
  }),

  /** Job status for async processing */
  status: Annotation<JobStatus>({
    reducer: (_, b) => b,
    default: () => 'pending' as JobStatus,
  }),

  /** Progress percentage (0-100) */
  progress: Annotation<number>({
    reducer: (_, b) => b,
    default: () => 0,
  }),

  /** Accumulated errors during processing */
  errors: Annotation<string[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),

  /** Processing start timestamp */
  startedAt: Annotation<string | null>({
    reducer: (a, b) => a || b, // Keep first non-null
    default: () => null,
  }),

  /** Processing end timestamp */
  completedAt: Annotation<string | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  // -------------------------------------------------------------------------
  // TRACING CONTEXT (Internal - for dashboard monitoring)
  // -------------------------------------------------------------------------

  /** Trace ID for query tracing dashboard (null if tracing disabled) */
  _traceId: Annotation<string | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  /** Execution order counter for agent sequencing */
  _executionOrder: Annotation<number>({
    reducer: (_, b) => b,
    default: () => 0,
  }),

  /** AI2 OPTIMIZATION: Speculative company docs availability check result (set during A1) */
  _speculativeCompanyDocsAvailable: Annotation<boolean | undefined>({
    reducer: (_, b) => b,
    default: () => undefined,
  }),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/**
 * Type for the insight generation state
 */
export type InsightState = typeof InsightStateAnnotation.State;

/**
 * Type for partial state updates
 */
export type InsightStateUpdate = Partial<InsightState>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create initial state from request parameters
 */
export function createInitialState(params: {
  query: string;
  userId: number;
  nodeId?: string | null;
  lookbackDays?: number;
  includeWebSearch?: boolean;
  includePeerComparison?: boolean;
  includeCompanyDocs?: boolean;
  filterNoise?: boolean;
  /** User-attached sessions for analysis (bypasses NLQ retrieval in A1) */
  attachedSessionContext?: AttachedSessionContext[] | null;
  /** Retrieved conversation memories for follow-up context */
  conversationMemory?: RetrievedMemories | null;
  /** Trace ID for query tracing dashboard (null if tracing disabled) */
  _traceId?: string | null;
}): InsightState {
  return {
    query: params.query,
    userId: params.userId,
    nodeId: params.nodeId || null,
    lookbackDays: params.lookbackDays || 30,
    includeWebSearch: params.includeWebSearch ?? false,
    includePeerComparison: params.includePeerComparison ?? true,
    includeCompanyDocs: params.includeCompanyDocs ?? true,
    filterNoise: params.filterNoise ?? false, // Include Slack/communication apps - project discussions are valuable

    // URL handling (for user-provided links)
    userProvidedUrls: [],
    urlFetchedContent: null,

    // Attached session context (bypasses NLQ retrieval when provided)
    attachedSessionContext: params.attachedSessionContext || null,

    // Conversation memory for follow-up questions
    conversationMemory: params.conversationMemory || null,

    // Persona context
    userPersonas: null,
    activePersonaContext: null,

    // A1 output
    userEvidence: null,
    peerEvidence: null,
    stitchedContext: null, // Two-tier context stitching result
    a1CritiqueResult: null,
    queryClassification: null, // Stored for peer evidence domain filtering
    a1RetryCount: 0,

    // User toolbox (historical tools)
    userToolbox: null,

    // A3 workflow alignments
    workflowAlignments: null,

    // A2 output
    userDiagnostics: null,
    peerDiagnostics: null,
    a2CritiqueResult: null,
    a2RetryCount: 0,

    // Orchestrator output
    routingDecision: null,

    // Downstream outputs
    peerOptimizationPlan: null,
    webOptimizationPlan: null,
    companyOptimizationPlan: null,
    featureAdoptionTips: null,
    cachedWebSearchResult: null,

    // Final output
    mergedPlan: null,
    userQueryAnswer: null,
    finalResult: null,

    // Control flow
    currentStage: 'initializing',
    status: 'pending',
    progress: 0,
    errors: [],
    startedAt: new Date().toISOString(),
    completedAt: null,

    // Tracing context
    _traceId: params._traceId || null,
    _executionOrder: 0,

    // AI2 OPTIMIZATION: Speculative company docs availability check
    _speculativeCompanyDocsAvailable: undefined,
  };
}

/**
 * Check if state has sufficient data for A2
 */
export function hasA1Output(state: InsightState): boolean {
  return state.userEvidence !== null && state.a1CritiqueResult?.passed === true;
}

/**
 * Check if state has sufficient data for orchestrator
 */
export function hasA2Output(state: InsightState): boolean {
  return state.userDiagnostics !== null && state.a2CritiqueResult?.passed === true;
}

/**
 * Check if peer comparison is viable
 */
export function canRunPeerComparison(state: InsightState): boolean {
  return (
    state.includePeerComparison &&
    state.peerEvidence !== null &&
    state.peerDiagnostics !== null &&
    state.peerDiagnostics.overallEfficiencyScore >
      (state.userDiagnostics?.overallEfficiencyScore || 0)
  );
}
