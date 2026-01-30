/**
 * Comparator Skill (wraps A3 Comparator Agent)
 *
 * This skill compares the user's workflow patterns with anonymized peer data
 * to identify where peers achieve better efficiency.
 */

import { createComparatorGraph, type ComparatorGraphDeps } from '../graphs/comparator-graph.js';
import { createAgentLLMProvider } from '../utils/model-provider-factory.js';
import type { Skill, SkillDependencies } from './skill-types.js';
import type { SkillInput, SkillExecutionResult } from '../types.js';
import type { InsightState } from '../state/insight-state.js';

// ============================================================================
// SKILL DEFINITION
// ============================================================================

export const comparatorSkill: Skill = {
  // =========================================================================
  // DESCRIPTION (for LLM reasoning)
  // =========================================================================

  id: 'compare_with_peers',

  name: 'Compare with Peer Workflows',

  description: `This skill compares the user's workflow patterns with anonymized peer data from similar roles/tasks. It identifies where peers achieve better efficiency and generates step-by-step transformation plans.

The skill aligns user workflows with peer patterns by intent/approach, identifies step-level differences, and creates transformation plans with specific steps to adopt peer-level efficiency. It also generates Claude Code prompts for automatable steps.

This skill requires both user evidence/diagnostics and peer evidence to be present. It should only run when peer efficiency is higher than user efficiency to ensure meaningful recommendations.`,

  whenToUse: [
    'User asks how others do similar tasks',
    'User wants to learn from best practices of peers',
    'Peer efficiency score is higher than user efficiency',
    'Looking for alternative approaches to tasks',
    'After diagnostics show improvement potential',
    'User asks "how do other engineers handle this?"',
    'Need to generate transformation plans',
  ],

  capabilities: [
    'Aligns user workflows with peer patterns by intent/approach',
    'Identifies step-level differences between user and peer approaches',
    'Calculates efficiency gaps (time, context switches, tool usage)',
    'Generates transformation plans with specific steps',
    'Creates Claude Code prompts for automatable steps',
    'Explains why peer approaches are more efficient',
    'Provides confidence scores for recommendations',
  ],

  produces: ['peerOptimizationPlan'],

  requires: ['userEvidence', 'peerEvidence', 'userDiagnostics'],

  // =========================================================================
  // EXECUTION (callable function)
  // =========================================================================

  async execute(
    input: SkillInput,
    state: InsightState,
    deps: SkillDependencies
  ): Promise<SkillExecutionResult> {
    const { logger, modelConfig } = deps;
    const startTime = Date.now();

    logger.info('Comparator Skill: Starting execution', {
      hasUserEvidence: !!state.userEvidence,
      hasPeerEvidence: !!state.peerEvidence,
      hasUserDiagnostics: !!state.userDiagnostics,
      userId: state.userId,
    });

    // Check prerequisites
    if (!state.userEvidence || !state.peerEvidence) {
      return {
        success: false,
        observation: 'Cannot compare with peers: Missing user or peer evidence. Run retrieve_user_workflows first.',
        stateUpdates: {},
        error: 'Missing prerequisite: userEvidence or peerEvidence',
        executionTimeMs: Date.now() - startTime,
      };
    }

    if (!state.userDiagnostics) {
      return {
        success: false,
        observation: 'Cannot compare with peers: Missing diagnostics. Run analyze_workflow_efficiency first.',
        stateUpdates: {},
        error: 'Missing prerequisite: userDiagnostics',
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Check if comparison is worthwhile
    const userEfficiency = state.userDiagnostics.overallEfficiencyScore ?? 0;
    const peerEfficiency = state.peerDiagnostics?.overallEfficiencyScore ?? 0;

    if (peerEfficiency <= userEfficiency) {
      return {
        success: true,
        observation: `Peer comparison skipped: User efficiency (${userEfficiency}) is already at or above peer level (${peerEfficiency}). No optimization needed from peer comparison.`,
        stateUpdates: {},
        executionTimeMs: Date.now() - startTime,
      };
    }

    try {
      // Get agent-specific LLM provider
      let llmProvider;
      try {
        llmProvider = createAgentLLMProvider('A3_COMPARATOR', modelConfig);
      } catch {
        logger.warn('Comparator Skill: Failed to create A3-specific provider, using default');
        llmProvider = deps.llmProvider;
      }

      // Prepare graph dependencies
      const graphDeps: ComparatorGraphDeps = {
        logger,
        llmProvider,
      };

      // Create and invoke the A3 comparator graph
      const graph = createComparatorGraph(graphDeps);
      const result = await graph.invoke(state);

      const executionTimeMs = Date.now() - startTime;

      // Build observation
      const blockCount = result.peerOptimizationPlan?.blocks?.length ?? 0;
      const totalTimeSaved = result.peerOptimizationPlan?.totalTimeSaved ?? 0;

      let observation = `Generated ${blockCount} optimization blocks from peer comparison.`;
      if (totalTimeSaved > 0) {
        const minutesSaved = Math.round(totalTimeSaved / 60);
        observation += ` Potential time savings: ${minutesSaved} minutes.`;
      }
      observation += ` Efficiency gap: ${peerEfficiency - userEfficiency} points.`;

      if (blockCount === 0) {
        observation = 'Peer comparison complete but no actionable optimization blocks generated. Peer patterns may be similar to user patterns.';
      }

      logger.info('Comparator Skill: Execution complete', {
        blockCount,
        totalTimeSaved,
        executionTimeMs,
      });

      return {
        success: blockCount > 0,
        observation,
        stateUpdates: {
          peerOptimizationPlan: result.peerOptimizationPlan,
        },
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Comparator Skill: Execution failed', error instanceof Error ? error : new Error(errorMessage));

      return {
        success: false,
        observation: `Failed to compare with peers: ${errorMessage}`,
        stateUpdates: {},
        error: errorMessage,
        executionTimeMs,
      };
    }
  },

  // =========================================================================
  // METADATA
  // =========================================================================

  wrapsAgent: 'A3_COMPARATOR',
  canRunInParallel: true, // Can run in parallel with A4 skills
  estimatedExecutionMs: 8000,
};
