/**
 * A2 Judge Agent Graph
 *
 * LangGraph implementation of the Judge Agent (A2) that:
 * 1. Analyzes user evidence to produce diagnostics (metrics, inefficiencies, opportunities)
 * 2. Analyzes peer evidence for comparison (if available)
 * 3. Runs critique loop to validate all claims cite specific step IDs and durations
 *
 * The Judge uses LLM-as-a-judge pattern to evaluate workflow efficiency.
 */

import { StateGraph, END } from '@langchain/langgraph';
import { v4 as uuidv4 } from 'uuid';
import type { Logger } from '../../../core/logger.js';
import type { LLMProvider } from '../../../core/llm-provider.js';
import { InsightStateAnnotation, type InsightState } from '../state/insight-state.js';
import type {
  EvidenceBundle,
  Diagnostics,
  WorkflowMetrics,
  Inefficiency,
  Opportunity,
  InefficiencyType,
  OpportunityType,
  CritiqueResult,
  CritiqueIssue,
} from '../types.js';
import { z } from 'zod';

// ============================================================================
// TYPES
// ============================================================================

export interface JudgeGraphDeps {
  logger: Logger;
  llmProvider: LLMProvider;
}

// LLM Output Schemas
const inefficiencyAnalysisSchema = z.object({
  inefficiencies: z.array(
    z.object({
      type: z.enum([
        'repetitive_search',
        'context_switching',
        'rework_loop',
        'manual_automation',
        'idle_time',
        'tool_fragmentation',
        'information_gathering',
        'other',
      ]),
      description: z.string(),
      stepIds: z.array(z.string()),
      estimatedWastedSeconds: z.number(),
      confidence: z.number().min(0).max(1),
      evidence: z.array(z.string()),
    })
  ),
});

const opportunityAnalysisSchema = z.object({
  opportunities: z.array(
    z.object({
      type: z.enum([
        'automation',
        'consolidation',
        'tool_switch',
        'workflow_reorder',
        'elimination',
        'claude_code_integration',
      ]),
      description: z.string(),
      inefficiencyId: z.string(),
      estimatedSavingsSeconds: z.number(),
      suggestedTool: z.string(), // Required for OpenAI structured output (empty string if N/A)
      claudeCodeApplicable: z.boolean(),
      confidence: z.number().min(0).max(1),
    })
  ),
});

const metricsAnalysisSchema = z.object({
  totalWorkflowTime: z.number(),
  activeTime: z.number(),
  idleTime: z.number(),
  contextSwitches: z.number(),
  reworkLoops: z.number(),
  uniqueToolsUsed: z.number(),
  toolDistribution: z.record(z.number()),
  workflowTagDistribution: z.record(z.number()),
  averageStepDuration: z.number(),
  overallEfficiencyScore: z.number().min(0).max(100),
});

// ============================================================================
// GRAPH NODES
// ============================================================================

/**
 * Node: Analyze user evidence and produce diagnostics
 */
