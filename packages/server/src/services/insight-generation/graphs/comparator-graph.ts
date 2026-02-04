/**
 * A3 Comparator Agent Graph
 *
 * LangGraph implementation of the Comparator Agent (A3) that:
 * 1. Aligns user workflows with peer patterns by intent/approach
 * 2. Identifies step-level differences between user and peer approaches
 * 3. Generates step-by-step transformation plans to achieve peer-level efficiency
 * 4. Produces Claude Code prompts for automatable steps
 *
 * This agent only runs when peer data is available and peer efficiency > user efficiency.
 */

import { StateGraph, END } from '@langchain/langgraph';
import { v4 as uuidv4 } from 'uuid';
import type { Logger } from '../../../core/logger.js';
import type { LLMProvider } from '../../../core/llm-provider.js';
import { withTimeout } from '../../../core/retry-utils.js';

// LLM call timeout constant
const LLM_TIMEOUT_MS = 60000; // 60 seconds
import { InsightStateAnnotation, type InsightState } from '../state/insight-state.js';
import type {
  StepOptimizationPlan,
  OptimizationBlock,
  StepTransformation,
  CurrentStep,
  OptimizedStep,
  UserWorkflow,
  UserStep,
  UserToolbox,
  EnrichedWorkflowStep,
  EnrichedStepStatus,
  ImplementationOption,
  OptimizationSummaryMetrics,
} from '../types.js';
import { isToolInUserToolbox, isSuggestionForUserTools } from '../utils/toolbox-utils.js';
import { getValidatedStepIds } from '../utils/stepid-validator.js';
import { z } from 'zod';
import { A3_COMPARATOR_SYSTEM_PROMPT } from '../prompts/system-prompts.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ComparatorGraphDeps {
  logger: Logger;
  llmProvider: LLMProvider;
}

interface WorkflowAlignment {
  userWorkflow: UserWorkflow;
  peerWorkflow: UserWorkflow;
  alignmentScore: number;
  alignedByIntent: boolean;
  stepMappings: StepMapping[];
}

interface StepMapping {
  userStepId: string | null;
  peerStepId: string | null;
  similarity: number;
  userStep?: UserStep;
  peerStep?: UserStep;
  gapType: 'user_extra' | 'peer_extra' | 'matched' | 'different_approach';
}

// LLM schemas
const workflowAlignmentSchema = z.object({
  alignmentScore: z.number().min(0).max(1),
  alignedByIntent: z.boolean(),
  reasoning: z.string(),
});

const stepComparisonSchema = z.object({
  comparisons: z.array(
    z.object({
      userStepIds: z.array(z.string()),
      peerStepIds: z.array(z.string()),
      gapType: z.enum(['user_extra', 'peer_extra', 'matched', 'different_approach']),
      timeDifference: z.number(),
      improvementOpportunity: z.string().optional(),
      claudeCodeApplicable: z.boolean(),
    })
  ),
});

// ============================================================================
// ENRICHED WORKFLOW SCHEMAS (for detailed view)
// ============================================================================

/** Schema for enriched workflow step */
const enrichedStepSchema = z.object({
  stepNumber: z.number().describe('Sequential step number (1, 2, 3...)'),
  action: z.string().describe('Step action title, e.g., "Prepare Build Environment"'),
  subActions: z.array(z.string()).describe('3-5 specific sub-actions as bullet points'),
  status: z.enum(['keep', 'automate', 'modify', 'remove', 'new']).describe(
    'Step status: keep=manual, automate=should automate, modify=needs changes, remove=unnecessary, new=added step'
  ),
  tool: z.string().optional().describe('Tool/app used, e.g., "Cursor IDE", "Terminal"'),
  durationDisplay: z.string().optional().describe('Human-readable duration: "31s", "2m", "5m"'),
});

/** Schema for implementation option */
const implementationOptionSchema = z.object({
  name: z.string().describe('Option name: "Bash Script", "NPM Script", "GitHub Actions"'),
  command: z.string().describe('Exact command to run, e.g., "./deploy.sh v14.0.0"'),
  setupTime: z.string().describe('Setup time estimate: "15 min", "30 min", "1-2 hours"'),
  setupComplexity: z.enum(['low', 'medium', 'high']),
  recommendation: z.string().describe('Short recommendation: "Quick start", "Best balance", "Future upgrade"'),
  isRecommended: z.boolean().describe('Whether this is the recommended option'),
  prerequisites: z.array(z.string()).optional().describe('Prerequisites needed'),
});

/** Schema for summary metrics */
const summaryMetricsSchema = z.object({
  currentTotalTime: z.string().describe('Current workflow time range, e.g., "10-15 minutes"'),
  optimizedTotalTime: z.string().describe('Optimized workflow time range, e.g., "5-7 minutes"'),
  timeReductionPercent: z.number().describe('Percentage time reduction, e.g., 50'),
  stepsAutomated: z.number().describe('Number of steps being automated'),
  stepsKept: z.number().describe('Number of steps that remain manual'),
});

const transformationSchema = z.object({
  transformations: z.array(
    z.object({
      title: z.string().describe('Short action title, 5-8 words max. E.g., "Automate Log Monitoring"'),
      rationale: z.string(),
      currentStepIds: z.array(z.string()),
      optimizedDescription: z.string(),
      estimatedDurationSeconds: z.number(),
      tool: z.string(),
      claudeCodePrompt: z.string().optional(),
      timeSavedSeconds: z.number(),
      confidence: z.number().min(0).max(1),

      // ENRICHED WORKFLOW DATA (for detailed view)
      currentWorkflowSteps: z.array(enrichedStepSchema).optional().describe(
        'Enriched current workflow steps with status and sub-actions'
      ),
      recommendedWorkflowSteps: z.array(enrichedStepSchema).optional().describe(
        'Enriched recommended workflow steps'
      ),
      implementationOptions: z.array(implementationOptionSchema).optional().describe(
        'Multiple implementation approaches (Bash, NPM, GitHub Actions)'
      ),
      keyBenefits: z.array(z.string()).optional().describe(
        'Key benefits of this optimization (3-5 items)'
      ),
      summaryMetrics: summaryMetricsSchema.optional().describe(
        'Summary metrics for at-a-glance comparison'
      ),
    })
  ),
});

// ============================================================================
// GRAPH NODES
// ============================================================================

/**
 * Node: Align user workflows with peer workflows by intent/approach
 */
