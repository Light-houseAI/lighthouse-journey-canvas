/**
 * Traced Agent Wrapper
 *
 * Wraps agent execution functions to automatically capture traces
 * with minimal code changes to existing agents.
 *
 * Features:
 * - Automatic input/output summarization
 * - Zero-overhead when tracing disabled (traceId is null)
 * - Full payload storage for failed queries
 */

import type { Logger } from '../../../core/logger.js';
import type { InsightState } from '../state/insight-state.js';
import type { TraceService } from './trace.service.js';
import type {
  AgentId,
  AgentInputSummary,
  AgentOutputSummary,
  CritiqueResultData,
} from './types.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Type for agent execution functions.
 * Takes state and returns partial state updates.
 */
export type AgentFunction = (
  state: InsightState,
  deps: unknown
) => Promise<Partial<InsightState>>;

/**
 * Extended state with trace context.
 */
interface TracedInsightState extends InsightState {
  _traceId?: string | null;
  _executionOrder?: number;
}

// ============================================================================
// AGENT METADATA
// ============================================================================

const AGENT_NAMES: Record<AgentId, string> = {
  QUERY_CLASSIFIER: 'Query Classifier',
  A1_RETRIEVAL: 'Retrieval Agent',
  A2_JUDGE: 'Judge Agent',
  A3_COMPARATOR: 'Comparator Agent',
  A4_WEB: 'Web Best Practices Agent',
  A4_COMPANY: 'Company Docs Agent',
  A5_FEATURE_ADOPTION: 'Feature Adoption Agent',
};

const AGENT_INPUT_FIELDS: Record<AgentId, string[]> = {
  QUERY_CLASSIFIER: ['query'],
  A1_RETRIEVAL: ['query', 'userId', 'lookbackDays', 'attachedSessionContext'],
  A2_JUDGE: ['userEvidence', 'peerEvidence'],
  A3_COMPARATOR: ['userDiagnostics', 'peerDiagnostics'],
  A4_WEB: ['userDiagnostics', 'query'],
  A4_COMPANY: ['userDiagnostics', 'query'],
  A5_FEATURE_ADOPTION: ['userDiagnostics', 'userToolbox'],
};

// ============================================================================
// SUMMARIZATION HELPERS
// ============================================================================

/**
 * Summarize agent input state for tracing.
 * Extracts key metrics without storing full payloads.
 */
function summarizeAgentInput(state: InsightState, agentId: AgentId): AgentInputSummary {
  return {
    stateSnapshot: {
      hasUserEvidence: !!state.userEvidence,
      userEvidenceWorkflowCount: state.userEvidence?.workflows?.length,
      userEvidenceStepCount: state.userEvidence?.totalStepCount,
      hasPeerEvidence: !!state.peerEvidence,
      peerEvidenceWorkflowCount: state.peerEvidence?.workflows?.length,
      hasUserDiagnostics: !!state.userDiagnostics,
      inefficiencyCount: state.userDiagnostics?.inefficiencies?.length,
      opportunityCount: state.userDiagnostics?.opportunities?.length,
      efficiencyScore: state.userDiagnostics?.overallEfficiencyScore,
    },
    relevantInputFields: AGENT_INPUT_FIELDS[agentId] || [],
  };
}

/**
 * Summarize agent output for tracing.
 * Identifies what changed in state and key metrics.
 */
function summarizeAgentOutput(
  result: Partial<InsightState>,
  agentId: AgentId
): AgentOutputSummary {
  const stateChanges: string[] = [];
  const keyMetrics: Record<string, number | string | boolean> = {};
  const errorsEncountered: string[] = [];

  // Detect what fields were added/changed
  if (result.userEvidence) {
    stateChanges.push('userEvidence');
    keyMetrics.userEvidenceWorkflows = result.userEvidence.workflows?.length ?? 0;
    keyMetrics.userEvidenceSteps = result.userEvidence.totalStepCount ?? 0;
  }

  if (result.peerEvidence) {
    stateChanges.push('peerEvidence');
    keyMetrics.peerEvidenceWorkflows = result.peerEvidence.workflows?.length ?? 0;
  }

  if (result.userDiagnostics) {
    stateChanges.push('userDiagnostics');
    keyMetrics.inefficiencies = result.userDiagnostics.inefficiencies?.length ?? 0;
    keyMetrics.opportunities = result.userDiagnostics.opportunities?.length ?? 0;
    keyMetrics.efficiencyScore = result.userDiagnostics.overallEfficiencyScore ?? 0;
  }

  if (result.peerDiagnostics) {
    stateChanges.push('peerDiagnostics');
  }

  if (result.peerComparisonPlan) {
    stateChanges.push('peerComparisonPlan');
    keyMetrics.optimizationBlocks = result.peerComparisonPlan.blocks?.length ?? 0;
  }

  if (result.webPlan) {
    stateChanges.push('webPlan');
    keyMetrics.webOptimizationBlocks = result.webPlan.blocks?.length ?? 0;
  }

  if (result.companyDocsPlan) {
    stateChanges.push('companyDocsPlan');
    keyMetrics.companyDocsBlocks = result.companyDocsPlan.blocks?.length ?? 0;
  }

  if (result.featureAdoptionTips) {
    stateChanges.push('featureAdoptionTips');
    keyMetrics.featureTips = result.featureAdoptionTips.length;
  }

  if (result.routingDecision) {
    stateChanges.push('routingDecision');
    keyMetrics.agentsToRun = result.routingDecision.agentsToRun?.length ?? 0;
  }

  if (result.finalResult) {
    stateChanges.push('finalResult');
  }

  // Check for critique results
  const critiqueKeys = ['a1CritiqueResult', 'a2CritiqueResult'] as const;
  for (const key of critiqueKeys) {
    const critique = (result as Record<string, unknown>)[key] as
      | { passed?: boolean; issues?: unknown[] }
      | undefined;
    if (critique) {
      stateChanges.push(key);
      keyMetrics[`${key}Passed`] = critique.passed ?? false;
      if (!critique.passed && critique.issues) {
        errorsEncountered.push(`${key}: ${critique.issues.length} issues`);
      }
    }
  }

  return {
    stateChanges,
    keyMetrics,
    errorsEncountered,
  };
}

