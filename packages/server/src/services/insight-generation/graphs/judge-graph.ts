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
  RepetitiveWorkflowPattern,
  EffectivenessAnalysis,
  StepEffectivenessAnalysis,
  MissedActivity,
  ContentQualityCritique,
} from '../types.js';
import { z } from 'zod';
import { ConcurrencyLimiter, withRetry, isRateLimitError, withTimeout, TimeoutError } from '../../../core/retry-utils.js';
// Note: A2_JUDGE_SYSTEM_PROMPT is defined locally in this file with specialized few-shot examples

// LLM call timeout constants
const LLM_PER_ATTEMPT_TIMEOUT_MS = 60000; // 60 seconds per attempt
const LLM_TOTAL_TIMEOUT_MS = 120000; // 2 minutes total including retries

// Global concurrency limiter for GPT-4o calls to prevent rate limiting
// Limit to 2 concurrent calls to stay under 30K TPM limit
const gpt4oConcurrencyLimiter = new ConcurrencyLimiter(2);

// ============================================================================
// TYPES
// ============================================================================

export interface JudgeGraphDeps {
  logger: Logger;
  llmProvider: LLMProvider;
}

// LLM Output Schemas
// NOTE: Schemas are intentionally flexible to handle various LLM response formats.
// Empty arrays and default values prevent parsing failures when LLM returns partial data.
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
        'longcut_path',
        'repetitive_workflow',  // Cross-session repetitive patterns
        'other',
      ]).catch('other'), // Fallback to 'other' for unknown types
      description: z.string().default('No description provided'),
      stepIds: z.array(z.string()).default([]), // Default to empty array
      estimatedWastedSeconds: z.number().default(0),
      confidence: z.number().min(0).max(1).catch(0.5), // Default to medium confidence
      evidence: z.array(z.string()).default([]), // Default to empty array
      /** For longcut_path: the shorter alternative that exists (empty string if N/A) */
      shorterAlternative: z.string().optional().default(''),
    })
  ).default([]), // Default to empty array if missing
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
        'tool_feature_optimization',
        'shortcut_available',
      ]).catch('automation'), // Fallback for unknown types
      description: z.string().default('No description provided'),
      inefficiencyId: z.string().default(''), // May be empty for general opportunities
      estimatedSavingsSeconds: z.number().default(0),
      suggestedTool: z.string().optional().default(''),
      claudeCodeApplicable: z.boolean().default(false),
      confidence: z.number().min(0).max(1).catch(0.5), // Default to medium confidence
      /** For tool_feature_optimization: the specific feature to use (empty string if N/A) */
      featureSuggestion: z.string().optional().default(''),
      /** For shortcut_available: the exact shortcut/command that replaces multiple steps (empty string if N/A) */
      shortcutCommand: z.string().optional().default(''),
    })
  ).default([]), // Default to empty array if missing
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
// EFFECTIVENESS ANALYSIS SCHEMAS (Step-by-step quality critique)
// ============================================================================

const stepEffectivenessSchema = z.object({
  stepId: z.string(),
  whatUserDid: z.string(),
  qualityRating: z.enum(['poor', 'fair', 'good', 'excellent']),
  couldHaveDoneDifferently: z.string(),
  whyBetter: z.string(),
  confidence: z.number().min(0).max(1),
});

const missedActivitySchema = z.object({
  activity: z.string(),
  shouldOccurAfter: z.string(),
  whyImportant: z.string(),
  impactLevel: z.enum(['low', 'medium', 'high']),
  recommendation: z.string(),
  confidence: z.number().min(0).max(1),
});

const contentCritiqueSchema = z.object({
  aspect: z.string(),
  observation: z.string(),
  rating: z.enum(['poor', 'fair', 'good', 'excellent']),
  improvementSuggestion: z.string(),
  evidence: z.array(z.string()),
});

const effectivenessAnalysisSchema = z.object({
  stepAnalysis: z.array(stepEffectivenessSchema),
  missedActivities: z.array(missedActivitySchema),
  contentCritiques: z.array(contentCritiqueSchema),
  overallEffectivenessScore: z.number().min(0).max(100),
  effectivenessSummary: z.string(),
  topPriorities: z.array(z.string()).max(3),
});

// ============================================================================
// REPETITIVE PATTERN CONVERSION
// ============================================================================

/**
 * Convert detected repetitive workflow patterns to inefficiencies and opportunities.
 * These patterns represent cross-session recurring sequences that can be optimized.
 */
function convertRepetitivePatternsToInefficiencies(
  patterns: RepetitiveWorkflowPattern[],
  logger: Logger
): { inefficiencies: Inefficiency[]; opportunities: Opportunity[] } {
  const inefficiencies: Inefficiency[] = [];
  const opportunities: Opportunity[] = [];

  for (const pattern of patterns) {
    const inefficiencyId = uuidv4();
    const opportunityId = uuidv4();

    // Calculate hours spent on this pattern
    const hoursSpent = Math.round(pattern.totalTimeSpentSeconds / 3600 * 10) / 10;
    const sequenceStr = pattern.sequence.join(' → ');

    // Create inefficiency for the repetitive pattern
    const inefficiency: Inefficiency = {
      id: inefficiencyId,
      workflowId: 'cross-session', // These span multiple sessions
      stepIds: pattern.sessions, // Use session IDs as references
      type: 'repetitive_workflow',
      description: `Repetitive workflow pattern "${sequenceStr}" detected ${pattern.occurrenceCount} times across ${pattern.sessions.length} sessions (${hoursSpent}h total time spent)`,
      estimatedWastedSeconds: Math.round(pattern.totalTimeSpentSeconds * 0.3), // Estimate 30% can be saved
      confidence: Math.min(0.9, 0.5 + pattern.occurrenceCount * 0.05), // Higher confidence with more occurrences
      evidence: [
        `First seen: ${pattern.firstSeen}`,
        `Last seen: ${pattern.lastSeen}`,
        `Occurs ${pattern.occurrenceCount} times`,
        `Average duration: ${Math.round(pattern.avgDurationSeconds / 60)} minutes`,
      ],
    };

    inefficiencies.push(inefficiency);

    // Determine opportunity type based on pattern type
    let opportunityType: OpportunityType = 'automation';
    let suggestion = pattern.optimizationOpportunity;

    if (pattern.patternType === 'workflow_sequence') {
      if (pattern.sequence.some(s => s.toLowerCase().includes('research'))) {
        opportunityType = 'automation';
        suggestion = suggestion || `Consider creating a template or automated workflow for "${sequenceStr}" to reduce the ${hoursSpent}h spent on this recurring pattern.`;
      } else if (pattern.sequence.some(s => s.toLowerCase().includes('email') || s.toLowerCase().includes('communication'))) {
        opportunityType = 'consolidation';
        suggestion = suggestion || `Batch similar communications together. The "${sequenceStr}" pattern can be streamlined.`;
      }
    } else if (pattern.patternType === 'tool_combination') {
      opportunityType = 'consolidation';
      suggestion = suggestion || `You frequently use ${sequenceStr} together. Consider creating shortcuts or integrations.`;
    }

    // Create opportunity for the pattern
    const opportunity: Opportunity = {
      id: opportunityId,
      inefficiencyId,
      type: opportunityType,
      description: suggestion,
      estimatedSavingsSeconds: inefficiency.estimatedWastedSeconds,
      suggestedTool: pattern.patternType === 'tool_combination' ? pattern.sequence[0] : undefined,
      claudeCodeApplicable: pattern.sequence.some(s =>
        s.toLowerCase().includes('code') ||
        s.toLowerCase().includes('development') ||
        s.toLowerCase().includes('debugging')
      ),
      confidence: inefficiency.confidence,
    };

    opportunities.push(opportunity);
  }

  logger.info('A2: Converted repetitive patterns to inefficiencies', {
    patternCount: patterns.length,
    inefficiencyCount: inefficiencies.length,
    opportunityCount: opportunities.length,
    totalEstimatedSavings: inefficiencies.reduce((sum, i) => sum + i.estimatedWastedSeconds, 0),
  });

  return { inefficiencies, opportunities };
}

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
    // OPTIMIZATION: Use BATCHED LLM calls to analyze ALL workflows efficiently
    // Instead of 2 LLM calls per workflow (which is slow), we batch all workflows into
    // a single prompt for inefficiencies and a single prompt for opportunities.
    // This reduces LLM calls from N*2 to just 2-3 total calls.
    const analysisStartTime = Date.now();

    logger.info('A2: Starting BATCHED workflow analysis', {
      totalWorkflows: state.userEvidence.workflows.length,
    });

    // Analyze ALL workflows in a single batched call
    const primaryDiagnostics = await analyzeBatchedWorkflows(
      state.userEvidence.workflows,
      state.query,
      llmProvider,
      logger
    );

    logger.info('A2: Batched workflow analysis complete', {
      workflowCount: state.userEvidence.workflows.length,
      durationMs: Date.now() - analysisStartTime,
    });

    // ENHANCEMENT: Add repetitive workflow pattern inefficiencies (from cross-session analysis)
    if (state.userEvidence.repetitivePatterns && state.userEvidence.repetitivePatterns.length > 0) {
      logger.info('A2: Processing repetitive workflow patterns', {
        patternCount: state.userEvidence.repetitivePatterns.length,
      });

      const { inefficiencies: patternInefficiencies, opportunities: patternOpportunities } =
        convertRepetitivePatternsToInefficiencies(state.userEvidence.repetitivePatterns, logger);

      // Merge pattern-based inefficiencies with LLM-detected ones
      primaryDiagnostics.inefficiencies.push(...patternInefficiencies);
      primaryDiagnostics.opportunities.push(...patternOpportunities);

      // Adjust efficiency score based on repetitive patterns (more patterns = lower score)
      const patternPenalty = Math.min(15, state.userEvidence.repetitivePatterns.length * 3);
      primaryDiagnostics.overallEfficiencyScore = Math.max(
        0,
        primaryDiagnostics.overallEfficiencyScore - patternPenalty
      );

      logger.info('A2: Added repetitive pattern inefficiencies', {
        addedInefficiencies: patternInefficiencies.length,
        addedOpportunities: patternOpportunities.length,
        adjustedEfficiencyScore: primaryDiagnostics.overallEfficiencyScore,
      });
    }

    logger.info('A2: User diagnostics complete', {
      inefficiencyCount: primaryDiagnostics.inefficiencies.length,
      opportunityCount: primaryDiagnostics.opportunities.length,
      efficiencyScore: primaryDiagnostics.overallEfficiencyScore,
    });

    // ENHANCEMENT: Add EFFECTIVENESS analysis (quality and outcomes, not just efficiency)
    // This provides step-by-step quality critique, missed activities, and content quality assessment
    const effectivenessAnalysis = await analyzeWorkflowEffectiveness(
      state.userEvidence.workflows,
      state.query,
      llmProvider,
      logger
    );

    if (effectivenessAnalysis) {
      primaryDiagnostics.effectivenessAnalysis = effectivenessAnalysis;
      logger.info('A2: Effectiveness analysis added', {
        stepAnalysisCount: effectivenessAnalysis.stepAnalysis.length,
        missedActivitiesCount: effectivenessAnalysis.missedActivities.length,
        effectivenessScore: effectivenessAnalysis.overallEffectivenessScore,
      });
    }

    // Log detailed output for debugging (only when INSIGHT_DEBUG is enabled)
    if (process.env.INSIGHT_DEBUG === 'true') {
      logger.debug('=== A2 JUDGE AGENT OUTPUT (User Diagnostics) ===');
      logger.debug(JSON.stringify({
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
      }));
      logger.debug('=== END A2 USER DIAGNOSTICS OUTPUT ===');
    }

    return {
      userDiagnostics: primaryDiagnostics,
      currentStage: 'a2_user_diagnostics_complete',
      progress: 45,
    };
  } catch (err) {
    logger.error('A2: Failed to diagnose user workflows', err instanceof Error ? err : new Error(String(err)));
    return {
      errors: [`A2 user diagnosis failed: ${err}`],
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

    // Log detailed output for debugging (only when INSIGHT_DEBUG is enabled)
    if (process.env.INSIGHT_DEBUG === 'true') {
      logger.debug('=== A2 JUDGE AGENT OUTPUT (Peer Diagnostics) ===');
      logger.debug(JSON.stringify({
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
      }));
      logger.debug('=== END A2 PEER DIAGNOSTICS OUTPUT ===');
    }

    return {
      peerDiagnostics,
      currentStage: 'a2_peer_diagnostics_complete',
      progress: 50,
    };
  } catch (err) {
    logger.error('A2: Failed to diagnose peer workflows', err instanceof Error ? err : new Error(String(err)));
    return {
      peerDiagnostics: null,
      errors: [`A2 peer diagnosis failed: ${err}`],
      currentStage: 'a2_peer_diagnostics_failed',
      progress: 50,
    };
  }
}