async function diagnoseUserWorkflows(
  state: InsightState,
  deps: JudgeGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, llmProvider } = deps;

  logger.info('A2: Diagnosing user workflows', {
    workflowCount: state.userEvidence?.workflows.length || 0,
    stepCount: state.userEvidence?.totalStepCount || 0,
  });

  if (!state.userEvidence || state.userEvidence.workflows.length === 0) {
    logger.warn('A2: No user evidence to diagnose');
    return {
      userDiagnostics: null,
      currentStage: 'a2_user_diagnostics_skipped',
      progress: 40,
    };
  }

  try {
    // Analyze each workflow and aggregate
    const allDiagnostics: Diagnostics[] = [];

    for (const workflow of state.userEvidence.workflows) {
      const diagnostics = await analyzeWorkflow(
        workflow,
        state.query,
        llmProvider,
        logger
      );
      allDiagnostics.push(diagnostics);
    }

    // Aggregate into single diagnostics object for the most relevant workflow
    // In production, we'd merge intelligently
    const primaryDiagnostics = allDiagnostics[0] || createEmptyDiagnostics();

    logger.info('A2: User diagnostics complete', {
      inefficiencyCount: primaryDiagnostics.inefficiencies.length,
      opportunityCount: primaryDiagnostics.opportunities.length,
      efficiencyScore: primaryDiagnostics.overallEfficiencyScore,
    });

    // Log detailed output for debugging
    logger.info('=== A2 JUDGE AGENT OUTPUT (User Diagnostics) ===');
    logger.info(JSON.stringify({
      agent: 'A2_JUDGE',
      outputType: 'userDiagnostics',
      diagnostics: {
        workflowId: primaryDiagnostics.workflowId,
        workflowName: primaryDiagnostics.workflowName,
        overallEfficiencyScore: primaryDiagnostics.overallEfficiencyScore,
        confidence: primaryDiagnostics.confidence,
        analysisTimestamp: primaryDiagnostics.analysisTimestamp,
        metrics: {
          totalWorkflowTime: primaryDiagnostics.metrics.totalWorkflowTime,
          activeTime: primaryDiagnostics.metrics.activeTime,
          idleTime: primaryDiagnostics.metrics.idleTime,
          contextSwitches: primaryDiagnostics.metrics.contextSwitches,
          reworkLoops: primaryDiagnostics.metrics.reworkLoops,
          uniqueToolsUsed: primaryDiagnostics.metrics.uniqueToolsUsed,
          averageStepDuration: primaryDiagnostics.metrics.averageStepDuration,
        },
        inefficiencies: primaryDiagnostics.inefficiencies.map(i => ({
          id: i.id,
          type: i.type,
          description: i.description,
          stepIds: i.stepIds,
          estimatedWastedSeconds: i.estimatedWastedSeconds,
          confidence: i.confidence,
          evidenceCount: i.evidence.length,
        })),
        opportunities: primaryDiagnostics.opportunities.map(o => ({
          id: o.id,
          type: o.type,
          description: o.description,
          inefficiencyId: o.inefficiencyId,
          estimatedSavingsSeconds: o.estimatedSavingsSeconds,
          suggestedTool: o.suggestedTool,
          claudeCodeApplicable: o.claudeCodeApplicable,
          confidence: o.confidence,
        })),
      },
    }, null, 2));
    logger.info('=== END A2 USER DIAGNOSTICS OUTPUT ===');

    return {
      userDiagnostics: primaryDiagnostics,
      currentStage: 'a2_user_diagnostics_complete',
      progress: 45,
    };
  } catch (error) {
    logger.error('A2: Failed to diagnose user workflows', { error });
    return {
      errors: [`A2 user diagnosis failed: ${error}`],
      currentStage: 'a2_user_diagnostics_failed',
    };
  }
}

/**
 * Node: Analyze peer evidence and produce diagnostics (if available)
 */
async function diagnosePeerWorkflows(
  state: InsightState,
  deps: JudgeGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, llmProvider } = deps;

  if (!state.peerEvidence || state.peerEvidence.workflows.length === 0) {
    logger.info('A2: No peer evidence to diagnose');
    return {
      peerDiagnostics: null,
      currentStage: 'a2_peer_diagnostics_skipped',
      progress: 50,
    };
  }

  logger.info('A2: Diagnosing peer workflows', {
    workflowCount: state.peerEvidence.workflows.length,
  });

  try {
    // Analyze peer workflows to establish benchmarks
    const peerDiagnostics = await analyzeWorkflow(
      state.peerEvidence.workflows[0],
      state.query,
      llmProvider,
      logger
    );

    logger.info('A2: Peer diagnostics complete', {
      efficiencyScore: peerDiagnostics.overallEfficiencyScore,
    });

    // Log detailed output for debugging
    logger.info('=== A2 JUDGE AGENT OUTPUT (Peer Diagnostics) ===');
    logger.info(JSON.stringify({
      agent: 'A2_JUDGE',
      outputType: 'peerDiagnostics',
      diagnostics: {
        workflowId: peerDiagnostics.workflowId,
        workflowName: peerDiagnostics.workflowName,
        overallEfficiencyScore: peerDiagnostics.overallEfficiencyScore,
        confidence: peerDiagnostics.confidence,
        metrics: {
          totalWorkflowTime: peerDiagnostics.metrics.totalWorkflowTime,
          activeTime: peerDiagnostics.metrics.activeTime,
          idleTime: peerDiagnostics.metrics.idleTime,
          contextSwitches: peerDiagnostics.metrics.contextSwitches,
          reworkLoops: peerDiagnostics.metrics.reworkLoops,
          uniqueToolsUsed: peerDiagnostics.metrics.uniqueToolsUsed,
        },
        inefficiencyCount: peerDiagnostics.inefficiencies.length,
        opportunityCount: peerDiagnostics.opportunities.length,
      },
    }, null, 2));
    logger.info('=== END A2 PEER DIAGNOSTICS OUTPUT ===');

    return {
      peerDiagnostics,
      currentStage: 'a2_peer_diagnostics_complete',
      progress: 50,
    };
  } catch (error) {
    logger.error('A2: Failed to diagnose peer workflows', { error });
    return {
      peerDiagnostics: null,
      errors: [`A2 peer diagnosis failed: ${error}`],
      currentStage: 'a2_peer_diagnostics_failed',
      progress: 50,
    };
  }
}