/**
 * Extract critique result from agent output.
 */
function extractCritiqueResult(
  result: Partial<InsightState>,
  agentId: AgentId
): CritiqueResultData | undefined {
  const critiqueMap: Record<string, string> = {
    A1_RETRIEVAL: 'a1CritiqueResult',
    A2_JUDGE: 'a2CritiqueResult',
  };

  const critiqueKey = critiqueMap[agentId];
  if (!critiqueKey) return undefined;

  const critique = (result as Record<string, unknown>)[critiqueKey] as
    | { passed?: boolean; issues?: Array<{ type: string; description: string; severity?: string }> }
    | undefined;

  if (!critique) return undefined;

  return {
    passed: critique.passed ?? true,
    issues:
      critique.issues?.map((i) => ({
        type: i.type,
        description: i.description,
        severity: i.severity ?? 'medium',
      })) ?? [],
  };
}

// ============================================================================
// TRACED AGENT WRAPPER
// ============================================================================

/**
 * Create a traced version of an agent function.
 *
 * When tracing is enabled (traceId in state), the wrapper will:
 * 1. Start an agent trace before execution
 * 2. Capture input summary
 * 3. Execute the agent
 * 4. Capture output summary, timing, and errors
 * 5. Store full payloads if the agent fails
 *
 * When tracing is disabled, the wrapper has zero overhead.
 */
export function createTracedAgent(
  agentId: AgentId,
  agentFn: AgentFunction,
  traceService: TraceService | null,
  logger: Logger
): AgentFunction {
  // If no trace service, return the original function
  if (!traceService) {
    return agentFn;
  }

  const agentName = AGENT_NAMES[agentId];

  return async (state: InsightState, deps: unknown): Promise<Partial<InsightState>> => {
    const tracedState = state as TracedInsightState;
    const traceId = tracedState._traceId;
    const executionOrder = tracedState._executionOrder ?? 0;

    // If tracing not enabled for this request, run agent normally
    if (!traceId) {
      return agentFn(state, deps);
    }

    const startTime = Date.now();
    let agentTraceId: string;

    try {
      // Start agent trace
      agentTraceId = await traceService.startAgentTrace({
        queryTraceId: traceId,
        agentId,
        agentName,
        executionOrder,
        inputSummary: summarizeAgentInput(state, agentId),
      });
    } catch (error) {
      // If tracing fails, log and continue without tracing
      logger.warn('Failed to start agent trace, continuing without tracing', {
        agentId,
        error,
      });
      return agentFn(state, deps);
    }

    try {
      // Execute the actual agent
      const result = await agentFn(state, deps);

      // Complete trace with success
      traceService.completeAgentTrace({
        agentTraceId,
        status: 'completed',
        outputSummary: summarizeAgentOutput(result, agentId),
        processingTimeMs: Date.now() - startTime,
        critiqueResult: extractCritiqueResult(result, agentId),
        retryCount: 0,
      });

      // Increment execution order for next agent
      return {
        ...result,
        _executionOrder: executionOrder + 1,
      };
    } catch (error) {
      // Complete trace with failure
      const errorMessage = error instanceof Error ? error.message : String(error);

      traceService.completeAgentTrace({
        agentTraceId,
        status: 'failed',
        outputSummary: {
          stateChanges: [],
          keyMetrics: {},
          errorsEncountered: [errorMessage],
        },
        processingTimeMs: Date.now() - startTime,
      });

      // Store full payloads for failed queries (for debugging)
      traceService.storePayload({
        agentTraceId,
        payloadType: 'input',
        payload: {
          query: state.query,
          userId: state.userId,
          // Don't store full evidence bundles, just metadata
          hasUserEvidence: !!state.userEvidence,
          hasUserDiagnostics: !!state.userDiagnostics,
        },
      });

      logger.error('Agent execution failed', {
        agentId,
        agentTraceId,
        error: errorMessage,
        processingTimeMs: Date.now() - startTime,
      });

      throw error;
    }
  };
}

/**
 * Wrap all agent functions in a graph definition with tracing.
 */
export function wrapAgentsWithTracing(
  agents: Record<AgentId, AgentFunction>,
  traceService: TraceService | null,
  logger: Logger
): Record<AgentId, AgentFunction> {
  const traced: Record<string, AgentFunction> = {};

  for (const [agentId, agentFn] of Object.entries(agents)) {
    traced[agentId] = createTracedAgent(
      agentId as AgentId,
      agentFn,
      traceService,
      logger
    );
  }

  return traced as Record<AgentId, AgentFunction>;
}