async function alignWorkflows(
  state: InsightState,
  deps: ComparatorGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, llmProvider } = deps;

  logger.info('A3: Aligning user and peer workflows');

  if (!state.userEvidence || !state.peerEvidence) {
    logger.warn('A3: Missing evidence for comparison');
    return {
      currentStage: 'a3_alignment_skipped',
      progress: 65,
    };
  }

  // OPTIMIZATION MT2: Limit workflows and use parallel alignment
  // With N user × M peer workflows, LLM calls explode (14 × 11 = 154 calls!)
  // Limit to top 2 user workflows and top 3 peer workflows = max 6 comparisons
  const MAX_USER_WORKFLOWS = 2;
  const MAX_PEER_WORKFLOWS = 3;
  const MAX_ALIGNMENT_TIME_MS = 30000; // 30 second timeout (reduced from 45s)

  // EARLY EXIT: If user workflows have too few steps, skip comparison
  const userWorkflowsWithSteps = state.userEvidence.workflows.filter(w => w.steps.length >= 2);
  if (userWorkflowsWithSteps.length === 0) {
    logger.info('A3: No user workflows with sufficient steps, skipping alignment');
    return {
      currentStage: 'a3_alignment_skipped_insufficient_steps',
      progress: 65,
    };
  }

  const userWorkflows = userWorkflowsWithSteps.slice(0, MAX_USER_WORKFLOWS);
  const peerWorkflows = state.peerEvidence.workflows.slice(0, MAX_PEER_WORKFLOWS);

  logger.info('A3: Limiting workflow comparisons', {
    originalUserWorkflows: state.userEvidence.workflows.length,
    originalPeerWorkflows: state.peerEvidence.workflows.length,
    userWorkflowsWithSteps: userWorkflowsWithSteps.length,
    limitedUserWorkflows: userWorkflows.length,
    limitedPeerWorkflows: peerWorkflows.length,
    maxComparisons: userWorkflows.length * peerWorkflows.length,
  });

  const alignments: WorkflowAlignment[] = [];
  const startTime = Date.now();

  // OPTIMIZATION MT2: Run alignments in PARALLEL for each user workflow
  // Use Promise.allSettled to handle partial failures gracefully
  const alignmentPromises = userWorkflows.map(async (userWorkflow) => {
    let bestMatch: WorkflowAlignment | null = null;
    let bestScore = 0;

    // For each user workflow, evaluate all peer workflows in parallel
    const peerAlignmentPromises = peerWorkflows.map(async (peerWorkflow) => {
      try {
        return await alignTwoWorkflows(
          userWorkflow,
          peerWorkflow,
          llmProvider,
          logger
        );
      } catch (err) {
        logger.warn('A3: Single alignment failed, continuing', {
          userWorkflow: userWorkflow.title,
          peerWorkflow: peerWorkflow.title,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
    });

    // Wait for all peer alignments for this user workflow
    const peerResults = await Promise.all(peerAlignmentPromises);

    // Find best match among peer results
    for (const alignment of peerResults) {
      if (alignment && alignment.alignmentScore > bestScore) {
        bestScore = alignment.alignmentScore;
        bestMatch = alignment;
      }
    }

    return bestMatch;
  });

  // Apply timeout to entire parallel alignment process
  const timeoutPromise = new Promise<null[]>((resolve) => {
    setTimeout(() => {
      logger.warn('A3: Alignment timeout reached');
      resolve([]);
    }, MAX_ALIGNMENT_TIME_MS);
  });

  const results = await Promise.race([
    Promise.all(alignmentPromises),
    timeoutPromise,
  ]);

  // Collect successful alignments with score > 0.5
  for (const bestMatch of results) {
    if (bestMatch && bestMatch.alignmentScore > 0.5) {
      alignments.push(bestMatch);
    }
  }

  logger.info('A3: Workflow alignment complete', {
    userWorkflows: userWorkflows.length,
    peerWorkflows: peerWorkflows.length,
    alignedPairs: alignments.length,
    elapsedMs: Date.now() - startTime,
  });

  // Log detailed output for debugging (only when INSIGHT_DEBUG is enabled)
  if (process.env.INSIGHT_DEBUG === 'true') {
    logger.debug('=== A3 COMPARATOR AGENT OUTPUT (Alignment) ===');
    logger.debug(JSON.stringify({
      agent: 'A3_COMPARATOR',
      outputType: 'workflowAlignment',
      alignment: {
        userWorkflowCount: state.userEvidence.workflows.length,
        peerWorkflowCount: state.peerEvidence.workflows.length,
        alignedPairs: alignments.length,
        alignments: alignments.map(a => ({
          userWorkflow: a.userWorkflow.title,
          peerWorkflow: a.peerWorkflow.title,
          alignmentScore: a.alignmentScore,
          alignedByIntent: a.alignedByIntent,
        })),
      },
    }));
    logger.debug('=== END A3 ALIGNMENT OUTPUT ===');
  }

  // Store alignments in state for use by generateTransformations
  const workflowAlignments = alignments.map(a => ({
    userWorkflowId: a.userWorkflow.workflowId,
    peerWorkflowId: a.peerWorkflow.workflowId,
    alignmentScore: a.alignmentScore,
  }));

  logger.info('A3: Storing workflow alignments in state', {
    alignmentCount: workflowAlignments.length,
    alignments: workflowAlignments,
  });

  return {
    workflowAlignments,
    currentStage: 'a3_alignment_complete',
    progress: 68,
  };
}

/**
 * Node: Compare steps between aligned workflows
 */
async function compareSteps(
  state: InsightState,
  deps: ComparatorGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, llmProvider } = deps;
  const startTime = Date.now();

  logger.info('A3: Comparing steps between workflows');

  if (!state.userEvidence || !state.peerEvidence) {
    logger.info('A3: No evidence for step comparison, skipping');
    return {
      currentStage: 'a3_comparison_skipped',
      progress: 72,
    };
  }

  // Compare primary workflows (first of each)
  const userWorkflow = state.userEvidence.workflows[0];
  const peerWorkflow = state.peerEvidence.workflows[0];

  if (!userWorkflow || !peerWorkflow) {
    logger.info('A3: Missing user or peer workflow for comparison');
    return {
      currentStage: 'a3_comparison_no_workflows',
      progress: 72,
    };
  }

  try {
    const comparison = await compareWorkflowSteps(
      userWorkflow,
      peerWorkflow,
      llmProvider,
      logger
    );

    logger.info('A3: Step comparison complete', {
      comparisonCount: comparison.length,
      improvementOpportunities: comparison.filter((c) => c.improvementOpportunity).length,
      elapsedMs: Date.now() - startTime,
    });

    // Log detailed output for debugging (only when INSIGHT_DEBUG is enabled)
    if (process.env.INSIGHT_DEBUG === 'true') {
      logger.debug('=== A3 COMPARATOR AGENT OUTPUT (Step Comparison) ===');
      logger.debug(JSON.stringify({
        agent: 'A3_COMPARATOR',
        outputType: 'stepComparison',
        comparison: {
          totalComparisons: comparison.length,
          improvementOpportunities: comparison.filter((c) => c.improvementOpportunity).length,
          comparisons: comparison.map(c => ({
            userStepIds: c.userStepIds,
            peerStepIds: c.peerStepIds,
            gapType: c.gapType,
            timeDifference: c.timeDifference,
            improvementOpportunity: c.improvementOpportunity,
            claudeCodeApplicable: c.claudeCodeApplicable,
          })),
        },
      }));
      logger.debug('=== END A3 STEP COMPARISON OUTPUT ===');
    }

    return {
      currentStage: 'a3_comparison_complete',
      progress: 72,
    };
  } catch (err) {
    logger.error('A3: Step comparison failed', err instanceof Error ? err : new Error(String(err)));
    return {
      errors: [`A3 step comparison failed: ${err}`],
      currentStage: 'a3_comparison_failed',
    };
  }
}

/**
 * Node: Generate step transformations
 * FIX-1: Now processes MULTIPLE aligned workflow pairs instead of just the first
 */
async function generateTransformations(
  state: InsightState,
  deps: ComparatorGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, llmProvider } = deps;
  const startTime = Date.now();

  logger.info('A3: Generating step transformations (multi-workflow)');

  if (!state.userEvidence || !state.peerEvidence || !state.userDiagnostics) {
    logger.info('A3: Missing evidence for transformations, skipping');
    return {
      peerOptimizationPlan: null,
      currentStage: 'a3_transformations_skipped',
      progress: 75,
    };
  }

  // FIX-1: Use workflow alignments from state, or fall back to processing all user workflows
  const alignments = state.workflowAlignments;
  const allBlocks: OptimizationBlock[] = [];
  let totalTimeSaved = 0;
  let processedPairs = 0;

  if (alignments && alignments.length > 0) {
    // Use the pre-computed alignments
    logger.info('A3: Using stored workflow alignments', { alignmentCount: alignments.length });

    for (const alignment of alignments) {
      const userWorkflow = state.userEvidence.workflows.find(
        (w) => w.workflowId === alignment.userWorkflowId
      );
      const peerWorkflow = state.peerEvidence.workflows.find(
        (w) => w.workflowId === alignment.peerWorkflowId
      );

      if (!userWorkflow || !peerWorkflow) {
        logger.warn('A3: Could not find workflows for alignment', { alignment });
        continue;
      }

      try {
        const plan = await createOptimizationPlan(
          userWorkflow,
          peerWorkflow,
          state.userDiagnostics,
          state.peerDiagnostics,
          llmProvider,
          logger,
          state.userToolbox
        );

        allBlocks.push(...plan.blocks);
        totalTimeSaved += plan.totalTimeSaved;
        processedPairs++;

        logger.info('A3: Processed aligned pair', {
          userWorkflow: userWorkflow.title,
          peerWorkflow: peerWorkflow.title,
          blocksGenerated: plan.blocks.length,
          timeSaved: plan.totalTimeSaved,
        });
      } catch (err) {
        logger.warn('A3: Failed to process aligned pair, continuing', {
          userWorkflow: userWorkflow.title,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } else {
    // Fallback: Process top 3 user workflows against best-matching peer workflows
    logger.info('A3: No alignments stored, processing top user workflows');
    const maxWorkflows = Math.min(3, state.userEvidence.workflows.length);

    for (let i = 0; i < maxWorkflows; i++) {
      const userWorkflow = state.userEvidence.workflows[i];
      // Find best matching peer workflow by intent similarity
      const peerWorkflow = findBestMatchingPeer(
        userWorkflow,
        state.peerEvidence.workflows
      );

      if (!peerWorkflow) {
        logger.info('A3: No matching peer for workflow', { userWorkflow: userWorkflow.title });
        continue;
      }

      try {
        const plan = await createOptimizationPlan(
          userWorkflow,
          peerWorkflow,
          state.userDiagnostics,
          state.peerDiagnostics,
          llmProvider,
          logger,
          state.userToolbox
        );

        allBlocks.push(...plan.blocks);
        totalTimeSaved += plan.totalTimeSaved;
        processedPairs++;

        logger.info('A3: Processed fallback pair', {
          userWorkflow: userWorkflow.title,
          peerWorkflow: peerWorkflow.title,
          blocksGenerated: plan.blocks.length,
        });
      } catch (err) {
        logger.warn('A3: Failed to process fallback pair, continuing', {
          userWorkflow: userWorkflow.title,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  // No pairs processed - fall back to single workflow comparison
  // NOTE: This is a "new workflow suggestion" - user may not currently do this work
  // The isNewWorkflowSuggestion flag will be set on blocks to indicate this
  if (processedPairs === 0) {
    const userWorkflow = state.userEvidence.workflows[0];
    const peerWorkflow = state.peerEvidence.workflows[0];

    if (!userWorkflow || !peerWorkflow) {
      logger.info('A3: No workflows available for fallback comparison');
      return {
        peerOptimizationPlan: null,
        currentStage: 'a3_transformations_no_workflows',
        progress: 75,
      };
    }

    logger.info('A3: Using fallback comparison (no matching peers found - this is a new workflow suggestion)', {
      userWorkflow: userWorkflow.title,
      peerWorkflow: peerWorkflow.title,
    });

    try {
      const plan = await createOptimizationPlan(
        userWorkflow,
        peerWorkflow,
        state.userDiagnostics,
        state.peerDiagnostics,
        llmProvider,
        logger,
        state.userToolbox
      );

      // Mark all blocks as "new workflow suggestions" since no matching peer was found
      // This means the user may not currently do this work
      // Clear BOTH enriched and legacy current steps - don't show fabricated steps for work user doesn't do
      for (const block of plan.blocks) {
        block.isNewWorkflowSuggestion = true;
        block.currentWorkflowSteps = undefined; // Don't show fabricated "current steps" (enriched view)
        // Also clear legacy stepTransformations.currentSteps to prevent fallback view from showing them
        if (block.stepTransformations) {
          for (const transform of block.stepTransformations) {
            transform.currentSteps = [];
          }
        }
      }

      allBlocks.push(...plan.blocks);
      totalTimeSaved = plan.totalTimeSaved;
      processedPairs = 1;
    } catch (err) {
      logger.error('A3: Fallback single workflow comparison failed', err instanceof Error ? err : new Error(String(err)));
    }
  }

  // Build final optimization plan from all blocks
  const totalCurrentTime = allBlocks.reduce((sum, b) => sum + b.currentTimeTotal, 0);
  const optimizationPlan: StepOptimizationPlan = {
    blocks: allBlocks,
    totalTimeSaved,
    totalRelativeImprovement: totalCurrentTime > 0 ? (totalTimeSaved / totalCurrentTime) * 100 : 0,
    passesThreshold: false, // Will be set by orchestrator
  };

  logger.info('A3: Multi-workflow transformations complete', {
    processedPairs,
    totalBlocks: allBlocks.length,
    totalTimeSaved,
    elapsedMs: Date.now() - startTime,
  });

  // Log detailed output for debugging (only when INSIGHT_DEBUG is enabled)
  if (process.env.INSIGHT_DEBUG === 'true') {
    logger.debug('=== A3 COMPARATOR AGENT OUTPUT (Optimization Plan) ===');
    logger.debug(JSON.stringify({
      agent: 'A3_COMPARATOR',
      outputType: 'peerOptimizationPlan',
      plan: {
        totalBlocks: optimizationPlan.blocks.length,
        totalTimeSaved: optimizationPlan.totalTimeSaved,
        totalRelativeImprovement: optimizationPlan.totalRelativeImprovement,
        passesThreshold: optimizationPlan.passesThreshold,
        blocks: optimizationPlan.blocks.map(b => ({
          blockId: b.blockId,
          workflowName: b.workflowName,
          currentTimeTotal: b.currentTimeTotal,
          optimizedTimeTotal: b.optimizedTimeTotal,
          timeSaved: b.timeSaved,
          relativeImprovement: b.relativeImprovement,
          confidence: b.confidence,
          whyThisMatters: b.whyThisMatters,
          source: b.source,
          transformationCount: b.stepTransformations.length,
          transformations: b.stepTransformations.map(t => ({
            currentStepCount: t.currentSteps.length,
            optimizedStepCount: t.optimizedSteps.length,
            timeSavedSeconds: t.timeSavedSeconds,
            confidence: t.confidence,
            rationale: t.rationale,
            optimizedTools: t.optimizedSteps.map(s => s.tool),
            hasClaudeCodePrompt: t.optimizedSteps.some(s => !!s.claudeCodePrompt),
          })),
        })),
      },
    }));
    logger.debug('=== END A3 OPTIMIZATION PLAN OUTPUT ===');
  }

  return {
    peerOptimizationPlan: optimizationPlan,
    currentStage: 'a3_transformations_complete',
    progress: 75,
  };
}

/**
 * Find best matching peer workflow using simple text similarity
 * FIX-1 helper: Used when no pre-computed alignments are available
 */
function findBestMatchingPeer(
  userWorkflow: UserWorkflow,
  peerWorkflows: UserWorkflow[]
): UserWorkflow | null {
  if (!peerWorkflows || peerWorkflows.length === 0) {
    return null;
  }

  let bestMatch: UserWorkflow | null = null;
  let bestScore = 0;

  for (const peerWorkflow of peerWorkflows) {
    // Calculate similarity based on intent and tools
    const intentSimilarity = calculateTextSimilarity(
      userWorkflow.intent || '',
      peerWorkflow.intent || ''
    );
    const toolOverlap = calculateToolOverlap(
      userWorkflow.tools || [],
      peerWorkflow.tools || []
    );

    // Combined score (60% intent, 40% tools)
    const score = intentSimilarity * 0.6 + toolOverlap * 0.4;

    if (score > bestScore && score > 0.3) {
      bestScore = score;
      bestMatch = peerWorkflow;
    }
  }

  return bestMatch;
}

/**
 * Calculate tool overlap ratio between two tool lists
 */
function calculateToolOverlap(tools1: string[], tools2: string[]): number {
  if (tools1.length === 0 || tools2.length === 0) return 0;

  const normalized1 = tools1.map(t => t.toLowerCase());
  const normalized2 = tools2.map(t => t.toLowerCase());
  const set2 = new Set(normalized2);

  let intersection = 0;
  for (const tool of normalized1) {
    if (set2.has(tool)) intersection++;
  }

  const uniqueTools = new Set([...normalized1, ...normalized2]);
  return uniqueTools.size > 0 ? intersection / uniqueTools.size : 0;
}

// ============================================================================
// GRAPH BUILDER
// ============================================================================

/**
 * Create the A3 Comparator Agent graph
 */
export function createComparatorGraph(deps: ComparatorGraphDeps) {
  const { logger } = deps;

  logger.info('Creating A3 Comparator Graph');

  const graph = new StateGraph(InsightStateAnnotation)
    // Add nodes
    .addNode('align_workflows', (state) => alignWorkflows(state, deps))
    .addNode('compare_steps', (state) => compareSteps(state, deps))
    .addNode('generate_transformations', (state) => generateTransformations(state, deps))

    // Define edges
    .addEdge('__start__', 'align_workflows')
    .addEdge('align_workflows', 'compare_steps')
    .addEdge('compare_steps', 'generate_transformations')
    .addEdge('generate_transformations', END);

  return graph.compile();
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Align two workflows using LLM to assess similarity
 */
async function alignTwoWorkflows(
  userWorkflow: UserWorkflow,
  peerWorkflow: UserWorkflow,
  llmProvider: LLMProvider,
  logger: Logger
): Promise<WorkflowAlignment> {
  try {
    const response = await withTimeout(
      llmProvider.generateStructuredResponse(
        [
          {
            role: 'system',
            content: A3_COMPARATOR_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: `Compare these two workflows to determine if they have similar intents and can be meaningfully compared:

User Workflow:
- Name: ${userWorkflow.title}
- Intent: ${userWorkflow.intent}
- Approach: ${userWorkflow.approach}
- Steps: ${userWorkflow.steps.length}
- Tools: ${userWorkflow.tools.join(', ')}

Peer Workflow:
- Name: ${peerWorkflow.title}
- Intent: ${peerWorkflow.intent}
- Approach: ${peerWorkflow.approach}
- Steps: ${peerWorkflow.steps.length}
- Tools: ${peerWorkflow.tools.join(', ')}

Rate the alignment (0-1) and explain if they can be compared.`,
          },
        ],
        workflowAlignmentSchema
      ),
      LLM_TIMEOUT_MS,
      'A3 workflow alignment timed out'
    );

    return {
      userWorkflow,
      peerWorkflow,
      alignmentScore: response.content.alignmentScore,
      alignedByIntent: response.content.alignedByIntent,
      stepMappings: [], // Will be filled in comparison step
    };
  } catch (err) {
    logger.warn('Workflow alignment LLM call failed', err instanceof Error ? err : new Error(String(err)));
    // Fall back to simple heuristic
    const intentSimilarity = calculateTextSimilarity(
      userWorkflow.intent,
      peerWorkflow.intent
    );
    return {
      userWorkflow,
      peerWorkflow,
      alignmentScore: intentSimilarity,
      alignedByIntent: intentSimilarity > 0.5,
      stepMappings: [],
    };
  }
}

/**
 * Compare steps between two workflows
 */
async function compareWorkflowSteps(
  userWorkflow: UserWorkflow,
  peerWorkflow: UserWorkflow,
  llmProvider: LLMProvider,
  logger: Logger
): Promise<any[]> {
  // Prepare step summaries
  const userStepsSummary = userWorkflow.steps
    .map(
      (s, i) =>
        `[${s.stepId}] ${i + 1}. ${s.app}: ${s.description} (${s.durationSeconds}s)`
    )
    .join('\n');

  const peerStepsSummary = peerWorkflow.steps
    .map(
      (s, i) =>
        `[${s.stepId}] ${i + 1}. ${s.app}: ${s.description} (${s.durationSeconds}s)`
    )
    .join('\n');

  try {
    const response = await withTimeout(
      llmProvider.generateStructuredResponse(
        [
          {
            role: 'system',
            content: A3_COMPARATOR_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: `Compare steps between these two workflows to identify efficiency gaps:

User Workflow: ${userWorkflow.title}
${userStepsSummary}

Peer Workflow (more efficient pattern): ${peerWorkflow.title}
${peerStepsSummary}

For each comparison:
1. Match user steps to corresponding peer steps
2. Identify gaps (user_extra = user does unnecessary steps, peer_extra = peer has efficient steps user lacks, different_approach = same goal, different method)
3. Calculate time difference
4. Suggest improvements
5. Flag if Claude Code could help automate`,
          },
        ],
        stepComparisonSchema
      ),
      LLM_TIMEOUT_MS,
      'A3 step comparison timed out'
    );

    return response.content.comparisons;
  } catch (err) {
    logger.error('Step comparison LLM call failed', err instanceof Error ? err : new Error(String(err)));
    return [];
  }
}

/**
 * Create optimization plan from workflow comparison
 */
async function createOptimizationPlan(
  userWorkflow: UserWorkflow,
  peerWorkflow: UserWorkflow,
  userDiagnostics: any,
  peerDiagnostics: any,
  llmProvider: LLMProvider,
  logger: Logger,
  userToolbox?: UserToolbox | null
): Promise<StepOptimizationPlan> {
  // Use LLM to generate detailed transformations
  const transformations = await generateDetailedTransformations(
    userWorkflow,
    peerWorkflow,
    userDiagnostics,
    llmProvider,
    logger
  );

  // Calculate totals
  let totalTimeSaved = 0;
  const blocks: OptimizationBlock[] = [];

  // Build lookup map for step data retrieval
  const stepById = new Map(userWorkflow.steps.map(s => [s.stepId, s]));

  for (const trans of transformations) {
    // Use centralized stepId validation WITHOUT fallback
    // If LLM's stepIds don't match actual user steps, don't use arbitrary fallback steps
    const validatedStepIds = getValidatedStepIds(
      trans.currentStepIds || [],
      userWorkflow.steps,
      logger
    );

    // Skip transformation if no valid steps found (user doesn't do this work)
    if (validatedStepIds.length === 0) {
      logger.warn('A3: Skipping transformation - no valid steps found', {
        originalStepIds: trans.currentStepIds,
        transformationRationale: trans.rationale?.slice(0, 100),
      });
      continue;
    }

    const currentTime = validatedStepIds.reduce((sum: number, id: string) => {
      const step = stepById.get(id);
      return sum + (step?.durationSeconds || 0);
    }, 0);

    const optimizedTime = trans.estimatedDurationSeconds;
    const timeSaved = currentTime - optimizedTime;

    // FIX-2: Create card even if timeSaved is 0 or negative, but with adjusted messaging
    // Only skip if currentTime is 0 (no valid data at all)
    if (currentTime === 0) {
      logger.warn('A3: Skipping transformation - no duration data for steps', {
        validatedStepIds,
      });
      continue;
    }

    totalTimeSaved += Math.max(0, timeSaved);

    const stepTransformation: StepTransformation = {
      transformationId: uuidv4(),
      // FIX-5: Use validated stepIds with proper lookup
      currentSteps: validatedStepIds.map((id: string) => {
        const step = stepById.get(id);
        return {
          stepId: id,
          tool: step?.app || 'unknown',
          durationSeconds: step?.durationSeconds || 0,
          description: step?.description || '',
        } as CurrentStep;
      }),
      optimizedSteps: [
        {
          stepId: `opt-${uuidv4().slice(0, 8)}`,
          tool: trans.tool,
          estimatedDurationSeconds: trans.estimatedDurationSeconds,
          description: trans.optimizedDescription,
          claudeCodePrompt: trans.claudeCodePrompt,
          isNew: true,
          replacesSteps: validatedStepIds,  // FIX-5: Use validated stepIds
          // Use both exact match and smart matching for descriptions
          isInUserToolbox: isToolInUserToolbox(trans.tool, userToolbox) ||
            isSuggestionForUserTools(trans.tool, userToolbox) ||
            isSuggestionForUserTools(trans.optimizedDescription, userToolbox),
        } as OptimizedStep,
      ],
      timeSavedSeconds: Math.max(0, timeSaved),  // FIX-2: Ensure non-negative
      confidence: trans.confidence,
      rationale: trans.rationale,
    };

    // Process enriched workflow data from LLM response
    const currentWorkflowSteps: EnrichedWorkflowStep[] | undefined = trans.currentWorkflowSteps?.map(
      (step: any, idx: number) => ({
        stepNumber: step.stepNumber || idx + 1,
        action: step.action || '',
        subActions: step.subActions || [],
        status: step.status || 'keep',
        tool: step.tool,
        durationSeconds: step.durationSeconds,
        durationDisplay: step.durationDisplay,
      })
    );

    const recommendedWorkflowSteps: EnrichedWorkflowStep[] | undefined = trans.recommendedWorkflowSteps?.map(
      (step: any, idx: number) => ({
        stepNumber: step.stepNumber || idx + 1,
        action: step.action || '',
        subActions: step.subActions || [],
        status: step.status || 'new',
        tool: step.tool,
        durationSeconds: step.durationSeconds,
        durationDisplay: step.durationDisplay,
      })
    );

    const implementationOptions: ImplementationOption[] | undefined = trans.implementationOptions?.map(
      (opt: any, idx: number) => ({
        id: `impl-${uuidv4().slice(0, 8)}`,
        name: opt.name || '',
        command: opt.command || '',
        setupTime: opt.setupTime || '',
        setupComplexity: opt.setupComplexity || 'medium',
        recommendation: opt.recommendation || '',
        isRecommended: opt.isRecommended || false,
        prerequisites: opt.prerequisites,
      })
    );

    const summaryMetrics: OptimizationSummaryMetrics | undefined = trans.summaryMetrics
      ? {
          currentTotalTime: trans.summaryMetrics.currentTotalTime || '',
          optimizedTotalTime: trans.summaryMetrics.optimizedTotalTime || '',
          timeReductionPercent: trans.summaryMetrics.timeReductionPercent || 0,
          stepsAutomated: trans.summaryMetrics.stepsAutomated || 0,
          stepsKept: trans.summaryMetrics.stepsKept || 0,
        }
      : undefined;

    // =========================================================================
    // FALLBACK: Create enriched data from stepTransformation if LLM didn't return it
    // NOTE: We do NOT fabricate currentWorkflowSteps - if user doesn't have steps,
    // this is a NEW workflow suggestion, not an optimization of existing workflow
    // =========================================================================

    // Helper to format duration
    const formatDuration = (seconds: number): string => {
      if (seconds < 60) return `${Math.round(seconds)}s`;
      if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
      const hours = Math.floor(seconds / 3600);
      const mins = Math.round((seconds % 3600) / 60);
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    };

    // Check if user actually has current steps for this workflow
    // Use stepTransformation.currentSteps (built from ACTUAL validated user steps)
    // NOT currentWorkflowSteps (which is LLM-generated and may be fabricated)
    const userHasCurrentSteps = stepTransformation.currentSteps && stepTransformation.currentSteps.length > 0;
    const isNewWorkflowSuggestion = !userHasCurrentSteps;

    // If user has NO actual steps, don't use LLM-generated currentWorkflowSteps (they're fabricated)
    // Only use currentWorkflowSteps if user actually has steps in their workflow
    const finalCurrentSteps: EnrichedWorkflowStep[] | undefined = userHasCurrentSteps
      ? currentWorkflowSteps
      : undefined;

    // Fallback: Create recommendedWorkflowSteps from stepTransformation.optimizedSteps
    const fallbackRecommendedSteps: EnrichedWorkflowStep[] | undefined =
      (!recommendedWorkflowSteps || recommendedWorkflowSteps.length === 0) && stepTransformation.optimizedSteps.length > 0
        ? stepTransformation.optimizedSteps.map((step, idx) => ({
            stepNumber: idx + 1,
            action: step.description?.split(' - ')[0] || `Optimized Step ${idx + 1}`,
            subActions: [
              `Use ${step.tool}`,
              step.description?.split(' - ')[1] || 'Automated approach',
              step.claudeCodePrompt ? 'Can be automated with Claude Code' : 'Manual optimization',
            ],
            status: step.isNew ? 'new' as EnrichedStepStatus : 'keep' as EnrichedStepStatus,
            tool: step.tool,
            durationSeconds: step.estimatedDurationSeconds,
            durationDisplay: formatDuration(step.estimatedDurationSeconds),
          }))
        : recommendedWorkflowSteps;

    // Fallback: Create implementationOptions if not provided
    const fallbackImplementationOptions: ImplementationOption[] | undefined =
      (!implementationOptions || implementationOptions.length === 0)
        ? [
            {
              id: `impl-${uuidv4().slice(0, 8)}`,
              name: trans.claudeCodePrompt ? 'AI Prompt Template' : (trans.tool || 'Recommended Approach'),
              command: trans.claudeCodePrompt
                ? trans.claudeCodePrompt
                : `Use ${trans.tool} for this optimization`,
              setupTime: '15-30 min',
              setupComplexity: 'medium' as const,
              recommendation: trans.claudeCodePrompt ? 'Quick AI-assisted approach' : 'Recommended',
              isRecommended: true,
              prerequisites: trans.tool ? [`Set up ${trans.tool}`] : undefined,
            },
          ]
        : implementationOptions;

    // Fallback: Create keyBenefits from rationale
    const fallbackKeyBenefits: string[] | undefined =
      (!trans.keyBenefits || trans.keyBenefits.length === 0)
        ? [
            `Save ${formatDuration(Math.max(0, timeSaved))} per workflow execution`,
            `${Math.round(currentTime > 0 ? (timeSaved / currentTime) * 100 : 0)}% efficiency improvement`,
            trans.rationale?.slice(0, 100) || 'Streamlined workflow',
          ]
        : trans.keyBenefits;

    // Fallback: Create summaryMetrics from timing data
    const fallbackSummaryMetrics: OptimizationSummaryMetrics | undefined =
      !summaryMetrics
        ? {
            currentTotalTime: formatDuration(currentTime),
            optimizedTotalTime: formatDuration(optimizedTime),
            timeReductionPercent: currentTime > 0 ? Math.round((timeSaved / currentTime) * 100) : 0,
            stepsAutomated: stepTransformation.currentSteps.length,
            stepsKept: 0,
          }
        : summaryMetrics;

    // Log if this is a new workflow suggestion (user has no current steps)
    if (isNewWorkflowSuggestion) {
      logger.info('A3: New workflow suggestion from peers (user has no current steps)', {
        workflowId: userWorkflow.workflowId,
        isNewWorkflowSuggestion: true,
        recommendedStepsCount: fallbackRecommendedSteps?.length || 0,
      });
    }

    // Calculate error-prone step count (steps being automated) - only if user has current steps
    const errorProneStepCount = finalCurrentSteps?.filter(
      (s) => s.status === 'automate'
    ).length;

    blocks.push({
      blockId: uuidv4(),
      workflowName: userWorkflow.title || 'Workflow',
      workflowId: userWorkflow.workflowId,
      currentTimeTotal: currentTime,
      optimizedTimeTotal: optimizedTime,
      timeSaved,
      relativeImprovement: currentTime > 0 ? (timeSaved / currentTime) * 100 : 0,
      confidence: trans.confidence,
      title: trans.title || generateFallbackTitle(trans.tool, trans.rationale),
      whyThisMatters: trans.rationale,
      metricDeltas: {},
      stepTransformations: [stepTransformation],
      source: 'peer_comparison',

      // ENRICHED WORKFLOW DATA (for detailed view)
      // NOTE: currentWorkflowSteps is NOT fabricated - if user has no steps, it stays empty
      currentWorkflowSteps: finalCurrentSteps,
      recommendedWorkflowSteps: fallbackRecommendedSteps,
      implementationOptions: fallbackImplementationOptions,
      keyBenefits: fallbackKeyBenefits,
      errorProneStepCount: finalCurrentSteps?.filter((s: EnrichedWorkflowStep) => s.status === 'automate').length,
      summaryMetrics: fallbackSummaryMetrics,
      // Flag to indicate this is a NEW workflow suggestion, not optimization of existing workflow
      isNewWorkflowSuggestion,
    });
  }

  const totalCurrentTime = blocks.reduce((sum, b) => sum + b.currentTimeTotal, 0);

  return {
    blocks,
    totalTimeSaved,
    totalRelativeImprovement:
      totalCurrentTime > 0 ? (totalTimeSaved / totalCurrentTime) * 100 : 0,
    passesThreshold: false, // Will be set by orchestrator
  };
}

/**
 * Generate detailed transformations using LLM
 */
async function generateDetailedTransformations(
  userWorkflow: UserWorkflow,
  peerWorkflow: UserWorkflow,
  userDiagnostics: any,
  llmProvider: LLMProvider,
  logger: Logger
): Promise<any[]> {
  // Prepare context
  const userStepsSummary = userWorkflow.steps
    .map(
      (s, i) =>
        `[${s.stepId}] ${s.app}: ${s.description} (${s.durationSeconds}s)`
    )
    .join('\n');

  const inefficiencies =
    userDiagnostics?.inefficiencies
      ?.map((i: any) => `- ${i.type}: ${i.description} (steps: ${i.stepIds.join(', ')})`)
      .join('\n') || 'None identified';

  const peerApproach = peerWorkflow.steps
    .map((s, i) => `${i + 1}. ${s.app}: ${s.description} (${s.durationSeconds}s)`)
    .join('\n');

  try {
    const response = await withTimeout(
      llmProvider.generateStructuredResponse(
        [
          {
            role: 'system',
            content: A3_COMPARATOR_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: `Generate detailed step-level transformations to help the user achieve peer-level efficiency.

## Context

**User's Current Workflow:**
${userStepsSummary}

**Identified Inefficiencies:**
${inefficiencies}

**Peer's More Efficient Approach:**
${peerApproach}

## Instructions

For each transformation, provide ALL of the following:

### 1. Basic Info (REQUIRED)
- **title**: SHORT action-oriented title (5-8 words MAX). Examples: "Automate GCS Upload and Slack Notification", "Use Script for Deployment"
- **rationale**: Why this transformation helps
- **currentStepIds**: Which user steps this optimizes (array of stepIds from above)
- **optimizedDescription**: Description of the optimized approach
- **estimatedDurationSeconds**: Time for optimized approach in seconds
- **tool**: Primary tool for the optimized approach
- **claudeCodePrompt**: If applicable, a prompt for Claude Code automation
- **timeSavedSeconds**: Estimated time saved in seconds
- **confidence**: 0-1 rating

### 2. Current Workflow Steps (REQUIRED - currentWorkflowSteps)
List ALL steps in the user's current workflow with:
- **stepNumber**: Sequential number (1, 2, 3...)
- **action**: Step title (e.g., "Prepare Build Environment")
- **subActions**: 3-5 specific bullet points of what this step involves (e.g., ["Review environment variables in Cursor IDE", "Check configuration files", "Monitor Lighthouse AI panel"])
- **status**: One of:
  - "keep" = User should continue doing this manually (valuable human judgment)
  - "automate" = This step can and should be automated
  - "modify" = This step needs changes but not full automation
  - "remove" = This step is unnecessary
- **tool**: Tool used (e.g., "Cursor IDE", "Terminal", "Browser")
- **durationDisplay**: Human-readable duration ("31s", "2m", "5m")

### 3. Recommended Workflow Steps (REQUIRED - recommendedWorkflowSteps)
List the OPTIMIZED workflow with:
- Same fields as current workflow
- Use status "new" for newly added automated steps
- Use status "keep" for steps that remain manual
- Show how multiple manual steps are consolidated into fewer automated steps

### 4. Implementation Options (REQUIRED - implementationOptions)
Provide 2-3 implementation approaches with:
- **name**: "Bash Script", "NPM Script", "GitHub Actions", "Python Script", etc.
- **command**: EXACT command to run (e.g., \`./deploy.sh v14.0.0\`, \`npm run release -- v14.0.0\`, \`git tag v14.0.0 && git push origin v14.0.0\`)
- **setupTime**: Realistic setup time ("15 min", "30 min", "1-2 hours")
- **setupComplexity**: "low", "medium", or "high"
- **recommendation**: Short label ("Quick start", "Best balance", "Future upgrade")
- **isRecommended**: true for the BEST option (exactly one should be true)
- **prerequisites**: What needs to be set up first (optional array)

### 5. Key Benefits (REQUIRED - keyBenefits)
List 3-5 key benefits as strings:
- Focus on time saved, errors prevented, consistency gained
- Be specific (e.g., "Eliminates copy-paste errors in GCS paths", "Reduces deployment time by 50%")

### 6. Summary Metrics (REQUIRED - summaryMetrics)
- **currentTotalTime**: Range for current workflow ("10-15 minutes")
- **optimizedTotalTime**: Range for optimized workflow ("5-7 minutes")
- **timeReductionPercent**: Percentage reduction (e.g., 50)
- **stepsAutomated**: Count of steps being automated
- **stepsKept**: Count of steps that remain manual

## Important Notes
- Focus on HIGH-IMPACT transformations that address identified inefficiencies
- Be SPECIFIC with commands - they should be copy-paste executable
- At least one implementation option should have isRecommended: true
- Sub-actions should be specific enough that a user knows exactly what to do`,
          },
        ],
        transformationSchema
      ),
      LLM_TIMEOUT_MS,
      'A3 transformation generation timed out'
    );

    return response.content.transformations;
  } catch (err) {
    // FIX-3: Handle LLM timeout gracefully with heuristic fallback
    const errorMessage = err instanceof Error ? err.message : String(err);
    const isTimeout = errorMessage.includes('timed out');

    logger.error(
      `A3: Transformation generation failed - ${errorMessage} (timeout: ${isTimeout}, userWorkflow: ${userWorkflow.title}, peerWorkflow: ${peerWorkflow.title}, steps: ${userWorkflow.steps.length})`,
      err instanceof Error ? err : new Error(errorMessage)
    );

    // FIX-3: Create heuristic-based fallback transformations when LLM fails
    // This ensures users still get some recommendations
    if (userDiagnostics?.inefficiencies?.length > 0 || userWorkflow.steps.length > 0) {
      logger.info('A3: Generating heuristic fallback transformations');
      return createHeuristicTransformations(userWorkflow, peerWorkflow, userDiagnostics, logger);
    }

    return [];
  }
}

/**
 * FIX-3: Create heuristic-based transformations when LLM times out
 * Uses workflow comparison logic without LLM to generate basic recommendations
 */
function createHeuristicTransformations(
  userWorkflow: UserWorkflow,
  peerWorkflow: UserWorkflow,
  userDiagnostics: any,
  logger: Logger
): any[] {
  const transformations: any[] = [];

  // Strategy 1: Use identified inefficiencies from A2
  if (userDiagnostics?.inefficiencies) {
    for (const ineff of userDiagnostics.inefficiencies.slice(0, 3)) {
      const stepIds = ineff.stepIds || [];
      if (stepIds.length === 0) continue;

      const totalDuration = stepIds.reduce((sum: number, id: string) => {
        const step = userWorkflow.steps.find((s) => s.stepId === id);
        return sum + (step?.durationSeconds || 0);
      }, 0);

      // Estimate 30% time savings as a conservative heuristic
      const estimatedSavings = Math.round(totalDuration * 0.3);

      // Generate short title from inefficiency type
      const ineffTypeToTitle: Record<string, string> = {
        'repetitive_search': 'Reduce Repetitive Searches',
        'context_switching': 'Minimize Context Switching',
        'rework_loop': 'Prevent Rework Cycles',
        'manual_automation': 'Automate Manual Tasks',
        'idle_time': 'Utilize Idle Time',
        'tool_fragmentation': 'Consolidate Tools',
        'information_gathering': 'Streamline Research',
        'longcut_path': 'Use Shortcuts',
      };

      transformations.push({
        title: ineffTypeToTitle[ineff.type] || `Optimize ${ineff.type.replace(/_/g, ' ')}`,
        rationale: `Address inefficiency: ${ineff.description}`,
        currentStepIds: stepIds,
        optimizedDescription: `Optimized approach for ${ineff.type}`,
        estimatedDurationSeconds: totalDuration - estimatedSavings,
        tool: 'Workflow optimization',
        timeSavedSeconds: estimatedSavings,
        confidence: 0.5, // Lower confidence for heuristic
      });
    }
  }

  // Strategy 2: Compare tools used - suggest peer tools user doesn't use
  const userTools = new Set(userWorkflow.tools || []);
  const peerTools = peerWorkflow.tools || [];

  for (const peerTool of peerTools) {
    if (!userTools.has(peerTool) && peerWorkflow.steps.some((s) => s.app === peerTool)) {
      const peerStepsWithTool = peerWorkflow.steps.filter((s) => s.app === peerTool);
      const avgDuration = peerStepsWithTool.reduce((sum, s) => sum + s.durationSeconds, 0) / peerStepsWithTool.length;

      // Find similar user steps that might benefit from this tool
      const similarUserSteps = userWorkflow.steps.filter((s) =>
        peerStepsWithTool.some((ps) =>
          s.description?.toLowerCase().includes(ps.description?.toLowerCase().split(' ')[0] || '')
        )
      );

      if (similarUserSteps.length > 0) {
        transformations.push({
          title: `Use ${peerTool} for Efficiency`,
          rationale: `Consider using ${peerTool} (used by efficient peers)`,
          currentStepIds: similarUserSteps.map((s) => s.stepId),
          optimizedDescription: `Use ${peerTool} for this task`,
          estimatedDurationSeconds: Math.round(avgDuration),
          tool: peerTool,
          timeSavedSeconds: Math.round(
            similarUserSteps.reduce((sum, s) => sum + s.durationSeconds, 0) * 0.2
          ),
          confidence: 0.4,
        });
        break; // Only suggest one tool
      }
    }
  }

  // Strategy 3: Statistical workflow analysis (works even without A2 output)
  // This ensures recommendations when A2 completely fails or returns no inefficiencies
  if (transformations.length === 0 && userWorkflow.steps.length > 0) {
    logger.info('A3: Using statistical workflow analysis (no A2 inefficiencies available)');

    // 3a: Find steps with above-average duration (potential optimization targets)
    const avgStepDuration = userWorkflow.steps.reduce((sum, s) => sum + s.durationSeconds, 0) / userWorkflow.steps.length;
    const longSteps = userWorkflow.steps.filter(s => s.durationSeconds > avgStepDuration * 1.5);

    if (longSteps.length > 0) {
      const longestStep = longSteps.sort((a, b) => b.durationSeconds - a.durationSeconds)[0];
      const appName = longestStep.app || 'Time-Intensive';
      const stepDescription = longestStep.description || longestStep.stepSummary || 'completing this task';
      const durationMinutes = Math.round(longestStep.durationSeconds / 60);
      const avgMinutes = Math.round(avgStepDuration / 60);

      // Generate app-specific optimization tips
      const appSpecificTips: Record<string, string> = {
        'Google Chrome': 'Use keyboard shortcuts like Cmd/Ctrl+L (address bar), Cmd/Ctrl+T (new tab), and Cmd/Ctrl+W (close tab) to navigate faster',
        'Terminal': 'Use Ctrl+R for history search, tab completion, and consider shell aliases for common commands',
        'Slack': 'Use Cmd/Ctrl+K for quick switching between channels and DMs',
        'Electron': 'Check if the AI assistant supports keyboard shortcuts for common actions',
        'Finder': 'Use Cmd+Shift+G for Go to Folder, and Cmd+Space for Spotlight search',
        'Notes': 'Use Cmd+N for new note and consider using a dedicated note-taking app with better organization',
      };

      const tip = appSpecificTips[appName] || `Look for keyboard shortcuts and automation opportunities in ${appName}`;

      transformations.push({
        title: `Optimize ${appName} Step`,
        rationale: `In your "${userWorkflow.title}" workflow, "${stepDescription}" took ${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}, significantly above your average of ${avgMinutes} minute${avgMinutes !== 1 ? 's' : ''} per step`,
        currentStepIds: [longestStep.stepId],
        optimizedDescription: tip,
        estimatedDurationSeconds: Math.round(longestStep.durationSeconds * 0.7),
        tool: appName,
        timeSavedSeconds: Math.round(longestStep.durationSeconds * 0.3),
        confidence: 0.35,
      });
    }

    // 3b: Detect context switching (frequent app changes)
    const appSequence = userWorkflow.steps.map(s => s.app);
    let contextSwitches = 0;
    for (let i = 1; i < appSequence.length; i++) {
      if (appSequence[i] !== appSequence[i - 1]) contextSwitches++;
    }

    const uniqueApps = new Set(appSequence).size;
    const switchRatio = contextSwitches / Math.max(1, userWorkflow.steps.length);
    if (switchRatio > 0.5 && uniqueApps > 2) {
      transformations.push({
        title: 'Reduce Context Switching',
        rationale: `You switched between ${uniqueApps} different apps ${contextSwitches} times, which can reduce focus and efficiency`,
        currentStepIds: userWorkflow.steps.slice(0, 5).map(s => s.stepId),
        optimizedDescription: 'Try batching similar tasks together to maintain focus',
        estimatedDurationSeconds: 0,
        tool: 'Workflow organization',
        timeSavedSeconds: Math.round(userWorkflow.steps.reduce((sum, s) => sum + s.durationSeconds, 0) * 0.1),
        confidence: 0.4,
      });
    }

    // 3c: Compare total workflow time with peer (if significant difference)
    const userTotalTime = userWorkflow.steps.reduce((sum, s) => sum + s.durationSeconds, 0);
    const peerTotalTime = peerWorkflow.steps.reduce((sum, s) => sum + s.durationSeconds, 0);

    if (peerTotalTime > 0 && userTotalTime > peerTotalTime * 1.3) {
      transformations.push({
        title: 'Workflow Takes Longer Than Peers',
        rationale: `Your workflow took ${Math.round(userTotalTime / 60)} minutes vs peer average of ${Math.round(peerTotalTime / 60)} minutes`,
        currentStepIds: userWorkflow.steps.map(s => s.stepId),
        optimizedDescription: 'Review peer patterns for efficiency opportunities',
        estimatedDurationSeconds: peerTotalTime,
        tool: 'General optimization',
        timeSavedSeconds: userTotalTime - peerTotalTime,
        confidence: 0.3,
      });
    }
  }

  logger.info('A3: Created heuristic transformations', {
    count: transformations.length,
    sources: transformations.map((t) => t.rationale.slice(0, 50)),
    usedStatisticalFallback: userDiagnostics?.inefficiencies?.length === 0 || !userDiagnostics,
  });

  return transformations;
}

/**
 * Simple text similarity calculation
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  let intersection = 0;
  for (const word of set1) {
    if (set2.has(word)) intersection++;
  }

  const union = set1.size + set2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Generate a short fallback title from tool and rationale when LLM doesn't provide one
 */
function generateFallbackTitle(tool: string, rationale: string): string {
  // Common action verbs to detect in rationale
  const actionPatterns: Array<{ pattern: RegExp; prefix: string }> = [
    { pattern: /automat/i, prefix: 'Automate' },
    { pattern: /consolidat/i, prefix: 'Consolidate' },
    { pattern: /streamlin/i, prefix: 'Streamline' },
    { pattern: /reduc/i, prefix: 'Reduce' },
    { pattern: /optimiz/i, prefix: 'Optimize' },
    { pattern: /eliminat/i, prefix: 'Eliminate' },
    { pattern: /improv/i, prefix: 'Improve' },
    { pattern: /simplif/i, prefix: 'Simplify' },
    { pattern: /integrat/i, prefix: 'Integrate' },
  ];

  // Find matching action verb
  let actionPrefix = 'Optimize';
  for (const { pattern, prefix } of actionPatterns) {
    if (pattern.test(rationale)) {
      actionPrefix = prefix;
      break;
    }
  }

  // Clean and format tool name
  const cleanTool = tool
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 3) // Max 3 words from tool name
    .join(' ');

  // Build title
  const title = cleanTool
    ? `${actionPrefix} with ${cleanTool}`
    : `${actionPrefix} Workflow`;

  // Ensure max 50 chars
  return title.length > 50 ? title.slice(0, 47) + '...' : title;
}