/**
 * Node: Critique the diagnostics results
 *
 * OPTIMIZATION: Instead of retrying the entire analysis when data issues are found,
 * this function now attempts to auto-fix certain issues in-place:
 * - Orphaned opportunities (referencing non-existent inefficiencies) are removed
 * - This saves ~22s of redundant LLM calls per retry
 */
async function critiqueDiagnostics(
  state: InsightState,
  deps: JudgeGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, llmProvider } = deps;

  logger.info('A2: Running critique loop');

  const issues: CritiqueIssue[] = [];
  let userDiagnostics = state.userDiagnostics;
  let wasAutoFixed = false;

  // Check 1: Inefficiencies should cite specific step IDs (with exceptions)
  // EXCEPTION: repetitive_workflow patterns from cross-session analysis use session IDs
  // EXCEPTION: aggregated analysis may have generic step references
  if (userDiagnostics) {
    for (const inefficiency of userDiagnostics.inefficiencies) {
      // Skip step ID check for cross-session patterns (they use session IDs instead)
      const isRepetitiveWorkflow = inefficiency.type === 'repetitive_workflow';
      const isCrossSessionPattern = inefficiency.workflowId === 'cross-session';
      const hasReferences = inefficiency.stepIds && inefficiency.stepIds.length > 0;

      if (!hasReferences && !isRepetitiveWorkflow && !isCrossSessionPattern) {
        // Downgrade to warning instead of error for aggregated analysis
        // This prevents unnecessary retries that waste time
        issues.push({
          type: 'insufficient_evidence',
          description: `Inefficiency "${inefficiency.type}" lacks specific step references`,
          severity: 'warning', // Changed from 'error' to 'warning' to prevent retry loops
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

      // Check confidence is justified (only if not a cross-session pattern)
      if (!isRepetitiveWorkflow && inefficiency.confidence < 0.5 && (inefficiency.evidence?.length || 0) < 2) {
        issues.push({
          type: 'low_confidence',
          description: `Low confidence (${inefficiency.confidence}) inefficiency "${inefficiency.type}" needs more evidence`,
          severity: 'warning',
          affectedIds: [inefficiency.id],
        });
      }
    }

    // Check 2: Opportunities reference valid inefficiencies
    // AUTO-FIX: Remove orphaned opportunities instead of retrying
    const validInefficiencyIds = new Set(userDiagnostics.inefficiencies.map(i => i.id));
    const orphanedOpportunityIds: string[] = [];

    for (const opportunity of userDiagnostics.opportunities) {
      if (!validInefficiencyIds.has(opportunity.inefficiencyId)) {
        orphanedOpportunityIds.push(opportunity.id);
      }
    }

    if (orphanedOpportunityIds.length > 0) {
      // Auto-fix: Remove orphaned opportunities instead of triggering retry
      const originalCount = userDiagnostics.opportunities.length;
      userDiagnostics = {
        ...userDiagnostics,
        opportunities: userDiagnostics.opportunities.filter(
          o => !orphanedOpportunityIds.includes(o.id)
        ),
      };
      wasAutoFixed = true;

      logger.info('A2: Auto-fixed orphaned opportunities', {
        removedCount: orphanedOpportunityIds.length,
        originalCount,
        remainingCount: userDiagnostics.opportunities.length,
        removedIds: orphanedOpportunityIds,
      });

      // Log as warning instead of error (since we fixed it)
      issues.push({
        type: 'auto_fixed',
        description: `Removed ${orphanedOpportunityIds.length} opportunity(ies) referencing non-existent inefficiencies`,
        severity: 'warning',
        affectedIds: orphanedOpportunityIds,
      });
    }

    // Check 3: Avoid generic advice (use LLM to check)
    // OPTIMIZATION: Skip this check on retry to save LLM call (~6s)
    if (state.a2RetryCount === 0) {
      const genericCheck = await checkForGenericAdvice(
        userDiagnostics,
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
  }

  // Check 4: Ensure we have actionable diagnostics
  if (
    !userDiagnostics ||
    (userDiagnostics.inefficiencies.length === 0 &&
      userDiagnostics.opportunities.length === 0)
  ) {
    issues.push({
      type: 'insufficient_evidence',
      description: 'No actionable inefficiencies or opportunities identified',
      severity: 'warning',
    });
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const passed = errorCount === 0;

  // OPTIMIZATION: Disable retries completely since we now auto-fix the main error case
  // The only error that triggered retries was orphaned opportunities, which we now fix in-place
  // This saves ~22 seconds per query that previously would have retried
  const maxRetries = 0;  // Changed from 1 to 0 - auto-fix handles the issues
  const canRetry = false; // Disable retries - auto-fix is more efficient

  const critiqueResult: CritiqueResult = {
    passed,
    issues,
    canRetry,
    retryCount: state.a2RetryCount,
    maxRetries,
  };

  logger.info('A2: Critique complete', {
    passed,
    errorCount,
    warningCount: issues.length - errorCount,
    canRetry,
    wasAutoFixed,
  });

  // Log detailed critique output (only when INSIGHT_DEBUG is enabled)
  if (process.env.INSIGHT_DEBUG === 'true') {
    logger.debug('=== A2 JUDGE AGENT OUTPUT (Critique) ===');
    logger.debug(JSON.stringify({
      agent: 'A2_JUDGE',
      outputType: 'critique',
      critiqueResult: {
        passed,
        canRetry,
        retryCount: state.a2RetryCount,
        maxRetries,
        errorCount,
        warningCount: issues.length - errorCount,
        wasAutoFixed,
        issues: issues.map(issue => ({
          type: issue.type,
          description: issue.description,
          severity: issue.severity,
          affectedIds: issue.affectedIds,
        })),
      },
    }));
    logger.debug('=== END A2 CRITIQUE OUTPUT ===');
  }

  // Return the auto-fixed userDiagnostics if changes were made
  const result: Partial<InsightState> = {
    a2CritiqueResult: critiqueResult,
    a2RetryCount: state.a2RetryCount + (canRetry ? 1 : 0),
    currentStage: passed ? 'a2_critique_passed' : 'a2_critique_failed',
    progress: 55,
  };

  // Include updated diagnostics if auto-fix was applied
  if (wasAutoFixed && userDiagnostics) {
    result.userDiagnostics = userDiagnostics;
  }

  return result;
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
 * Analyze ALL workflows in a single batched LLM call for efficiency
 * This reduces LLM calls from N*2 to just 2-3 total calls
 */
async function analyzeBatchedWorkflows(
  workflows: any[],
  query: string,
  llmProvider: LLMProvider,
  logger: Logger
): Promise<Diagnostics> {
  if (workflows.length === 0) {
    return createEmptyDiagnostics();
  }

  // Aggregate metrics from all workflows
  const aggregatedMetrics = aggregateWorkflowMetrics(workflows, logger);

  // Use LLM to identify inefficiencies across ALL workflows in a single call
  const inefficiencies = await identifyBatchedInefficiencies(
    workflows,
    query,
    llmProvider,
    logger
  );

  // Use LLM to identify opportunities based on all inefficiencies in a single call
  const opportunities = await identifyBatchedOpportunities(
    workflows,
    inefficiencies,
    llmProvider,
    logger
  );

  // Calculate overall efficiency score
  const overallEfficiencyScore = calculateEfficiencyScore(
    aggregatedMetrics,
    inefficiencies
  );

  // Create primary workflow ID from first workflow
  const primaryWorkflow = workflows[0];
  const workflowId = primaryWorkflow.workflowId || uuidv4();
  const workflowName = `Aggregated Analysis (${workflows.length} workflows)`;

  return {
    workflowId,
    workflowName,
    metrics: aggregatedMetrics,
    inefficiencies,
    opportunities,
    overallEfficiencyScore,
    confidence: calculateOverallConfidence(inefficiencies, opportunities),
    analysisTimestamp: new Date().toISOString(),
  };
}

/**
 * Aggregate metrics from multiple workflows
 */
function aggregateWorkflowMetrics(workflows: any[], logger: Logger): WorkflowMetrics {
  let totalWorkflowTime = 0;
  let activeTime = 0;
  let idleTime = 0;
  let contextSwitches = 0;
  let reworkLoops = 0;
  const toolDistribution: Record<string, number> = {};
  const workflowTagDistribution: Record<string, number> = {};
  const toolsUsed = new Set<string>();
  let totalSteps = 0;

  for (const workflow of workflows) {
    const metrics = calculateMetrics(workflow, logger);
    totalWorkflowTime += metrics.totalWorkflowTime;
    activeTime += metrics.activeTime;
    idleTime += metrics.idleTime;
    contextSwitches += metrics.contextSwitches;
    reworkLoops += metrics.reworkLoops;

    // Merge tool distributions
    for (const [tool, count] of Object.entries(metrics.toolDistribution)) {
      toolDistribution[tool] = (toolDistribution[tool] || 0) + count;
      toolsUsed.add(tool);
    }

    // Merge workflow tag distributions
    for (const [tag, count] of Object.entries(metrics.workflowTagDistribution)) {
      workflowTagDistribution[tag] = (workflowTagDistribution[tag] || 0) + count;
    }

    totalSteps += workflow.steps?.length || 0;
  }

  return {
    totalWorkflowTime,
    activeTime,
    idleTime,
    contextSwitches,
    reworkLoops,
    uniqueToolsUsed: toolsUsed.size,
    toolDistribution,
    workflowTagDistribution,
    averageStepDuration: totalSteps > 0 ? totalWorkflowTime / totalSteps : 0,
  };
}

/**
 * Identify inefficiencies across ALL workflows in a single LLM call
 */
async function identifyBatchedInefficiencies(
  workflows: any[],
  query: string,
  llmProvider: LLMProvider,
  logger: Logger
): Promise<Inefficiency[]> {
  // Build a combined summary of all workflows
  const workflowSummaries = workflows.map((workflow, wIndex) => {
    const steps = workflow.steps || [];
    const stepSummary = steps
      .slice(0, 10) // Limit steps per workflow to prevent token overflow
      .map(
        (s: any, i: number) =>
          `  ${i + 1}. [${s.stepId || `step-${i}`}] ${s.app || s.tool}: ${s.description || 'No description'} (${s.durationSeconds || 0}s)`
      )
      .join('\n');

    return `
### Workflow ${wIndex + 1}: ${workflow.name || workflow.title || 'Unnamed'}
Intent: ${workflow.intent || 'Unknown'}
Tools: ${workflow.tools?.join(', ') || workflow.primaryApp || 'Unknown'}
Steps:
${stepSummary}`;
  }).join('\n');

  // Get longcut patterns for all tools used across all workflows
  const allToolsUsed = new Set<string>();
  for (const workflow of workflows) {
    const tools = extractToolsFromWorkflow(workflow);
    tools.forEach(t => allToolsUsed.add(t));
  }

  // Get patterns for any workflow (will match common tools)
  const longcutPatterns = getLongcutPatternsForTools(workflows[0]);

  try {
    logger.info('A2: Starting BATCHED inefficiency identification', {
      workflowCount: workflows.length,
      totalSteps: workflows.reduce((sum, w) => sum + (w.steps?.length || 0), 0),
    });

    const llmStartTime = Date.now();

    const response = await gpt4oConcurrencyLimiter.run(() =>
      withRetry(
        () => llmProvider.generateStructuredResponse(
          [
            {
              role: 'system',
              content: A2_JUDGE_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: `Analyze these ${workflows.length} workflows for inefficiencies. User query: "${query}"

---

## WORKFLOW DATA

${workflowSummaries}
${longcutPatterns}

---

${A2_JUDGE_INEFFICIENCY_EXAMPLES}

---

## YOUR TASK

Identify the MOST SIGNIFICANT inefficiencies across ALL workflows. Apply the Evidence Hierarchy and Anti-Hallucination Rules strictly.

**INEFFICIENCY TYPES:**
| Type | Description | Evidence Required |
|------|-------------|-------------------|
| repetitive_search | Same search query repeated 3+ times | Cite all step IDs with identical/similar search text |
| context_switching | DISRUPTIVE task interruptions (NOT IDE↔docs for same task) | Cite unrelated app steps + context reload evidence |
| rework_loop | Redoing work due to errors/trial-and-error | Cite repeated edits with evidence of fixing issues |
| manual_automation | Manually doing automatable tasks | Cite repetitive manual steps |
| idle_time | Long pauses with no action (>30s) | Cite steps with high duration, low activity |
| tool_fragmentation | Too many tools for simple task | Cite tool switches for single goal |
| information_gathering | Excessive time finding information | Cite search/browse steps before action |
| longcut_path | Multiple steps when shortcut exists | Cite navigation steps + specify the shortcut |

**OUTPUT REQUIREMENTS:**
1. Return 5-7 highest-impact inefficiencies
2. Every inefficiency MUST cite specific stepIds that EXIST in the data above
3. estimatedWastedSeconds MUST be ≤ sum of cited step durations
4. confidence MUST reflect evidence tier (T1→0.8+, T2→0.5-0.8, T3→0.3-0.5)
5. evidence array MUST quote actual step descriptions
6. DO NOT penalize: IDE↔Browser for relevant docs, TDD patterns, normal development flow

${A2_JUDGE_FINAL_CHECKLIST}`,
            },
          ],
          inefficiencyAnalysisSchema
        ),
        {
          maxRetries: 3,
          baseDelayMs: 2000,
          perAttemptTimeoutMs: LLM_PER_ATTEMPT_TIMEOUT_MS,
          totalTimeoutMs: LLM_TOTAL_TIMEOUT_MS,
          onRetry: (error, attempt, delayMs) => {
            logger.warn('A2: Retrying batched inefficiency identification', {
              attempt,
              delayMs,
              isRateLimit: isRateLimitError(error),
              isTimeout: error instanceof TimeoutError,
              error: error?.message || String(error),
            });
          },
        }
      )
    );

    const rawInefficiencies = response.content.inefficiencies || [];

    logger.info('A2: Batched inefficiency identification complete', {
      workflowCount: workflows.length,
      durationMs: Date.now() - llmStartTime,
      inefficiencyCount: rawInefficiencies.length,
    });

    const inefficiencies = rawInefficiencies.map((ineff: any) => ({
      id: `ineff-${uuidv4().slice(0, 8)}`,
      workflowId: workflows[0].workflowId || 'aggregated',
      stepIds: ineff.stepIds,
      type: ineff.type as InefficiencyType,
      description: ineff.description,
      estimatedWastedSeconds: ineff.estimatedWastedSeconds,
      confidence: ineff.confidence,
      evidence: ineff.evidence,
      shorterAlternative: ineff.shorterAlternative,
    }));

    return inefficiencies;
  } catch (err) {
    logger.error('Failed to identify batched inefficiencies', err instanceof Error ? err : new Error(String(err)));
    return [];
  }
}

/**
 * Identify opportunities based on ALL inefficiencies in a single LLM call
 */
async function identifyBatchedOpportunities(
  workflows: any[],
  inefficiencies: Inefficiency[],
  llmProvider: LLMProvider,
  logger: Logger
): Promise<Opportunity[]> {
  // Get all tools used across workflows
  const allTools = new Set<string>();
  for (const workflow of workflows) {
    const tools = extractToolsFromWorkflow(workflow);
    tools.forEach(t => allTools.add(t));
  }
  const toolsList = Array.from(allTools).join(', ');

  // Build inefficiency summary
  const ineffSummary = inefficiencies
    .map((i) => {
      const base = `- [${i.id}] ${i.type}: ${i.description} (~${i.estimatedWastedSeconds}s wasted)`;
      if (i.type === 'longcut_path' && i.shorterAlternative) {
        return `${base}\n    → Shorter alternative: ${i.shorterAlternative}`;
      }
      return base;
    })
    .join('\n');

  // Get tool-specific suggestions
  const toolSuggestions = getToolFeatureSuggestions(workflows[0]);
  const longcutPatterns = getLongcutPatternsForTools(workflows[0]);

  try {
    logger.info('A2: Starting BATCHED opportunity identification', {
      workflowCount: workflows.length,
      inefficiencyCount: inefficiencies.length,
    });

    const llmStartTime = Date.now();

    const response = await gpt4oConcurrencyLimiter.run(() =>
      withRetry(
        () => llmProvider.generateStructuredResponse(
          [
            {
              role: 'system',
              content: A2_JUDGE_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: `Based on these inefficiencies from ${workflows.length} workflows, identify improvement opportunities.

---

## INPUT DATA

**Tools user is actively using:** ${toolsList}

**Identified Inefficiencies:**
${ineffSummary || 'No specific inefficiencies identified - provide general productivity opportunities for the tools used.'}

${toolSuggestions}
${longcutPatterns}

---

${A2_JUDGE_OPPORTUNITY_EXAMPLES}

---

## YOUR TASK

Generate 5-7 high-impact opportunities that address the inefficiencies above.

**OPPORTUNITY TYPES:**
| Type | When to Use | Required Fields |
|------|-------------|-----------------|
| shortcut_available | Keyboard shortcut exists for multi-step action | shortcutCommand: exact keys (e.g., "Cmd+Shift+F") |
| tool_feature_optimization | User's tool has underused feature | featureSuggestion: specific feature name |
| automation | Task can be scripted/automated | suggestedTool: automation tool |
| claude_code_integration | AI can generate/automate code | claudeCodeApplicable: true |
| consolidation | Multiple tools replaceable with one | suggestedTool: consolidated option |
| elimination | Steps are completely unnecessary | description: explain why |

**STRICT REQUIREMENTS:**
1. inefficiencyId MUST exactly match an ID from the inefficiencies above (or "general" if no specific match)
2. estimatedSavingsSeconds MUST be ≤ the inefficiency's estimatedWastedSeconds
3. suggestedTool MUST be a tool from the "Tools user is actively using" list above
4. shortcutCommand MUST be a REAL shortcut that EXISTS in the suggested tool
5. confidence should reflect how certain the improvement will help (0.7-0.95 typical range)
6. PRIORITIZE opportunities using tools the user ALREADY has

${A2_JUDGE_FINAL_CHECKLIST}`,
            },
          ],
          opportunityAnalysisSchema
        ),
        {
          maxRetries: 3,
          baseDelayMs: 2000,
          perAttemptTimeoutMs: LLM_PER_ATTEMPT_TIMEOUT_MS,
          totalTimeoutMs: LLM_TOTAL_TIMEOUT_MS,
          onRetry: (error, attempt, delayMs) => {
            logger.warn('A2: Retrying batched opportunity identification', {
              attempt,
              delayMs,
              isRateLimit: isRateLimitError(error),
              isTimeout: error instanceof TimeoutError,
              error: error?.message || String(error),
            });
          },
        }
      )
    );

    const rawOpportunities = response.content.opportunities || [];

    logger.info('A2: Batched opportunity identification complete', {
      workflowCount: workflows.length,
      durationMs: Date.now() - llmStartTime,
      opportunityCount: rawOpportunities.length,
    });

    const opportunities = rawOpportunities.map((opp: any) => ({
      id: `opp-${uuidv4().slice(0, 8)}`,
      inefficiencyId: opp.inefficiencyId,
      type: opp.type as OpportunityType,
      description: opp.description,
      estimatedSavingsSeconds: opp.estimatedSavingsSeconds,
      suggestedTool: opp.suggestedTool,
      claudeCodeApplicable: opp.claudeCodeApplicable,
      confidence: opp.confidence,
      featureSuggestion: opp.featureSuggestion,
      shortcutCommand: opp.shortcutCommand,
    }));

    return opportunities;
  } catch (err) {
    logger.error('Failed to identify batched opportunities', err instanceof Error ? err : new Error(String(err)));
    return [];
  }
}

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

  // Count DISRUPTIVE context switches (not just any app transition)
  // Normal workflow patterns (VSCode → Chrome for docs → VSCode) are NOT context switches
  // Disruptive switches are: rapid multi-app switching, not returning to original task, brief distraction visits
  const contextSwitches = countDisruptiveContextSwitches(steps, logger);

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
 * Count TRUE context switches at the TASK level (not app level)
 *
 * DEFINITION: A context switch is when the user changes their mental focus
 * from one TASK/WORKFLOW TYPE to another, not simply when they change apps.
 *
 * App switching within the same task is NORMAL:
 * - VSCode → Chrome (docs) → VSCode while coding = 0 context switches
 * - Terminal → Browser → IDE all for same feature = 0 context switches
 *
 * TRUE context switches (task-level):
 * - Working on "coding" → interrupted by "meeting" → back to "coding"
 * - Focused "research" → sudden "debugging" → research
 *
 * We detect this by looking at the workflowTag field which represents
 * the type of work (coding, research, debugging, meeting, etc.)
 */
function countDisruptiveContextSwitches(steps: any[], logger: Logger): number {
  if (steps.length < 3) return 0;

  let taskSwitches = 0;
  let prevWorkflowTag = '';

  // Count task-level context switches based on workflowTag
  for (const step of steps) {
    const currentTag = step.workflowTag || 'other';

    // Only count as context switch if the TASK TYPE changes
    // (not just the app - app changes within same task are fine)
    if (prevWorkflowTag && currentTag !== prevWorkflowTag) {
      taskSwitches++;
    }

    prevWorkflowTag = currentTag;
  }

  // Some task switching is normal and healthy (coding → testing → debugging)
  // Only flag EXCESSIVE switching that exceeds expected baseline
  const sessionDurationSeconds = steps.reduce((sum: number, s: any) => sum + (s.durationSeconds || 0), 0);
  const sessionHours = Math.max(0.5, sessionDurationSeconds / 3600); // Min 30 min to avoid division issues

  // Expected ~3 task switches per hour is normal (roughly every 20 min)
  const expectedSwitchesPerHour = 3;
  const expectedSwitches = Math.ceil(sessionHours * expectedSwitchesPerHour);

  // Only count switches that EXCEED the normal baseline as "disruptive"
  const disruptiveSwitches = Math.max(0, taskSwitches - expectedSwitches);

  logger.debug('Context switch analysis (task-level)', {
    totalSteps: steps.length,
    sessionDurationMinutes: Math.round(sessionDurationSeconds / 60),
    totalTaskSwitches: taskSwitches,
    expectedSwitches,
    disruptiveSwitches,
    analysisNote: 'Only counting EXCESS task-level switches, not app transitions',
  });

  return disruptiveSwitches;
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

  // Get relevant longcut patterns for the tools being used
  const longcutPatterns = getLongcutPatternsForTools(workflow);

  try {
    logger.info('A2: Starting inefficiency identification LLM call', {
      workflowId: workflow.workflowId,
      stepCount: workflow.steps?.length || 0,
    });

    const llmStartTime = Date.now();

    // Use concurrency limiter and retry logic for rate limit resilience
    const response = await gpt4oConcurrencyLimiter.run(() =>
      withRetry(
        () => llmProvider.generateStructuredResponse(
          [
            {
              role: 'system',
              content: A2_JUDGE_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: `Analyze this single workflow for inefficiencies. User query: "${query}"

---

## WORKFLOW DATA

**Workflow:** ${workflow.name || workflow.title || 'Unnamed'}
**Intent:** ${workflow.intent || 'Unknown'}
**Approach:** ${workflow.approach || 'Unknown'}
**Tools used:** ${workflow.tools?.join(', ') || workflow.primaryApp || 'Unknown'}

**Steps (with IDs and durations):**
${stepSummary}

${longcutPatterns}

---

${A2_JUDGE_INEFFICIENCY_EXAMPLES}

---

## YOUR TASK

Identify specific inefficiencies in this workflow. Apply Evidence Hierarchy and Anti-Hallucination Rules strictly.

**INEFFICIENCY TYPES:**
| Type | Description | Longcut Detection |
|------|-------------|-------------------|
| repetitive_search | Same search 3+ times | — |
| context_switching | DISRUPTIVE interruptions (NOT IDE↔relevant docs) | — |
| rework_loop | Redoing work due to errors | — |
| manual_automation | Automatable tasks done manually | — |
| idle_time | Long pauses >30s | — |
| tool_fragmentation | Too many tools for one task | — |
| information_gathering | Excessive info-finding time | — |
| **longcut_path** | Multiple steps when ONE ACTION exists | Check for: manual navigation (use Cmd+P), repeated edits (use multi-cursor), manual formatting (use auto-format), manual file ops (use glob/grep) |

**OUTPUT REQUIREMENTS:**
1. Every stepId in your output MUST exist in the Steps list above
2. estimatedWastedSeconds ≤ sum of cited step durations
3. confidence reflects evidence tier (T1→0.8+, T2→0.5-0.8, T3→0.3-0.5)
4. evidence array MUST quote actual step descriptions
5. For longcut_path: shorterAlternative MUST specify exact shortcut/command
6. DO NOT penalize: normal TDD workflow, IDE↔relevant docs, incremental development

${A2_JUDGE_FINAL_CHECKLIST}`,
            },
          ],
          inefficiencyAnalysisSchema
        ),
        {
          maxRetries: 3,
          baseDelayMs: 2000, // Start with 2 second delay for rate limits
          perAttemptTimeoutMs: LLM_PER_ATTEMPT_TIMEOUT_MS, // 60 seconds per attempt
          totalTimeoutMs: LLM_TOTAL_TIMEOUT_MS, // 2 minutes total
          onRetry: (error, attempt, delayMs) => {
            logger.warn('A2: Retrying inefficiency identification', {
              attempt,
              delayMs,
              isRateLimit: isRateLimitError(error),
              isTimeout: error instanceof TimeoutError,
              error: error?.message || String(error),
            });
          },
        }
      )
    );

    const rawInefficiencies = response.content.inefficiencies || [];

    logger.info('A2: Inefficiency identification LLM call completed', {
      workflowId: workflow.workflowId,
      durationMs: Date.now() - llmStartTime,
      inefficiencyCount: rawInefficiencies.length,
    });

    const inefficiencies = rawInefficiencies.map((ineff: any) => ({
      id: `ineff-${uuidv4().slice(0, 8)}`,
      workflowId: workflow.workflowId,
      stepIds: ineff.stepIds,
      type: ineff.type as InefficiencyType,
      description: ineff.description,
      estimatedWastedSeconds: ineff.estimatedWastedSeconds,
      confidence: ineff.confidence,
      evidence: ineff.evidence,
      shorterAlternative: ineff.shorterAlternative,
    }));

    logger.info('A2: Inefficiencies identified', {
      count: inefficiencies.length,
      types: inefficiencies.map((i: Inefficiency) => i.type),
    });

    return inefficiencies;
  } catch (err) {
    logger.error('Failed to identify inefficiencies via LLM after retries', err instanceof Error ? err : new Error(String(err)));
    // Return empty array on failure - no fallbacks
    return [];
  }
}

/**
 * Tool-specific feature knowledge for optimization suggestions
 */
const TOOL_FEATURE_KNOWLEDGE: Record<string, string[]> = {
  cursor: [
    'Plan Mode - use @plan to let AI create implementation plans before coding',
    'Composer - use for multi-file changes and refactoring',
    'Chat with codebase - use @codebase to search and understand code',
    'Tab completion - enable for AI-powered autocomplete',
    'Docs context - add @docs to include documentation in context',
  ],
  vscode: [
    'Multi-cursor editing - use Cmd+D to select multiple occurrences',
    'Snippets - create custom snippets for repetitive code patterns',
    'Tasks - automate build/test commands with tasks.json',
    'Workspace settings - use .vscode/settings.json for project-specific configs',
    'Extensions - install relevant extensions for your stack',
  ],
  'github copilot': [
    'Copilot Chat - ask questions about code inline',
    'Explain code - use /explain to understand complex code',
    'Generate tests - use /tests to auto-generate test cases',
    'Fix errors - use /fix to let Copilot suggest fixes',
  ],
  chrome: [
    'DevTools - use Network tab to debug API calls',
    'Lighthouse - run audits for performance optimization',
    'Workspaces - edit files directly in DevTools',
    'Snippets - save and rerun JavaScript snippets',
  ],
  terminal: [
    'Aliases - create shortcuts for common commands',
    'Shell history - use Ctrl+R to search command history',
    'Tmux/Screen - use for persistent sessions',
    'Shell scripts - automate repetitive terminal tasks',
  ],
  slack: [
    'Keyboard shortcuts - use Cmd+K for quick navigation',
    'Threads - keep conversations organized',
    'Saved items - bookmark important messages',
    'Scheduled messages - send messages at optimal times',
  ],
  notion: [
    'Templates - create templates for repetitive documents',
    'Databases - use for structured data instead of pages',
    'Linked databases - reuse data across pages',
    'Slash commands - use / for quick formatting',
  ],
  figma: [
    'Auto-layout - use for responsive designs',
    'Components - create reusable design elements',
    'Variants - manage component states efficiently',
    'Dev mode - hand off designs to developers easily',
  ],
};

/**
 * Common "longcut" patterns where users take unnecessary steps
 * Each pattern describes the longcut and its shortcut alternative
 */
const LONGCUT_PATTERNS: Array<{
  pattern: string;
  longcut: string;
  shortcut: string;
  tools: string[];
}> = [
  // IDE/Editor patterns
  {
    pattern: 'Manual find-and-replace across multiple files',
    longcut: 'Opening each file individually and using find-replace',
    shortcut: 'Use global search/replace (Cmd+Shift+H in VSCode/Cursor)',
    tools: ['vscode', 'cursor', 'sublime'],
  },
  {
    pattern: 'Manually formatting code',
    longcut: 'Manually adjusting indentation and spacing',
    shortcut: 'Use auto-format on save or Cmd+Shift+F',
    tools: ['vscode', 'cursor'],
  },
  {
    pattern: 'Copying same edit to multiple locations',
    longcut: 'Editing one location, then navigating to repeat',
    shortcut: 'Use multi-cursor (Cmd+D) to edit all occurrences at once',
    tools: ['vscode', 'cursor', 'sublime'],
  },
  {
    pattern: 'Manually writing boilerplate code',
    longcut: 'Typing repetitive code structures from scratch',
    shortcut: 'Use snippets or AI code generation',
    tools: ['vscode', 'cursor'],
  },
  {
    pattern: 'Searching documentation in browser while coding',
    longcut: 'Switching to browser to look up API docs',
    shortcut: 'Use @docs in Cursor or inline documentation features',
    tools: ['cursor', 'vscode'],
  },
  // Terminal patterns
  {
    pattern: 'Typing long commands repeatedly',
    longcut: 'Typing full command each time',
    shortcut: 'Create shell aliases or use Ctrl+R for history search',
    tools: ['terminal', 'iterm'],
  },
  {
    pattern: 'Running multiple build steps manually',
    longcut: 'Running npm install, then build, then test separately',
    shortcut: 'Create npm scripts or Makefile to chain commands',
    tools: ['terminal'],
  },
  // Git patterns
  {
    pattern: 'Manually staging files one by one',
    longcut: 'Running git add for each file separately',
    shortcut: 'Use git add -p for interactive staging or git add .',
    tools: ['terminal', 'vscode', 'cursor'],
  },
  {
    pattern: 'Checking git status repeatedly',
    longcut: 'Running git status multiple times during work',
    shortcut: 'Use IDE git integration for real-time status',
    tools: ['vscode', 'cursor'],
  },
  // Browser/DevTools patterns
  {
    pattern: 'Refreshing page to see changes',
    longcut: 'Manually refreshing browser after each code change',
    shortcut: 'Use hot reload or live server',
    tools: ['chrome', 'browser'],
  },
  {
    pattern: 'Console logging for debugging',
    longcut: 'Adding console.log statements and refreshing',
    shortcut: 'Use debugger breakpoints in DevTools',
    tools: ['chrome', 'vscode', 'cursor'],
  },
  // AI Assistant patterns
  {
    pattern: 'Writing code without AI assistance',
    longcut: 'Manually writing code that AI could generate',
    shortcut: 'Use Cursor Composer or Copilot for code generation',
    tools: ['cursor', 'vscode'],
  },
  {
    pattern: 'Manually reviewing code for errors',
    longcut: 'Reading through code to find bugs',
    shortcut: 'Use AI code review or linting tools',
    tools: ['cursor', 'vscode'],
  },
  {
    pattern: 'Planning implementation in head',
    longcut: 'Starting to code without a clear plan',
    shortcut: 'Use Cursor Plan Mode (@plan) to create implementation plan first',
    tools: ['cursor'],
  },
];

// ============================================================================
// A2 JUDGE AGENT: FACT DISAMBIGUATION & LLM-AS-JUDGE FRAMEWORK
// ============================================================================
// This framework ensures consistent, evidence-grounded workflow efficiency analysis.
// All judgments must cite specific step evidence and avoid hallucination.
// ============================================================================

/**
 * Core System Prompt for A2 Judge Agent
 * Establishes the judge's role, evidence requirements, and anti-hallucination rules.
 */
const A2_JUDGE_SYSTEM_PROMPT = `
You are an LLM-AS-JUDGE specialized in workflow efficiency analysis. Your role is to:
1. EVALUATE workflow step data for genuine inefficiencies
2. DISTINGUISH between real problems and normal productive work
3. CITE specific evidence (step IDs, durations, descriptions) for every claim
4. AVOID false positives that penalize healthy work patterns

**YOU ARE A FACTUAL EVIDENCE SYSTEM, NOT A PRODUCTIVITY GURU.**
Every claim must trace to specific step data. If you cannot cite evidence, do not make the claim.

---

## EVIDENCE HIERARCHY (Fact Disambiguation)

For every inefficiency you identify, ground claims in the highest available evidence tier:

| Tier | Evidence Type | Confidence Range | Example |
|------|---------------|------------------|---------|
| **T1 — Direct** | Exact text from step descriptions, specific step IDs, actual durations | 0.80–1.0 | Step description says "Searching for UserService" |
| **T2 — Pattern** | Observable sequences across multiple steps that strongly imply inefficiency | 0.50–0.80 | Steps 2, 5, 8 all contain "Searching for UserService" |
| **T3 — Inferred** | Logical deduction from workflow structure, not directly confirmed | 0.30–0.50 | 4 edits to same file may indicate trial-and-error |

**CRITICAL**: If T1 evidence exists, you MUST use it. Never drop to T3 when T1/T2 is available.

---

## ANTI-HALLUCINATION RULES (MANDATORY)

### Rule 1: Never Fabricate Content
❌ WRONG: "User was debugging React hooks in the auth component"
✅ RIGHT: "Step-3 shows 'Editing auth.ts' (45s)" — only reference actual step text

### Rule 2: Never Invent Step IDs
❌ WRONG: stepIds: ["step-1", "step-5", "step-9"] when only steps 1-4 exist
✅ RIGHT: Only reference stepIds present in the input data

### Rule 3: Never Overstate Time Estimates
❌ WRONG: estimatedWastedSeconds: 300 when total workflow is 150s
✅ RIGHT: Waste estimate must be ≤ sum of cited step durations

### Rule 4: Never Assume Intent
❌ WRONG: "User was frustrated and didn't know the shortcut"
✅ RIGHT: "Pattern suggests opportunity for shortcut use" (qualified inference)

### Rule 5: Distinguish Observation from Inference
- **Direct (T1)**: "User searched 3 times" — state as fact
- **Pattern (T2)**: "Steps suggest repetitive search behavior" — acknowledge pattern
- **Inferred (T3)**: "May indicate unfamiliarity with search features" — use qualifiers

---

## JUDGMENT CRITERIA: What IS vs IS NOT an Inefficiency

### JUDGE AS INEFFICIENCY ✓
- Same search query repeated 3+ times without using persistent results
- Unrelated app switches (social media, #random) interrupting focused work
- Manual multi-step navigation when keyboard shortcut exists
- Identical operations on multiple items without batch/multi-select
- Context reload visible (re-reading code after interruption)

### DO NOT JUDGE AS INEFFICIENCY ✗
- IDE ↔ Browser switching for task-relevant docs (e.g., Stripe docs while implementing Stripe)
- Test-Driven Development: write → run test → fix → run test (this is GOOD practice)
- Terminal ↔ IDE switching during normal development
- Multiple edits to same file (could be incremental valid development)
- Research/reading time for complex tasks

---

## CONFIDENCE CALIBRATION

Your confidence score MUST reflect evidence quality:

| Score | Requirements |
|-------|-------------|
| **0.85–1.0** | 100% T1: All claims cite specific step IDs + exact descriptions |
| **0.70–0.85** | 80%+ T1: Most claims directly evidenced, minor pattern inference |
| **0.50–0.70** | Mixed T1/T2: Clear pattern but some details inferred |
| **0.30–0.50** | T2/T3: Pattern-based with significant uncertainty |
| **< 0.30** | DO NOT OUTPUT — insufficient evidence |
`;

/**
 * Few-Shot Examples for Inefficiency Judging
 * Demonstrates CORRECT and INCORRECT judgments to calibrate LLM behavior
 */
const A2_JUDGE_INEFFICIENCY_EXAMPLES = `
## FEW-SHOT EXAMPLES: How to Judge Inefficiencies

---

### EXAMPLE 1: Repetitive Search — CORRECT JUDGMENT ✓

**INPUT STEPS:**
1. [step-1] VSCode: Searching for "AuthService" in project (12s)
2. [step-2] VSCode: Opening auth/service.ts (3s)
3. [step-3] VSCode: Reading code (45s)
4. [step-4] VSCode: Searching for "AuthService" in project (8s)
5. [step-5] VSCode: Opening auth/middleware.ts (2s)
6. [step-6] VSCode: Searching for "AuthService" in project (10s)

**CORRECT JUDGMENT:**
{
  "type": "repetitive_search",
  "description": "Identical 'AuthService' search performed 3 times (steps 1, 4, 6). First search (12s) was necessary; subsequent searches (18s total) could be avoided by using Cmd+Shift+F for persistent results or Cmd+G to cycle matches.",
  "stepIds": ["step-1", "step-4", "step-6"],
  "estimatedWastedSeconds": 18,
  "confidence": 0.92,
  "evidence": [
    "step-1: 'Searching for AuthService' (12s) — initial search",
    "step-4: 'Searching for AuthService' (8s) — repeat",
    "step-6: 'Searching for AuthService' (10s) — repeat"
  ],
  "shorterAlternative": "Use Cmd+Shift+F (global search) once, then Cmd+G to navigate between matches"
}

**WHY CORRECT:**
✅ Evidence: All 3 stepIds exist and are quoted verbatim
✅ Time calculation: 18s = 8s + 10s (excluding necessary first search)
✅ Confidence 0.92: 100% T1 evidence (direct text match)
✅ Specific actionable alternative with exact shortcuts

---

### EXAMPLE 2: Context Switching — CORRECT JUDGMENT (True Positive) ✓

**INPUT STEPS:**
1. [step-1] VSCode: Implementing payment API (180s)
2. [step-2] Slack: Reading #random channel (45s)
3. [step-3] Twitter: Scrolling feed (120s)
4. [step-4] VSCode: Opening payment.ts (5s)
5. [step-5] VSCode: Re-reading payment code (60s)

**CORRECT JUDGMENT:**
{
  "type": "context_switching",
  "description": "Payment API work (step-1) interrupted by unrelated activities: Slack #random (step-2, 45s) and Twitter (step-3, 120s). Step-5 shows 60s context reload cost (re-reading code after return). Total disruption: 225s.",
  "stepIds": ["step-2", "step-3", "step-5"],
  "estimatedWastedSeconds": 225,
  "confidence": 0.88,
  "evidence": [
    "step-2: '#random channel' — not work-related channel",
    "step-3: 'Scrolling feed' — social media consumption",
    "step-5: 'Re-reading payment code' — context reload after interruption"
  ],
  "shorterAlternative": ""
}

**WHY CORRECT:**
✅ Correctly identified #random and Twitter as UNRELATED to payment work
✅ Step-5 "Re-reading" is EVIDENCE of context switch cost (not just assumed)
✅ Time: 45s + 120s + 60s = 225s (all from actual step durations)

---

### EXAMPLE 3: Context Switching — CORRECT JUDGMENT (True Negative) ✗

**INPUT STEPS:**
1. [step-1] VSCode: Implementing Stripe integration (180s)
2. [step-2] Chrome: Reading Stripe API documentation (90s)
3. [step-3] VSCode: Continuing Stripe integration (150s)

**CORRECT JUDGMENT:**
NO INEFFICIENCY — This is normal, efficient workflow.

**REASONING:**
- Step-2 (Stripe docs) is DIRECTLY RELEVANT to step-1 and step-3 (Stripe implementation)
- Reading documentation while implementing an API is EXPECTED behavior
- No evidence of context switching — single coherent task with research phase
- Judge should NOT penalize task-relevant research

---

### EXAMPLE 4: Longcut Path — CORRECT JUDGMENT ✓

**INPUT STEPS:**
1. [step-1] VSCode: Clicking file explorer (2s)
2. [step-2] VSCode: Expanding src folder (2s)
3. [step-3] VSCode: Expanding components folder (2s)
4. [step-4] VSCode: Expanding auth folder (2s)
5. [step-5] VSCode: Clicking AuthForm.tsx (2s)
6. [step-6] VSCode: Editing AuthForm.tsx (60s)

**CORRECT JUDGMENT:**
{
  "type": "longcut_path",
  "description": "User navigated through 5 folder clicks (steps 1-5, 10s total) to open AuthForm.tsx. Cmd+P 'AuthForm' would open the file in ~1s.",
  "stepIds": ["step-1", "step-2", "step-3", "step-4", "step-5"],
  "estimatedWastedSeconds": 9,
  "confidence": 0.95,
  "evidence": [
    "5 sequential navigation steps totaling 10s",
    "All steps are folder/file navigation in VSCode"
  ],
  "shorterAlternative": "Use Cmd+P (Quick Open), type 'AuthForm', press Enter (~1s)"
}

---

### EXAMPLE 5: Test-Driven Development — CORRECT JUDGMENT (True Negative) ✗

**INPUT STEPS:**
1. [step-1] VSCode: Writing test for UserService (60s)
2. [step-2] Terminal: Running npm test (12s)
3. [step-3] VSCode: Fixing test assertion (30s)
4. [step-4] Terminal: Running npm test (10s)
5. [step-5] VSCode: Adding second test (45s)
6. [step-6] Terminal: Running npm test (10s)

**CORRECT JUDGMENT:**
NO INEFFICIENCY — This is healthy TDD workflow.

**REASONING:**
- write test → run → fix → run → add test → run is CORRECT TDD pattern
- Running tests frequently is BEST PRACTICE, not waste
- No evidence of rework/debugging — this is expected iterative development
- Judge must recognize development methodologies, not penalize them

---

### EXAMPLE 6: Low-Confidence Judgment — HANDLING UNCERTAINTY ✓

**INPUT STEPS:**
1. [step-1] VSCode: Editing config.ts (30s)
2. [step-2] VSCode: Editing config.ts (25s)
3. [step-3] VSCode: Editing config.ts (35s)
4. [step-4] VSCode: Editing config.ts (20s)

**CORRECT JUDGMENT:**
{
  "type": "rework_loop",
  "description": "Four consecutive edits to config.ts (steps 1-4, total 110s) may indicate trial-and-error configuration. However, step descriptions lack detail on what changed — this could also be valid incremental development.",
  "stepIds": ["step-1", "step-2", "step-3", "step-4"],
  "estimatedWastedSeconds": 35,
  "confidence": 0.40,
  "evidence": [
    "4 edits to same file in sequence",
    "No description of what changed between edits"
  ],
  "shorterAlternative": ""
}

**WHY CORRECT:**
✅ Acknowledged uncertainty: "may indicate", "could also be"
✅ Confidence 0.40 (T3 — pattern without detail)
✅ Conservative waste: 35s of 110s (~32%), not full duration
✅ Honest about evidence limitations

---

### ANTI-EXAMPLE: HALLUCINATED JUDGMENT — NEVER DO THIS ✗

**INPUT STEPS:**
1. [step-1] Chrome: Reading webpage (60s)
2. [step-2] VSCode: Editing file (90s)

**HALLUCINATED (WRONG) JUDGMENT:**
{
  "type": "information_gathering",
  "description": "User spent 5 minutes researching React useEffect patterns before implementing authentication hooks, showing unfamiliarity with React best practices.",
  "stepIds": ["step-1", "step-2", "step-3"],
  "estimatedWastedSeconds": 180,
  "confidence": 0.85,
  "evidence": ["Extensive research phase before coding"]
}

**WHAT IS WRONG (DO NOT DO THIS):**
❌ "React useEffect", "authentication hooks" — FABRICATED, not in step data
❌ "5 minutes" — FALSE, step shows 60s
❌ "step-3" — DOES NOT EXIST in input
❌ 180s when workflow is only 150s total — IMPOSSIBLE
❌ "showing unfamiliarity" — PSYCHOANALYSIS without evidence
❌ "Extensive research" — 60s is not extensive
❌ 0.85 confidence for fabricated claims — DISHONEST
`;

/**
 * Few-Shot Examples for Opportunity Judging
 */
const A2_JUDGE_OPPORTUNITY_EXAMPLES = `
## FEW-SHOT EXAMPLES: How to Judge Opportunities

---

### EXAMPLE 1: Shortcut Opportunity — CORRECT ✓

**INPUT INEFFICIENCY:**
[ineff-abc] repetitive_search: "AuthService" searched 3 times (steps 1,4,6), 18s wasted

**CORRECT OPPORTUNITY:**
{
  "type": "shortcut_available",
  "description": "Replace repeated searches with persistent global search. Use Cmd+Shift+F once to open search panel, then Cmd+G/Cmd+Shift+G to cycle through matches.",
  "inefficiencyId": "ineff-abc",
  "estimatedSavingsSeconds": 15,
  "suggestedTool": "VSCode",
  "claudeCodeApplicable": false,
  "confidence": 0.92,
  "featureSuggestion": "",
  "shortcutCommand": "Cmd+Shift+F (global search), then Cmd+G (next match)"
}

**WHY CORRECT:**
✅ References exact inefficiencyId from input
✅ Savings (15s) ≤ waste (18s) — conservative
✅ Specific shortcuts, not generic "use better tools"
✅ Tool matches what user was using

---

### EXAMPLE 2: AI Integration — CORRECT ✓

**INPUT INEFFICIENCY:**
[ineff-crud] manual_automation: Wrote 5 similar CRUD handlers manually (steps 12-16), 300s

**CORRECT OPPORTUNITY:**
{
  "type": "claude_code_integration",
  "description": "Pattern of similar CRUD handlers suggests AI generation opportunity. Claude Code can generate handler implementations from a single example or type definition, reducing repetitive coding.",
  "inefficiencyId": "ineff-crud",
  "estimatedSavingsSeconds": 180,
  "suggestedTool": "Claude Code",
  "claudeCodeApplicable": true,
  "confidence": 0.70,
  "featureSuggestion": "Provide one handler example + entity types, ask Claude to generate remaining handlers",
  "shortcutCommand": ""
}

**WHY CORRECT:**
✅ Confidence 0.70 (not 0.95) — effectiveness depends on code specifics
✅ Savings 180s = 60% of waste — realistic, not 100%
✅ Qualified: "suggests opportunity", not "will definitely save"

---

### EXAMPLE 3: Tool Feature — CORRECT ✓

**INPUT INEFFICIENCY:**
[ineff-nav] longcut_path: 5 navigation clicks to open file (steps 1-5), 9s wasted

**CORRECT OPPORTUNITY:**
{
  "type": "tool_feature_optimization",
  "description": "VSCode Quick Open (Cmd+P) allows instant file access by typing partial filename. Developing this muscle memory eliminates manual folder navigation.",
  "inefficiencyId": "ineff-nav",
  "estimatedSavingsSeconds": 8,
  "suggestedTool": "VSCode",
  "claudeCodeApplicable": false,
  "confidence": 0.95,
  "featureSuggestion": "Practice Cmd+P → type filename → Enter. Feature exists in all modern IDEs.",
  "shortcutCommand": "Cmd+P"
}

---

### ANTI-EXAMPLE: HALLUCINATED OPPORTUNITY — NEVER DO THIS ✗

**INPUT INEFFICIENCY:**
[ineff-idle] idle_time: 45s pause (step-3)

**HALLUCINATED (WRONG) OPPORTUNITY:**
{
  "type": "automation",
  "description": "Install productivity monitoring extension to eliminate all idle time. Studies show this can boost productivity by 40%. Consider Pomodoro technique for focused sessions.",
  "inefficiencyId": "ineff-wrong-id",
  "estimatedSavingsSeconds": 600,
  "suggestedTool": "Productivity Extension",
  "claudeCodeApplicable": false,
  "confidence": 0.95
}

**WHAT IS WRONG:**
❌ "ineff-wrong-id" — wrong inefficiency reference
❌ 600s savings from 45s pause — 13x the actual waste (IMPOSSIBLE)
❌ "boost productivity by 40%" — FABRICATED STATISTIC
❌ "eliminate all idle time" — overpromise; some idle is healthy
❌ Generic Pomodoro advice not tied to evidence
❌ 0.95 confidence for ungrounded generic suggestion
`;

/**
 * Final Validation Checklist
 */
const A2_JUDGE_FINAL_CHECKLIST = `
## OUTPUT VALIDATION CHECKLIST

Before returning your judgment, verify EACH item:

### For Every Inefficiency:
□ stepIds — Do ALL referenced IDs exist in the input workflow?
□ evidence — Does EACH evidence item quote actual step descriptions?
□ estimatedWastedSeconds — Is this ≤ sum of cited step durations?
□ confidence — Does score match evidence tier (T1→0.8+, T2→0.5-0.8, T3→0.3-0.5)?
□ description — Are there NO fabricated details (filenames, libraries, user emotions)?
□ type — Is this a TRUE inefficiency, not normal work pattern?

### For Every Opportunity:
□ inefficiencyId — Does this EXACTLY match an inefficiency ID from the analysis?
□ estimatedSavingsSeconds — Is this ≤ the inefficiency's wasted seconds?
□ suggestedTool — Is this a tool the user is ACTUALLY using (from workflow data)?
□ shortcutCommand — Is this a REAL shortcut that EXISTS in the suggested tool?
□ confidence — Is this calibrated to how certain the improvement will help?

### False Positive Check:
□ Did I avoid penalizing IDE↔Browser switches for relevant documentation?
□ Did I avoid penalizing TDD workflow (write-test-fix-test)?
□ Did I avoid penalizing terminal↔IDE switching for development?
□ Did I use qualifiers ("may", "suggests", "appears") for T2/T3 evidence?
`;

/**
 * Extract tools used in a workflow
 */
function extractToolsFromWorkflow(workflow: any): Set<string> {
  const toolsUsed = new Set<string>();

  if (workflow.tools) {
    workflow.tools.forEach((t: string) => toolsUsed.add(t.toLowerCase()));
  }
  if (workflow.primaryApp) {
    toolsUsed.add(workflow.primaryApp.toLowerCase());
  }
  if (workflow.steps) {
    workflow.steps.forEach((s: any) => {
      if (s.app) toolsUsed.add(s.app.toLowerCase());
    });
  }

  return toolsUsed;
}

/**
 * Get relevant longcut patterns based on tools used in workflow
 */
function getLongcutPatternsForTools(workflow: any): string {
  const toolsUsed = extractToolsFromWorkflow(workflow);
  const relevantPatterns: string[] = [];

  for (const pattern of LONGCUT_PATTERNS) {
    // Check if any of the pattern's tools match what the user is using
    const isRelevant = pattern.tools.some(patternTool =>
      Array.from(toolsUsed).some(usedTool =>
        usedTool.includes(patternTool) || patternTool.includes(usedTool)
      )
    );

    if (isRelevant) {
      relevantPatterns.push(
        `  - LONGCUT: "${pattern.longcut}" → SHORTCUT: "${pattern.shortcut}"`
      );
    }
  }

  return relevantPatterns.length > 0
    ? `\nCOMMON LONGCUT PATTERNS TO LOOK FOR:\n${relevantPatterns.join('\n')}`
    : '';
}

/**
 * Get tool-specific feature suggestions based on tools used in workflow
 */
function getToolFeatureSuggestions(workflow: any): string {
  const toolsUsed = extractToolsFromWorkflow(workflow);

  // Build suggestions based on tools used
  const suggestions: string[] = [];
  for (const tool of toolsUsed) {
    // Match tool to known tools
    for (const [knownTool, features] of Object.entries(TOOL_FEATURE_KNOWLEDGE)) {
      if (tool.includes(knownTool) || knownTool.includes(tool)) {
        suggestions.push(`\n${tool.toUpperCase()} features you might not be using:`);
        features.slice(0, 3).forEach(f => suggestions.push(`  - ${f}`));
      }
    }
  }

  return suggestions.length > 0
    ? `\nTool-specific optimization tips:\n${suggestions.join('\n')}`
    : '';
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
  // Generate opportunities even if no inefficiencies found - use general workflow analysis
  const hasInefficiencies = inefficiencies.length > 0;

  logger.info('A2: Identifying opportunities', {
    inefficiencyCount: inefficiencies.length,
    hasInefficiencies,
    workflowName: workflow.name || workflow.title || 'Unnamed',
  });

  // Prepare inefficiency summary with shorter alternatives for longcuts
  const ineffSummary = inefficiencies
    .map((i) => {
      const base = `- [${i.id}] ${i.type}: ${i.description} (~${i.estimatedWastedSeconds}s wasted)`;
      if (i.type === 'longcut_path' && i.shorterAlternative) {
        return `${base}\n    → Shorter alternative exists: ${i.shorterAlternative}`;
      }
      return base;
    })
    .join('\n');

  // Get tool-specific suggestions
  const toolSuggestions = getToolFeatureSuggestions(workflow);

  // Get longcut patterns for context
  const longcutPatterns = getLongcutPatternsForTools(workflow);

  // Build workflow step summary for analysis even without inefficiencies
  const steps = workflow.steps || [];
  const stepSummary = steps
    .slice(0, 15)
    .map(
      (s: any, i: number) =>
        `${i + 1}. [${s.stepId || `step-${i}`}] ${s.app || s.tool}: ${s.description || 'No description'} (${s.durationSeconds || 0}s)`
    )
    .join('\n');

  // Build context-specific prompt content
  const workflowContext = hasInefficiencies
    ? `**Identified Inefficiencies:**
${ineffSummary}`
    : `**Workflow Steps (for pattern analysis):**
${stepSummary}

NOTE: No specific inefficiencies identified. Generate opportunities based on:
- Common productivity patterns for the tools being used
- AI-assisted development opportunities
- Keyboard shortcuts that could speed up observed patterns`;

  try {
    logger.info('A2: Starting opportunity identification LLM call', {
      workflowId: workflow.workflowId,
      inefficiencyCount: inefficiencies.length,
    });

    const llmStartTime = Date.now();

    // Use concurrency limiter and retry logic for rate limit resilience
    const response = await gpt4oConcurrencyLimiter.run(() =>
      withRetry(
        () => llmProvider.generateStructuredResponse(
          [
            {
              role: 'system',
              content: A2_JUDGE_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: `Identify improvement opportunities for this workflow.

---

## INPUT DATA

**Workflow:** ${workflow.name || workflow.title || 'Unnamed'}
**Tools user is actively using:** ${workflow.tools?.join(', ') || workflow.primaryApp || 'Unknown'}

${workflowContext}

${toolSuggestions}
${longcutPatterns}

---

${A2_JUDGE_OPPORTUNITY_EXAMPLES}

---

## YOUR TASK

Generate 3-5 high-impact opportunities. Apply Evidence Hierarchy and Anti-Hallucination Rules.

**OPPORTUNITY TYPES:**
| Type | When to Use | Required Fields |
|------|-------------|-----------------|
| shortcut_available | Multi-step action has keyboard shortcut | shortcutCommand: exact keys |
| tool_feature_optimization | Tool has underused feature | featureSuggestion: feature name |
| automation | Task can be scripted | suggestedTool: automation tool |
| claude_code_integration | AI can generate/automate | claudeCodeApplicable: true |
| consolidation | Multiple tools → one | suggestedTool: consolidated option |
| elimination | Steps unnecessary | description: explain why |

**STRICT REQUIREMENTS:**
1. inefficiencyId MUST match an ID above OR be "general" if no specific inefficiency
2. estimatedSavingsSeconds MUST be ≤ inefficiency's estimatedWastedSeconds (or 60-180s for "general")
3. suggestedTool MUST be from "Tools user is actively using" above
4. shortcutCommand MUST be a REAL shortcut in the suggested tool
5. confidence: 0.7-0.95 typical (lower if uncertain about user's setup)
6. PRIORITIZE tools user already has over new tool suggestions

${A2_JUDGE_FINAL_CHECKLIST}`,
            },
          ],
          opportunityAnalysisSchema
        ),
        {
          maxRetries: 3,
          baseDelayMs: 2000, // Start with 2 second delay for rate limits
          perAttemptTimeoutMs: LLM_PER_ATTEMPT_TIMEOUT_MS, // 60 seconds per attempt
          totalTimeoutMs: LLM_TOTAL_TIMEOUT_MS, // 2 minutes total
          onRetry: (error, attempt, delayMs) => {
            logger.warn('A2: Retrying opportunity identification', {
              attempt,
              delayMs,
              isRateLimit: isRateLimitError(error),
              isTimeout: error instanceof TimeoutError,
              error: error?.message || String(error),
            });
          },
        }
      )
    );

    const rawOpportunities = response.content.opportunities || [];

    logger.info('A2: Opportunity identification LLM call completed', {
      workflowId: workflow.workflowId,
      durationMs: Date.now() - llmStartTime,
      opportunityCount: rawOpportunities.length,
    });

    const opportunities = rawOpportunities.map((opp: any) => ({
      id: `opp-${uuidv4().slice(0, 8)}`,
      inefficiencyId: opp.inefficiencyId,
      type: opp.type as OpportunityType,
      description: opp.description,
      estimatedSavingsSeconds: opp.estimatedSavingsSeconds,
      suggestedTool: opp.suggestedTool,
      claudeCodeApplicable: opp.claudeCodeApplicable,
      confidence: opp.confidence,
      featureSuggestion: opp.featureSuggestion,
      shortcutCommand: opp.shortcutCommand,
    }));

    logger.info('A2: Opportunities identified', {
      count: opportunities.length,
      types: opportunities.map((o: Opportunity) => o.type),
    });

    return opportunities;
  } catch (err) {
    logger.error('Failed to identify opportunities via LLM after retries', err instanceof Error ? err : new Error(String(err)));
    // Return empty array on failure - no fallbacks
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

// ============================================================================
// EFFECTIVENESS ANALYSIS (Step-by-step quality critique)
// ============================================================================

/**
 * System prompt for effectiveness analysis
 * Focuses on QUALITY and OUTCOMES, not just efficiency/time
 */
const EFFECTIVENESS_ANALYSIS_SYSTEM_PROMPT = `
You are an EFFECTIVENESS ANALYST specializing in workflow QUALITY and OUTCOME assessment.

**YOUR ROLE IS DISTINCT FROM EFFICIENCY ANALYSIS:**
- EFFICIENCY = doing things FASTER (time savings, shortcuts, automation)
- EFFECTIVENESS = doing the RIGHT things BETTER (quality, completeness, decision-making)

You evaluate:
1. **Step Quality**: Was each step done well? Could it have been done better?
2. **Missing Activities**: What should the user have done but didn't?
3. **Content Quality**: How good are the outputs/decisions made?

---

## EFFECTIVENESS EVALUATION FRAMEWORK

### Step Quality Assessment
For each step, evaluate:
- **What they did**: Factual description from step data
- **Quality Rating**: poor/fair/good/excellent
- **Better Alternative**: What could improve the OUTCOME (not speed)
- **Why Better**: Concrete benefit of the alternative

### Quality Ratings Guide
| Rating | Criteria |
|--------|----------|
| excellent | Step shows best-practice approach, thorough execution, high-quality output |
| good | Step is adequate, achieves goal, minor improvements possible |
| fair | Step achieves basic goal but has notable gaps or shortcuts |
| poor | Step is incomplete, low quality, or misses the point |

### Missing Activities Detection
Look for activities that SHOULD have occurred based on the workflow intent:
- **Research gaps**: Did they skip necessary background research?
- **Validation gaps**: Did they skip testing/verification?
- **Documentation gaps**: Did they skip documenting decisions?
- **Planning gaps**: Did they dive in without planning?
- **Review gaps**: Did they skip self-review before completion?

### Content Quality Critique
Evaluate the QUALITY of outputs, not just their existence:
- **Research depth**: How thorough was information gathering?
- **Decision quality**: Were decisions well-reasoned?
- **Output completeness**: Is the work product complete?
- **Attention to detail**: Were edge cases considered?

---

## ANTI-HALLUCINATION RULES

1. **Only reference actual step data** - don't invent activities
2. **Use evidence-based ratings** - cite specific observations
3. **Be constructive** - focus on improvements, not criticism
4. **Consider context** - some "gaps" are intentional trade-offs
5. **Distinguish speculation from observation** - use qualifiers

---

## OUTPUT QUALITY STANDARDS

- **stepAnalysis**: Analyze up to 10 most significant steps
- **missedActivities**: 3-5 high-impact missing activities max
- **contentCritiques**: 2-4 key quality observations
- **effectivenessSummary**: 2-3 sentences capturing key insights
- **topPriorities**: Exactly 3 actionable priorities
`;

/**
 * Analyze workflow effectiveness (quality and outcomes)
 * Complements efficiency analysis with quality-focused evaluation
 */
async function analyzeWorkflowEffectiveness(
  workflows: any[],
  query: string,
  llmProvider: LLMProvider,
  logger: Logger
): Promise<EffectivenessAnalysis | null> {
  if (workflows.length === 0) {
    return null;
  }

  logger.info('A2: Starting effectiveness analysis', {
    workflowCount: workflows.length,
  });

  // Build workflow summary for effectiveness analysis
  const workflowSummaries = workflows.map((workflow, wIndex) => {
    const steps = workflow.steps || [];
    const stepSummary = steps
      .slice(0, 15)
      .map(
        (s: any, i: number) =>
          `  ${i + 1}. [${s.stepId || `step-${i}`}] ${s.app || s.tool}: ${s.description || 'No description'} (${s.durationSeconds || 0}s)`
      )
      .join('\n');

    return `
### Workflow ${wIndex + 1}: ${workflow.name || workflow.title || 'Unnamed'}
**Intent**: ${workflow.intent || 'Unknown'}
**Approach**: ${workflow.approach || 'Unknown'}
**Summary**: ${workflow.summary || 'No summary'}

**Steps:**
${stepSummary}`;
  }).join('\n');

  try {
    const llmStartTime = Date.now();

    const response = await gpt4oConcurrencyLimiter.run(() =>
      withRetry(
        () => llmProvider.generateStructuredResponse(
          [
            {
              role: 'system',
              content: EFFECTIVENESS_ANALYSIS_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: `Analyze the EFFECTIVENESS (quality and outcomes) of these workflows.

User Query: "${query}"

---

## WORKFLOW DATA

${workflowSummaries}

---

## YOUR TASK

Provide a comprehensive EFFECTIVENESS analysis:

1. **Step Analysis**: For each significant step, evaluate:
   - What the user did (factual)
   - Quality rating (poor/fair/good/excellent)
   - What they could have done differently for BETTER OUTCOMES
   - Why the alternative is better

2. **Missed Activities**: Identify 3-5 activities the user SHOULD have done but didn't:
   - Research, validation, documentation, planning, or review gaps
   - Where in the workflow it should have occurred
   - Why it matters and what to do about it

3. **Content Quality Critique**: Evaluate 2-4 aspects of output quality:
   - Research depth, decision quality, completeness, attention to detail
   - Specific observations with evidence
   - Improvement suggestions

4. **Overall Assessment**:
   - Effectiveness score (0-100, where 100 = excellent quality outcomes)
   - Summary of key effectiveness insights
   - Top 3 priorities for improving effectiveness

REMEMBER: Focus on QUALITY and OUTCOMES, not speed/efficiency.`,
            },
          ],
          effectivenessAnalysisSchema
        ),
        {
          maxRetries: 2,
          baseDelayMs: 2000,
          perAttemptTimeoutMs: LLM_PER_ATTEMPT_TIMEOUT_MS,
          totalTimeoutMs: LLM_TOTAL_TIMEOUT_MS,
          onRetry: (error, attempt, delayMs) => {
            logger.warn('A2: Retrying effectiveness analysis', {
              attempt,
              delayMs,
              error: error?.message || String(error),
            });
          },
        }
      )
    );

    logger.info('A2: Effectiveness analysis complete', {
      durationMs: Date.now() - llmStartTime,
      stepAnalysisCount: response.content.stepAnalysis.length,
      missedActivitiesCount: response.content.missedActivities.length,
      effectivenessScore: response.content.overallEffectivenessScore,
    });

    // Convert to typed response with IDs
    const effectivenessAnalysis: EffectivenessAnalysis = {
      stepAnalysis: response.content.stepAnalysis.map((s: any) => ({
        stepId: s.stepId,
        whatUserDid: s.whatUserDid,
        qualityRating: s.qualityRating,
        couldHaveDoneDifferently: s.couldHaveDoneDifferently,
        whyBetter: s.whyBetter,
        confidence: s.confidence,
      })),
      missedActivities: response.content.missedActivities.map((m: any) => ({
        id: `missed-${uuidv4().slice(0, 8)}`,
        activity: m.activity,
        shouldOccurAfter: m.shouldOccurAfter,
        whyImportant: m.whyImportant,
        impactLevel: m.impactLevel,
        recommendation: m.recommendation,
        confidence: m.confidence,
      })),
      contentCritiques: response.content.contentCritiques.map((c: any) => ({
        aspect: c.aspect,
        observation: c.observation,
        rating: c.rating,
        improvementSuggestion: c.improvementSuggestion,
        evidence: c.evidence,
      })),
      overallEffectivenessScore: response.content.overallEffectivenessScore,
      effectivenessSummary: response.content.effectivenessSummary,
      topPriorities: response.content.topPriorities,
      analysisTimestamp: new Date().toISOString(),
    };

    return effectivenessAnalysis;
  } catch (err) {
    logger.error('A2: Failed to analyze effectiveness', err instanceof Error ? err : new Error(String(err)));
    return null;
  }
}
