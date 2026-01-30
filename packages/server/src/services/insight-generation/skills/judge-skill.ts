/**
 * Judge Skill (wraps A2 Judge Agent)
 *
 * This skill acts as an LLM-as-judge analyst that examines user workflow evidence
 * to identify inefficiencies, wasted time, and optimization opportunities.
 */

import { createJudgeGraph, type JudgeGraphDeps } from '../graphs/judge-graph.js';
import { createAgentLLMProvider } from '../utils/model-provider-factory.js';
import type { Skill, SkillDependencies } from './skill-types.js';
import type { SkillInput, SkillExecutionResult } from '../types.js';
import type { InsightState } from '../state/insight-state.js';

// ============================================================================
// SKILL DEFINITION
// ============================================================================

export const judgeSkill: Skill = {
  // =========================================================================
  // DESCRIPTION (for LLM reasoning)
  // =========================================================================

  id: 'analyze_workflow_efficiency',

  name: 'Analyze Workflow Efficiency',

  description: `This skill acts as an LLM-as-judge analyst that examines user workflow evidence to identify inefficiencies, wasted time, and optimization opportunities. It produces detailed diagnostics with specific step-level citations.

The skill calculates workflow metrics (active time, idle time, context switches), identifies specific types of inefficiencies, and maps them to improvement opportunities. All claims must cite specific step IDs and durations, validated through a critique loop.

This skill requires user evidence (from retrieve_user_workflows) to be present in the state. It should be invoked after gathering user workflow data.`,

  whenToUse: [
    'After retrieving user workflows (needs userEvidence)',
    'User asks about inefficiencies or time wasters',
    'User wants to know how to improve their workflow',
    'Preparing for optimization recommendations',
    'Need quantified metrics about workflow performance',
    'User asks "where am I wasting time?"',
    'User asks about their productivity or efficiency',
  ],

  capabilities: [
    'Calculates workflow metrics (active time, idle time, context switches, rework loops)',
    'Identifies inefficiency types: repetitive_search, context_switching, rework_loop, manual_automation, idle_time, tool_fragmentation, longcut_path, repetitive_workflow',
    'Maps inefficiencies to improvement opportunities (automation, consolidation, tool_switch, workflow_reorder, elimination)',
    'Runs critique loop to validate all claims cite specific step IDs',
    'Estimates time savings potential for each opportunity',
    'Calculates overall efficiency score (0-100)',
    'Analyzes peer evidence if available for comparison diagnostics',
    'Detects cross-session repetitive patterns',
  ],

  produces: ['userDiagnostics', 'peerDiagnostics', 'a2CritiqueResult'],

  requires: ['userEvidence'], // Must have user evidence from retrieval skill

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

    logger.info('Judge Skill: Starting execution', {
      hasUserEvidence: !!state.userEvidence,
      hasPeerEvidence: !!state.peerEvidence,
      userId: state.userId,
    });

    // Check prerequisites
    if (!state.userEvidence) {
      return {
        success: false,
        observation: 'Cannot analyze workflow efficiency: No user evidence available. Run retrieve_user_workflows first.',
        stateUpdates: {},
        error: 'Missing prerequisite: userEvidence',
        executionTimeMs: Date.now() - startTime,
      };
    }

    try {
      // Get agent-specific LLM provider (GPT-4o by default for judge)
      let llmProvider;
      try {
        llmProvider = createAgentLLMProvider('A2_JUDGE', modelConfig);
      } catch {
        logger.warn('Judge Skill: Failed to create A2-specific provider, using default');
        llmProvider = deps.llmProvider;
      }

      // Prepare graph dependencies
      const graphDeps: JudgeGraphDeps = {
        logger,
        llmProvider,
      };

      // Create and invoke the A2 judge graph
      const graph = createJudgeGraph(graphDeps);
      const result = await graph.invoke(state);

      const executionTimeMs = Date.now() - startTime;

      // Build observation for the reasoning node
      const inefficiencyCount = result.userDiagnostics?.inefficiencies?.length ?? 0;
      const opportunityCount = result.userDiagnostics?.opportunities?.length ?? 0;
      const efficiencyScore = result.userDiagnostics?.overallEfficiencyScore ?? 0;

      let observation = `Analyzed workflows and identified ${inefficiencyCount} inefficiencies and ${opportunityCount} optimization opportunities.`;
      observation += ` Overall efficiency score: ${efficiencyScore}/100.`;

      if (inefficiencyCount > 0 && result.userDiagnostics?.inefficiencies) {
        const topInefficiencies = result.userDiagnostics.inefficiencies
          .slice(0, 3)
          .map((i) => i.type)
          .join(', ');
        observation += ` Top inefficiency types: ${topInefficiencies}.`;
      }

      if (result.peerDiagnostics) {
        const peerEfficiency = result.peerDiagnostics.overallEfficiencyScore ?? 0;
        observation += ` Peer efficiency for comparison: ${peerEfficiency}/100.`;
      }

      if (inefficiencyCount === 0) {
        observation = 'Analysis complete. No significant inefficiencies detected in the retrieved workflows. The user appears to have efficient workflow patterns.';
      }

      logger.info('Judge Skill: Execution complete', {
        inefficiencyCount,
        opportunityCount,
        efficiencyScore,
        executionTimeMs,
      });

      return {
        success: true,
        observation,
        stateUpdates: {
          userDiagnostics: result.userDiagnostics,
          peerDiagnostics: result.peerDiagnostics,
          a2CritiqueResult: result.a2CritiqueResult,
        },
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Judge Skill: Execution failed', error instanceof Error ? error : new Error(errorMessage));

      return {
        success: false,
        observation: `Failed to analyze workflow efficiency: ${errorMessage}`,
        stateUpdates: {},
        error: errorMessage,
        executionTimeMs,
      };
    }
  },

  // =========================================================================
  // METADATA
  // =========================================================================

  wrapsAgent: 'A2_JUDGE',
  canRunInParallel: false, // Depends on userEvidence, produces diagnostics for others
  estimatedExecutionMs: 15000, // Judge uses GPT-4o which is slower
};