/**
 * Node: Critique the diagnostics results
 */
async function critiqueDiagnostics(
  state: InsightState,
  deps: JudgeGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, llmProvider } = deps;

  logger.info('A2: Running critique loop');

  const issues: CritiqueIssue[] = [];

  // Check 1: All inefficiencies cite specific step IDs
  if (state.userDiagnostics) {
    for (const inefficiency of state.userDiagnostics.inefficiencies) {
      if (!inefficiency.stepIds || inefficiency.stepIds.length === 0) {
        issues.push({
          type: 'insufficient_evidence',
          description: `Inefficiency "${inefficiency.type}" lacks specific step references`,
          severity: 'error',
          affectedIds: [inefficiency.id],
        });
      }

      // Check evidence citations
      if (!inefficiency.evidence || inefficiency.evidence.length === 0) {
        issues.push({
          type: 'missing_citations',
          description: `Inefficiency "${inefficiency.type}" lacks evidence citations`,
          severity: 'warning',
          affectedIds: [inefficiency.id],
        });
      }

      // Check confidence is justified
      if (inefficiency.confidence < 0.5 && inefficiency.evidence.length < 2) {
        issues.push({
          type: 'low_confidence',
          description: `Low confidence (${inefficiency.confidence}) inefficiency "${inefficiency.type}" needs more evidence`,
          severity: 'warning',
          affectedIds: [inefficiency.id],
        });
      }
    }

    // Check 2: Opportunities reference valid inefficiencies
    for (const opportunity of state.userDiagnostics.opportunities) {
      const linkedInefficiency = state.userDiagnostics.inefficiencies.find(
        (i) => i.id === opportunity.inefficiencyId
      );
      if (!linkedInefficiency) {
        issues.push({
          type: 'insufficient_evidence',
          description: `Opportunity "${opportunity.type}" references non-existent inefficiency`,
          severity: 'error',
          affectedIds: [opportunity.id],
        });
      }
    }

    // Check 3: Avoid generic advice (use LLM to check)
    const genericCheck = await checkForGenericAdvice(
      state.userDiagnostics,
      llmProvider,
      logger
    );
    if (genericCheck.hasGenericAdvice) {
      issues.push({
        type: 'generic_advice',
        description: genericCheck.details,
        severity: 'warning',
        affectedIds: genericCheck.affectedIds,
      });
    }
  }

  // Check 4: Ensure we have actionable diagnostics
  if (
    !state.userDiagnostics ||
    (state.userDiagnostics.inefficiencies.length === 0 &&
      state.userDiagnostics.opportunities.length === 0)
  ) {
    issues.push({
      type: 'insufficient_evidence',
      description: 'No actionable inefficiencies or opportunities identified',
      severity: 'warning',
    });
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const passed = errorCount === 0;
  const canRetry = state.a2RetryCount < 2 && !passed;

  const critiqueResult: CritiqueResult = {
    passed,
    issues,
    canRetry,
    retryCount: state.a2RetryCount,
    maxRetries: 2,
  };

  logger.info('A2: Critique complete', {
    passed,
    errorCount,
    warningCount: issues.length - errorCount,
    canRetry,
  });

  // Log detailed critique output
  logger.info('=== A2 JUDGE AGENT OUTPUT (Critique) ===');
  logger.info(JSON.stringify({
    agent: 'A2_JUDGE',
    outputType: 'critique',
    critiqueResult: {
      passed,
      canRetry,
      retryCount: state.a2RetryCount,
      maxRetries: 2,
      errorCount,
      warningCount: issues.length - errorCount,
      issues: issues.map(issue => ({
        type: issue.type,
        description: issue.description,
        severity: issue.severity,
        affectedIds: issue.affectedIds,
      })),
    },
  }, null, 2));
  logger.info('=== END A2 CRITIQUE OUTPUT ===');

  return {
    a2CritiqueResult: critiqueResult,
    a2RetryCount: state.a2RetryCount + (canRetry ? 1 : 0),
    currentStage: passed ? 'a2_critique_passed' : 'a2_critique_failed',
    progress: 55,
  };
}

// ============================================================================
// ROUTING FUNCTIONS
// ============================================================================

