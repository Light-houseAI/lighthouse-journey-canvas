/**
 * Agentic Loop State
 *
 * Extends the base InsightState with agentic loop specific fields
 * for tracking reasoning steps, actions, and loop control.
 */

import { Annotation } from '@langchain/langgraph';
import { InsightStateAnnotation, type InsightState } from '../state/insight-state.js';
import type {
  SkillId,
  GuardrailResult,
  AgenticReasoningStep,
  AgenticActionResult,
  QueryClassification,
  AGENTIC_MAX_ITERATIONS,
} from '../types.js';

// ============================================================================
// AGENTIC STATE ANNOTATION
// ============================================================================

/**
 * Extended state annotation for the agentic loop.
 * Inherits all fields from InsightStateAnnotation and adds agentic-specific fields.
 */
export const AgenticStateAnnotation = Annotation.Root({
  // -------------------------------------------------------------------------
  // INHERIT BASE INSIGHT STATE
  // -------------------------------------------------------------------------
  ...InsightStateAnnotation.spec,

  // -------------------------------------------------------------------------
  // QUERY CLASSIFICATION
  // -------------------------------------------------------------------------

  /** Query classification from the classifier */
  queryClassification: Annotation<QueryClassification | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  // -------------------------------------------------------------------------
  // GUARDRAIL STATE
  // -------------------------------------------------------------------------

  /** Guardrail classification result */
  guardrailResult: Annotation<GuardrailResult | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  // -------------------------------------------------------------------------
  // AGENTIC LOOP STATE
  // -------------------------------------------------------------------------

  /** Current iteration number in the agentic loop */
  currentIteration: Annotation<number>({
    reducer: (_, b) => b,
    default: () => 0,
  }),

  /** Reasoning steps taken during the loop (append-only) */
  reasoningSteps: Annotation<AgenticReasoningStep[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),

  /** Action results from skill executions (append-only) */
  actionResults: Annotation<AgenticActionResult[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),

  /** Set of skills that have been used in this loop */
  usedSkills: Annotation<SkillId[]>({
    reducer: (a, b) => {
      const set = new Set([...a, ...b]);
      return Array.from(set) as SkillId[];
    },
    default: () => [],
  }),

  /** Currently selected skill (for execution) */
  selectedSkill: Annotation<SkillId | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  /** Input parameters for the selected skill */
  selectedSkillInput: Annotation<Record<string, unknown> | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  // -------------------------------------------------------------------------
  // TERMINATION CONTROL
  // -------------------------------------------------------------------------

  /** Whether the loop should terminate */
  shouldTerminate: Annotation<boolean>({
    reducer: (_, b) => b,
    default: () => false,
  }),

  /** Reason for termination */
  terminationReason: Annotation<string | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  // -------------------------------------------------------------------------
  // SCRATCHPAD (internal reasoning)
  // -------------------------------------------------------------------------

  /** Accumulated reasoning for internal use (not shown to user) */
  scratchpad: Annotation<string>({
    reducer: (a, b) => (b ? `${a}\n${b}` : a),
    default: () => '',
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
  // TOOL VALIDATION (for TOOL_INTEGRATION queries)
  // -------------------------------------------------------------------------

  /** Whether web search found relevant info about the queried tool */
  toolSearchRelevance: Annotation<'found' | 'not_found' | 'uncertain' | null>({
    reducer: (_, b) => b,
    default: () => null,
  }),

  /** Tool names that were NOT found in web search results */
  missingTools: Annotation<string[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/**
 * Type for the agentic loop state
 */
export type AgenticState = typeof AgenticStateAnnotation.State;

/**
 * Type for partial agentic state updates
 */
export type AgenticStateUpdate = Partial<AgenticState>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create initial agentic state from request parameters
 */
/**
 * Extract URLs from a query string
 */
function extractUrlsFromQuery(query: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = query.match(urlRegex) || [];
  // Clean up URLs (remove trailing punctuation)
  return matches.map(url => url.replace(/[.,;:!?)]+$/, ''));
}

export function createInitialAgenticState(params: {
  query: string;
  userId: number;
  nodeId?: string | null;
  lookbackDays?: number;
  includeWebSearch?: boolean;
  includePeerComparison?: boolean;
  includeCompanyDocs?: boolean;
  filterNoise?: boolean;
  attachedSessionContext?: InsightState['attachedSessionContext'];
  conversationMemory?: InsightState['conversationMemory'];
  _traceId?: string | null;
}): AgenticState {
  // Extract URLs from the query
  const extractedUrls = extractUrlsFromQuery(params.query);

  return {
    // Base state
    query: params.query,
    userId: params.userId,
    nodeId: params.nodeId || null,
    lookbackDays: params.lookbackDays || 30,
    includeWebSearch: params.includeWebSearch ?? false,
    includePeerComparison: params.includePeerComparison ?? true,
    includeCompanyDocs: params.includeCompanyDocs ?? true,
    filterNoise: params.filterNoise ?? false, // Include Slack/communication apps - project discussions are valuable
    attachedSessionContext: params.attachedSessionContext || null,
    conversationMemory: params.conversationMemory || null,

    // Persona context
    userPersonas: null,
    activePersonaContext: null,

    // A1 output
    userEvidence: null,
    peerEvidence: null,
    stitchedContext: null, // Two-tier context stitching result
    a1CritiqueResult: null,
    a1RetryCount: 0,

    // User toolbox
    userToolbox: null,

    // @deprecated A3 — peer data now in session_mappings peerInsights
    workflowAlignments: null,

    // @deprecated A2 — gap analysis now in session_mappings gapAnalysis/insights
    userDiagnostics: null,
    peerDiagnostics: null,
    a2CritiqueResult: null,
    a2RetryCount: 0,

    // Orchestrator output
    routingDecision: null,

    // Downstream outputs
    peerOptimizationPlan: null, // @deprecated A3
    webOptimizationPlan: null,
    companyOptimizationPlan: null,
    featureAdoptionTips: null, // @deprecated A5
    cachedWebSearchResult: null,

    // Final output
    mergedPlan: null,
    userQueryAnswer: null,
    finalResult: null,

    // @deprecated A6 — replaced by fact-check validator
    generatedAnswer: null,
    identifiedGaps: null,
    validationPassed: false,
    validationIterationCount: 0,
    validationResult: null,
    userWorkflows: null,

    // Control flow
    currentStage: 'agentic_initializing',
    status: 'pending',
    progress: 0,
    errors: [],
    startedAt: new Date().toISOString(),
    completedAt: null,

    // Tracing context
    _traceId: params._traceId || null,
    _executionOrder: 0,
    _speculativeCompanyDocsAvailable: undefined,

    // Query classification
    queryClassification: null,

    // Guardrail state
    guardrailResult: null,

    // Agentic loop state
    currentIteration: 0,
    reasoningSteps: [],
    actionResults: [],
    usedSkills: [],
    selectedSkill: null,
    selectedSkillInput: null,

    // Termination control
    shouldTerminate: false,
    terminationReason: null,

    // Scratchpad
    scratchpad: '',

    // URL handling
    userProvidedUrls: extractedUrls,
    urlFetchedContent: null,

    // Tool validation (for TOOL_INTEGRATION queries)
    toolSearchRelevance: null,
    missingTools: [],
  };
}

/**
 * Check if the agentic loop should terminate
 */
export function shouldTerminateLoop(
  state: AgenticState,
  maxIterations: number = 10
): { terminate: boolean; reason: string } {
  // 1. Max iterations reached
  if (state.currentIteration >= maxIterations) {
    return { terminate: true, reason: `Maximum iterations (${maxIterations}) reached` };
  }

  // 2. Guardrail rejection
  if (state.guardrailResult && !state.guardrailResult.passed) {
    return { terminate: true, reason: `Query rejected by guardrails: ${state.guardrailResult.reason}` };
  }

  // 3. Explicit termination flag
  if (state.shouldTerminate) {
    return { terminate: true, reason: state.terminationReason || 'Termination flag set' };
  }

  // 4. Final result already generated
  if (state.finalResult) {
    return { terminate: true, reason: 'Final result already generated' };
  }

  return { terminate: false, reason: '' };
}

/**
 * Get the observation from the most recent action
 */
export function getLastObservation(state: AgenticState): string | null {
  if (state.actionResults.length === 0) {
    return null;
  }
  return state.actionResults[state.actionResults.length - 1].observation;
}

/**
 * Get the most recent reasoning step
 */
export function getLastReasoningStep(state: AgenticState): AgenticReasoningStep | null {
  if (state.reasoningSteps.length === 0) {
    return null;
  }
  return state.reasoningSteps[state.reasoningSteps.length - 1];
}

/**
 * Check if a skill has been used
 */
export function hasUsedSkill(state: AgenticState, skillId: SkillId): boolean {
  return state.usedSkills.includes(skillId);
}

/**
 * Build a summary of the agentic loop execution for debugging
 */
export function buildExecutionSummary(state: AgenticState): string {
  const parts: string[] = [];

  parts.push(`Query: "${state.query}"`);
  parts.push(`Iterations: ${state.currentIteration}`);
  parts.push(`Skills used: ${state.usedSkills.join(', ') || 'none'}`);

  if (state.guardrailResult) {
    parts.push(`Guardrail: ${state.guardrailResult.passed ? 'PASSED' : 'REJECTED'} (${state.guardrailResult.queryType})`);
  }

  if (state.terminationReason) {
    parts.push(`Termination: ${state.terminationReason}`);
  }

  const successfulActions = state.actionResults.filter((a) => a.success).length;
  parts.push(`Actions: ${successfulActions}/${state.actionResults.length} successful`);

  return parts.join('\n');
}
