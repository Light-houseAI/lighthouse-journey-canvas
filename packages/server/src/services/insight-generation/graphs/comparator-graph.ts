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
import { InsightStateAnnotation, type InsightState } from '../state/insight-state.js';
import type {
  StepOptimizationPlan,
  OptimizationBlock,
  StepTransformation,
  CurrentStep,
  OptimizedStep,
  UserWorkflow,
  UserStep,
} from '../types.js';
import { z } from 'zod';

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

const transformationSchema = z.object({
  transformations: z.array(
    z.object({
      rationale: z.string(),
      currentStepIds: z.array(z.string()),
      optimizedDescription: z.string(),
      estimatedDurationSeconds: z.number(),
      tool: z.string(),
      claudeCodePrompt: z.string().optional(),
      timeSavedSeconds: z.number(),
      confidence: z.number().min(0).max(1),
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

  const alignments: WorkflowAlignment[] = [];

  // For each user workflow, find best matching peer workflow
  for (const userWorkflow of state.userEvidence.workflows) {
    let bestMatch: WorkflowAlignment | null = null;
    let bestScore = 0;

    for (const peerWorkflow of state.peerEvidence.workflows) {
      const alignment = await alignTwoWorkflows(
        userWorkflow,
        peerWorkflow,
        llmProvider,
        logger
      );

      if (alignment.alignmentScore > bestScore) {
        bestScore = alignment.alignmentScore;
        bestMatch = alignment;
      }
    }

    if (bestMatch && bestMatch.alignmentScore > 0.5) {
      alignments.push(bestMatch);
    }
  }

  logger.info('A3: Workflow alignment complete', {
    userWorkflows: state.userEvidence.workflows.length,
    peerWorkflows: state.peerEvidence.workflows.length,
    alignedPairs: alignments.length,
  });

  // Log detailed output for debugging
  logger.info('=== A3 COMPARATOR AGENT OUTPUT (Alignment) ===');
  logger.info(JSON.stringify({
    agent: 'A3_COMPARATOR',
    outputType: 'workflowAlignment',
    alignment: {
      userWorkflowCount: state.userEvidence.workflows.length,
      peerWorkflowCount: state.peerEvidence.workflows.length,
      alignedPairs: alignments.length,
      alignments: alignments.map(a => ({
        userWorkflow: a.userWorkflow.name || a.userWorkflow.title,
        peerWorkflow: a.peerWorkflow.name || a.peerWorkflow.title,
        alignmentScore: a.alignmentScore,
        alignedByIntent: a.alignedByIntent,
      })),
    },
  }, null, 2));
  logger.info('=== END A3 ALIGNMENT OUTPUT ===');

  // Store alignments in state (using a custom field in errors for now - will be proper state in production)
  return {
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

  logger.info('A3: Comparing steps between workflows');

  if (!state.userEvidence || !state.peerEvidence) {
    return {
      currentStage: 'a3_comparison_skipped',
      progress: 72,
    };
  }

  // Compare primary workflows (first of each)
  const userWorkflow = state.userEvidence.workflows[0];
  const peerWorkflow = state.peerEvidence.workflows[0];

  if (!userWorkflow || !peerWorkflow) {
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
    });

    // Log detailed output for debugging
    logger.info('=== A3 COMPARATOR AGENT OUTPUT (Step Comparison) ===');
    logger.info(JSON.stringify({
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
    }, null, 2));
    logger.info('=== END A3 STEP COMPARISON OUTPUT ===');

    return {
      currentStage: 'a3_comparison_complete',
      progress: 72,
    };
  } catch (error) {
    logger.error('A3: Step comparison failed', { error });
    return {
      errors: [`A3 step comparison failed: ${error}`],
      currentStage: 'a3_comparison_failed',
    };
  }
}

/**
 * Node: Generate step transformations
 */
async function generateTransformations(
  state: InsightState,
  deps: ComparatorGraphDeps
): Promise<Partial<InsightState>> {
  const { logger, llmProvider } = deps;

  logger.info('A3: Generating step transformations');

  if (!state.userEvidence || !state.peerEvidence || !state.userDiagnostics) {
    return {
      peerOptimizationPlan: null,
      currentStage: 'a3_transformations_skipped',
      progress: 75,
    };
  }

  const userWorkflow = state.userEvidence.workflows[0];
  const peerWorkflow = state.peerEvidence.workflows[0];

  if (!userWorkflow || !peerWorkflow) {
    return {
      peerOptimizationPlan: null,
      currentStage: 'a3_transformations_no_workflows',
      progress: 75,
    };
  }

  try {
    const optimizationPlan = await createOptimizationPlan(
      userWorkflow,
      peerWorkflow,
      state.userDiagnostics,
      state.peerDiagnostics,
      llmProvider,
      logger
    );

    logger.info('A3: Transformations generated', {
      blockCount: optimizationPlan.blocks.length,
      totalTimeSaved: optimizationPlan.totalTimeSaved,
    });

    // Log detailed output for debugging
    logger.info('=== A3 COMPARATOR AGENT OUTPUT (Optimization Plan) ===');
    logger.info(JSON.stringify({
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
    }, null, 2));
    logger.info('=== END A3 OPTIMIZATION PLAN OUTPUT ===');

    return {
      peerOptimizationPlan: optimizationPlan,
      currentStage: 'a3_transformations_complete',
      progress: 75,
    };
  } catch (error) {
    logger.error('A3: Transformation generation failed', { error });
    return {
      errors: [`A3 transformation generation failed: ${error}`],
      peerOptimizationPlan: null,
      currentStage: 'a3_transformations_failed',
    };
  }
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
    const response = await llmProvider.generateStructuredResponse(
      [
        {
          role: 'user',
          content: `Compare these two workflows to determine if they have similar intents and can be meaningfully compared:

User Workflow:
- Name: ${userWorkflow.name || userWorkflow.title}
- Intent: ${userWorkflow.intent}
- Approach: ${userWorkflow.approach}
- Steps: ${userWorkflow.steps.length}
- Tools: ${userWorkflow.tools.join(', ')}

Peer Workflow:
- Name: ${peerWorkflow.name || peerWorkflow.title}
- Intent: ${peerWorkflow.intent}
- Approach: ${peerWorkflow.approach}
- Steps: ${peerWorkflow.steps.length}
- Tools: ${peerWorkflow.tools.join(', ')}

Rate the alignment (0-1) and explain if they can be compared.`,
        },
      ],
      workflowAlignmentSchema
    );

    return {
      userWorkflow,
      peerWorkflow,
      alignmentScore: response.content.alignmentScore,
      alignedByIntent: response.content.alignedByIntent,
      stepMappings: [], // Will be filled in comparison step
    };
  } catch (error) {
    logger.warn('Workflow alignment LLM call failed', { error });
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
        `[${s.stepId}] ${i + 1}. ${s.app || s.tool}: ${s.description} (${s.durationSeconds}s)`
    )
    .join('\n');

  const peerStepsSummary = peerWorkflow.steps
    .map(
      (s, i) =>
        `[${s.stepId}] ${i + 1}. ${s.app || s.tool}: ${s.description} (${s.durationSeconds}s)`
    )
    .join('\n');

  try {
    const response = await llmProvider.generateStructuredResponse(
      [
        {
          role: 'user',
          content: `Compare steps between these two workflows to identify efficiency gaps:

User Workflow: ${userWorkflow.name || userWorkflow.title}
${userStepsSummary}

Peer Workflow (more efficient pattern): ${peerWorkflow.name || peerWorkflow.title}
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
    );

    return response.content.comparisons;
  } catch (error) {
    logger.error('Step comparison LLM call failed', { error });
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
  logger: Logger
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

  for (const trans of transformations) {
    const currentTime = trans.currentStepIds.reduce((sum, id) => {
      const step = userWorkflow.steps.find((s) => s.stepId === id);
      return sum + (step?.durationSeconds || 0);
    }, 0);

    const optimizedTime = trans.estimatedDurationSeconds;
    const timeSaved = currentTime - optimizedTime;

    if (timeSaved > 0) {
      totalTimeSaved += timeSaved;

      const stepTransformation: StepTransformation = {
        transformationId: uuidv4(),
        currentSteps: trans.currentStepIds.map((id) => {
          const step = userWorkflow.steps.find((s) => s.stepId === id);
          return {
            stepId: id,
            tool: step?.app || step?.tool || 'unknown',
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
            replacesSteps: trans.currentStepIds,
          } as OptimizedStep,
        ],
        timeSavedSeconds: timeSaved,
        confidence: trans.confidence,
        rationale: trans.rationale,
      };

      blocks.push({
        blockId: uuidv4(),
        workflowName: userWorkflow.name || userWorkflow.title || 'Workflow',
        workflowId: userWorkflow.workflowId,
        currentTimeTotal: currentTime,
        optimizedTimeTotal: optimizedTime,
        timeSaved,
        relativeImprovement: currentTime > 0 ? (timeSaved / currentTime) * 100 : 0,
        confidence: trans.confidence,
        whyThisMatters: trans.rationale,
        metricDeltas: {},
        stepTransformations: [stepTransformation],
        source: 'peer_comparison',
      });
    }
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
        `[${s.stepId}] ${s.app || s.tool}: ${s.description} (${s.durationSeconds}s)`
    )
    .join('\n');

  const inefficiencies =
    userDiagnostics?.inefficiencies
      ?.map((i: any) => `- ${i.type}: ${i.description} (steps: ${i.stepIds.join(', ')})`)
      .join('\n') || 'None identified';

  const peerApproach = peerWorkflow.steps
    .map((s, i) => `${i + 1}. ${s.app || s.tool}: ${s.description} (${s.durationSeconds}s)`)
    .join('\n');

  try {
    const response = await llmProvider.generateStructuredResponse(
      [
        {
          role: 'user',
          content: `Generate step-level transformations to help the user achieve peer-level efficiency.

User's Current Workflow:
${userStepsSummary}

Identified Inefficiencies:
${inefficiencies}

Peer's More Efficient Approach:
${peerApproach}

For each transformation:
1. Identify which user steps can be optimized (by stepId)
2. Describe the optimized approach
3. Estimate time for optimized approach
4. Suggest tool (especially Claude Code where applicable)
5. Provide Claude Code prompt if applicable
6. Calculate time saved
7. Rate confidence (0-1)

Focus on high-impact transformations that address identified inefficiencies.`,
        },
      ],
      transformationSchema
    );

    return response.content.transformations;
  } catch (error) {
    logger.error('Transformation generation LLM call failed', { error });
    return [];
  }
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