/**
 * Route after critique: retry or continue
 */
function routeAfterCritique(state: InsightState): string {
  if (state.a2CritiqueResult?.passed) {
    return 'continue';
  }
  if (state.a2CritiqueResult?.canRetry) {
    return 'retry';
  }
  return 'continue_with_warnings';
}

// ============================================================================
// GRAPH BUILDER
// ============================================================================

/**
 * Create the A2 Judge Agent graph
 */
export function createJudgeGraph(deps: JudgeGraphDeps) {
  const { logger } = deps;

  logger.info('Creating A2 Judge Graph');

  const graph = new StateGraph(InsightStateAnnotation)
    // Add nodes
    .addNode('diagnose_user_workflows', (state) =>
      diagnoseUserWorkflows(state, deps)
    )
    .addNode('diagnose_peer_workflows', (state) =>
      diagnosePeerWorkflows(state, deps)
    )
    .addNode('critique_diagnostics', (state) => critiqueDiagnostics(state, deps))

    // Define edges
    .addEdge('__start__', 'diagnose_user_workflows')
    .addEdge('diagnose_user_workflows', 'diagnose_peer_workflows')
    .addEdge('diagnose_peer_workflows', 'critique_diagnostics')

    // Conditional routing after critique
    .addConditionalEdges('critique_diagnostics', routeAfterCritique, {
      continue: END,
      retry: 'diagnose_user_workflows',
      continue_with_warnings: END,
    });

  return graph.compile();
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Analyze a single workflow and produce diagnostics
 */
async function analyzeWorkflow(
  workflow: any,
  query: string,
  llmProvider: LLMProvider,
  logger: Logger
): Promise<Diagnostics> {
  const workflowId = workflow.workflowId || uuidv4();
  const workflowName = workflow.name || workflow.title || 'Unnamed Workflow';

  // Calculate base metrics from workflow data
  const metrics = calculateMetrics(workflow, logger);

  // Use LLM to identify inefficiencies
  const inefficiencies = await identifyInefficiencies(
    workflow,
    query,
    llmProvider,
    logger
  );

  // Use LLM to identify opportunities based on inefficiencies
  const opportunities = await identifyOpportunities(
    workflow,
    inefficiencies,
    llmProvider,
    logger
  );

  // Calculate overall efficiency score
  const overallEfficiencyScore = calculateEfficiencyScore(
    metrics,
    inefficiencies
  );

  return {
    workflowId,
    workflowName,
    metrics,
    inefficiencies,
    opportunities,
    overallEfficiencyScore,
    confidence: calculateOverallConfidence(inefficiencies, opportunities),
    analysisTimestamp: new Date().toISOString(),
  };
}

/**
 * Calculate workflow metrics from step data
 */
function calculateMetrics(workflow: any, logger: Logger): WorkflowMetrics {
  const steps = workflow.steps || [];
  const tools = workflow.tools || [];

  // Calculate total time
  const totalWorkflowTime = workflow.totalDurationSeconds || 0;

  // Calculate tool distribution
  const toolDistribution: Record<string, number> = {};
  for (const step of steps) {
    const tool = step.tool || step.app || 'unknown';
    toolDistribution[tool] = (toolDistribution[tool] || 0) + 1;
  }

  // Calculate workflow tag distribution
  const workflowTagDistribution: Record<string, number> = {};
  for (const step of steps) {
    const tag = step.workflowTag || 'other';
    workflowTagDistribution[tag] = (workflowTagDistribution[tag] || 0) + 1;
  }

  // Count context switches (tool changes)
  let contextSwitches = 0;
  let prevTool = '';
  for (const step of steps) {
    const currentTool = step.tool || step.app || '';
    if (prevTool && currentTool !== prevTool) {
      contextSwitches++;
    }
    prevTool = currentTool;
  }

  // Estimate idle time (steps with no meaningful action)
  const idleSteps = steps.filter(
    (s: any) =>
      s.metadata?.idleDetected ||
      (s.durationSeconds > 60 && !s.metadata?.keyboardActivity)
  );
  const idleTime = idleSteps.reduce(
    (sum: number, s: any) => sum + (s.durationSeconds || 0),
    0
  );

  // Count rework loops (repeated similar actions)
  const reworkLoops = detectReworkLoops(steps);

  const activeTime = totalWorkflowTime - idleTime;
  const averageStepDuration =
    steps.length > 0 ? totalWorkflowTime / steps.length : 0;

  logger.debug('Calculated metrics', {
    totalWorkflowTime,
    activeTime,
    idleTime,
    contextSwitches,
    reworkLoops,
    stepCount: steps.length,
  });

  return {
    totalWorkflowTime,
    activeTime,
    idleTime,
    contextSwitches,
    reworkLoops,
    uniqueToolsUsed: tools.length || Object.keys(toolDistribution).length,
    toolDistribution,
    workflowTagDistribution,
    averageStepDuration,
  };
}

/**
 * Detect rework loops in step sequence
 */
function detectReworkLoops(steps: any[]): number {
  let reworkCount = 0;
  const recentActions: string[] = [];

  for (const step of steps) {
    const action = `${step.tool || step.app}:${step.workflowTag}`;

    // Check if we've done this exact action recently
    const recentIndex = recentActions.indexOf(action);
    if (recentIndex !== -1 && recentIndex < recentActions.length - 2) {
      reworkCount++;
    }

    recentActions.push(action);
    if (recentActions.length > 10) {
      recentActions.shift();
    }
  }

  return reworkCount;
}

/**
 * Use LLM to identify inefficiencies in workflow
 */
async function identifyInefficiencies(
  workflow: any,
  query: string,
  llmProvider: LLMProvider,
  logger: Logger
): Promise<Inefficiency[]> {
  const steps = workflow.steps || [];

  if (steps.length === 0) {
    return [];
  }

  // Prepare step summary for LLM
  const stepSummary = steps
    .slice(0, 20) // Limit to avoid token overflow
    .map(
      (s: any, i: number) =>
        `${i + 1}. [${s.stepId || `step-${i}`}] ${s.app || s.tool}: ${s.description || 'No description'} (${s.durationSeconds || 0}s)`
    )
    .join('\n');

  try {
    const response = await llmProvider.generateStructuredResponse(
      [
        {
          role: 'user',
          content: `Analyze this workflow for inefficiencies. The user asked: "${query}"

Workflow: ${workflow.name || workflow.title || 'Unnamed'}
Intent: ${workflow.intent || 'Unknown'}
Approach: ${workflow.approach || 'Unknown'}

Steps:
${stepSummary}

Identify specific inefficiencies in this workflow. For each inefficiency:
1. Reference specific step IDs from the list above
2. Estimate time wasted in seconds
3. Provide evidence (quote step descriptions)
4. Consider: repetitive searches, context switching, rework loops, manual tasks that could be automated, idle time, tool fragmentation

Focus on actionable inefficiencies that could save significant time.`,
        },
      ],
      inefficiencyAnalysisSchema
    );

    return response.content.inefficiencies.map((ineff: any) => ({
      id: `ineff-${uuidv4().slice(0, 8)}`,
      workflowId: workflow.workflowId,
      stepIds: ineff.stepIds,
      type: ineff.type as InefficiencyType,
      description: ineff.description,
      estimatedWastedSeconds: ineff.estimatedWastedSeconds,
      confidence: ineff.confidence,
      evidence: ineff.evidence,
    }));
  } catch (error) {
    logger.error('Failed to identify inefficiencies via LLM', { error });
    return [];
  }
}

/**
 * Use LLM to identify improvement opportunities
 */
async function identifyOpportunities(
  workflow: any,
  inefficiencies: Inefficiency[],
  llmProvider: LLMProvider,
  logger: Logger
): Promise<Opportunity[]> {
  if (inefficiencies.length === 0) {
    return [];
  }

  // Prepare inefficiency summary
  const ineffSummary = inefficiencies
    .map(
      (i) =>
        `- [${i.id}] ${i.type}: ${i.description} (~${i.estimatedWastedSeconds}s wasted)`
    )
    .join('\n');

  try {
    const response = await llmProvider.generateStructuredResponse(
      [
        {
          role: 'user',
          content: `Given these workflow inefficiencies, identify improvement opportunities:

Workflow: ${workflow.name || workflow.title || 'Unnamed'}

Inefficiencies:
${ineffSummary}

For each opportunity:
1. Reference the inefficiencyId it addresses
2. Estimate time savings in seconds
3. Suggest specific tools (especially Claude Code where applicable)
4. Mark if Claude Code can help automate this

Focus on high-impact improvements. Consider:
- Claude Code for automating coding tasks, debugging, documentation
- Tool consolidation to reduce context switching
- Workflow reordering for efficiency
- Elimination of unnecessary steps`,
        },
      ],
      opportunityAnalysisSchema
    );

    return response.content.opportunities.map((opp: any) => ({
      id: `opp-${uuidv4().slice(0, 8)}`,
      inefficiencyId: opp.inefficiencyId,
      type: opp.type as OpportunityType,
      description: opp.description,
      estimatedSavingsSeconds: opp.estimatedSavingsSeconds,
      suggestedTool: opp.suggestedTool,
      claudeCodeApplicable: opp.claudeCodeApplicable,
      confidence: opp.confidence,
    }));
  } catch (error) {
    logger.error('Failed to identify opportunities via LLM', { error });
    return [];
  }
}

/**
 * Calculate overall efficiency score (0-100)
 */
function calculateEfficiencyScore(
  metrics: WorkflowMetrics,
  inefficiencies: Inefficiency[]
): number {
  let score = 100;

  // Deduct for context switches (max -20)
  const contextSwitchPenalty = Math.min(metrics.contextSwitches * 3, 20);
  score -= contextSwitchPenalty;

  // Deduct for rework loops (max -20)
  const reworkPenalty = Math.min(metrics.reworkLoops * 5, 20);
  score -= reworkPenalty;

  // Deduct for idle time ratio (max -20)
  if (metrics.totalWorkflowTime > 0) {
    const idleRatio = metrics.idleTime / metrics.totalWorkflowTime;
    score -= Math.min(idleRatio * 50, 20);
  }

  // Deduct for inefficiencies (max -30)
  const inefficiencyPenalty = Math.min(inefficiencies.length * 5, 30);
  score -= inefficiencyPenalty;

  // Deduct for high tool fragmentation (max -10)
  if (metrics.uniqueToolsUsed > 5) {
    score -= Math.min((metrics.uniqueToolsUsed - 5) * 2, 10);
  }

  return Math.max(0, Math.round(score));
}

/**
 * Calculate overall confidence from individual assessments
 */
function calculateOverallConfidence(
  inefficiencies: Inefficiency[],
  opportunities: Opportunity[]
): number {
  if (inefficiencies.length === 0 && opportunities.length === 0) {
    return 0.5;
  }

  const allConfidences = [
    ...inefficiencies.map((i) => i.confidence),
    ...opportunities.map((o) => o.confidence),
  ];

  const avgConfidence =
    allConfidences.reduce((sum, c) => sum + c, 0) / allConfidences.length;

  return Math.round(avgConfidence * 100) / 100;
}

/**
 * Check if diagnostics contain generic advice
 */
async function checkForGenericAdvice(
  diagnostics: Diagnostics,
  llmProvider: LLMProvider,
  logger: Logger
): Promise<{ hasGenericAdvice: boolean; details: string; affectedIds: string[] }> {
  const genericPatterns = [
    'improve efficiency',
    'optimize workflow',
    'work smarter',
    'be more productive',
    'save time',
    'reduce waste',
  ];

  const affectedIds: string[] = [];
  const genericIssues: string[] = [];

  // Check inefficiencies
  for (const ineff of diagnostics.inefficiencies) {
    const lower = ineff.description.toLowerCase();
    for (const pattern of genericPatterns) {
      if (lower.includes(pattern) && ineff.stepIds.length === 0) {
        affectedIds.push(ineff.id);
        genericIssues.push(
          `Inefficiency "${ineff.type}" is too generic without specific step references`
        );
        break;
      }
    }
  }

  // Check opportunities
  for (const opp of diagnostics.opportunities) {
    const lower = opp.description.toLowerCase();
    for (const pattern of genericPatterns) {
      if (lower.includes(pattern) && !opp.suggestedTool) {
        affectedIds.push(opp.id);
        genericIssues.push(
          `Opportunity "${opp.type}" is too generic without specific tool suggestion`
        );
        break;
      }
    }
  }

  return {
    hasGenericAdvice: genericIssues.length > 0,
    details: genericIssues.join('; '),
    affectedIds,
  };
}

/**
 * Create empty diagnostics object
 */
function createEmptyDiagnostics(): Diagnostics {
  return {
    workflowId: 'empty',
    workflowName: 'No workflow',
    metrics: {
      totalWorkflowTime: 0,
      activeTime: 0,
      idleTime: 0,
      contextSwitches: 0,
      reworkLoops: 0,
      uniqueToolsUsed: 0,
      toolDistribution: {},
      workflowTagDistribution: {},
      averageStepDuration: 0,
    },
    inefficiencies: [],
    opportunities: [],
    overallEfficiencyScore: 100,
    confidence: 0,
    analysisTimestamp: new Date().toISOString(),
  };
}
