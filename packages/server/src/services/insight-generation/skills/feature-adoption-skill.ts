/**
 * Feature Adoption Skill (wraps A5 Feature Adoption Agent)
 *
 * This skill analyzes the user's tool usage patterns to identify features
 * they might not be using in tools they already have.
 */

import { createFeatureAdoptionGraph, type FeatureAdoptionGraphDeps } from '../graphs/feature-adoption-graph.js';
import { createAgentLLMProvider } from '../utils/model-provider-factory.js';
import { buildUserToolbox } from '../utils/toolbox-utils.js';
import type { Skill, SkillDependencies } from './skill-types.js';
import type { SkillInput, SkillExecutionResult } from '../types.js';
import type { InsightState } from '../state/insight-state.js';

// ============================================================================
// SKILL DEFINITION
// ============================================================================

export const featureAdoptionSkill: Skill = {
  // =========================================================================
  // DESCRIPTION (for LLM reasoning)
  // =========================================================================

  id: 'discover_underused_features',

  name: 'Discover Underused Features',

  description: `This skill analyzes the user's tool usage patterns to identify features they might not be using in tools they already have. It provides personalized tips without suggesting new tools.

The skill has knowledge of features for popular tools like Cursor, Claude, VSCode, Figma, Notion, etc. It matches behavior patterns to feature gaps and generates friendly, non-intrusive tip messages with shortcuts and trigger commands.

This skill focuses on helping users get more value from their existing tools rather than recommending new ones.`,

  whenToUse: [
    'User has established tool usage patterns (userToolbox available)',
    'Looking for ways to be more efficient with current tools',
    'User mentions struggling with a specific tool',
    'After identifying inefficiencies that tools could solve',
    'Proactively suggest improvements for power users',
    'User asks "am I using X correctly?"',
    'User asks about tool features or shortcuts',
    'User asks "what features am I missing?"',
  ],

  capabilities: [
    'Analyzes user\'s historical tool usage (userToolbox)',
    'Matches behavior patterns to feature gaps',
    'Has knowledge of features for: Cursor, Claude, VSCode, Figma, Notion, Slack, etc.',
    'Generates non-intrusive, friendly tip messages',
    'Provides shortcuts and trigger commands',
    'Estimates time savings per feature adoption',
    'Links tips to specific workflows that would benefit',
  ],

  produces: ['featureAdoptionTips'],

  requires: ['userEvidence'], // Needs user evidence to derive toolbox

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

    logger.info('Feature Adoption Skill: Starting execution', {
      hasUserEvidence: !!state.userEvidence,
      hasUserDiagnostics: !!state.userDiagnostics,
      userId: state.userId,
    });

    // Check prerequisites
    if (!state.userEvidence) {
      return {
        success: false,
        observation: 'Cannot discover underused features: No user evidence available. Run retrieve_user_workflows first.',
        stateUpdates: {},
        error: 'Missing prerequisite: userEvidence',
        executionTimeMs: Date.now() - startTime,
      };
    }

    try {
      // Extract all tools from user workflows
      const allTools = state.userEvidence.workflows.flatMap(w => w.tools);

      // Build user toolbox from extracted tools
      const userToolbox = buildUserToolbox(allTools);

      if (userToolbox.tools.length === 0) {
        return {
          success: true,
          observation: 'No tools detected in user workflows. Cannot suggest features without knowing what tools the user uses.',
          stateUpdates: {
            featureAdoptionTips: [],
          },
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Get agent-specific LLM provider
      let llmProvider;
      try {
        llmProvider = createAgentLLMProvider('A5_FEATURE_ADOPTION', modelConfig);
      } catch {
        logger.warn('Feature Adoption Skill: Failed to create A5-specific provider, using default');
        llmProvider = deps.llmProvider;
      }

      // Prepare graph dependencies
      const graphDeps: FeatureAdoptionGraphDeps = {
        logger,
        llmProvider,
      };

      // Create and invoke the A5 feature adoption graph
      const graph = createFeatureAdoptionGraph(graphDeps);

      // Add userToolbox to state for the graph
      const stateWithToolbox = {
        ...state,
        userToolbox,
      };

      const result = await graph.invoke(stateWithToolbox);

      const executionTimeMs = Date.now() - startTime;

      // Build observation
      const tipCount = result.featureAdoptionTips?.length ?? 0;
      const toolsAnalyzed = userToolbox.tools.length;

      let observation = `Analyzed ${toolsAnalyzed} tools and generated ${tipCount} feature adoption tips.`;

      if (tipCount > 0 && result.featureAdoptionTips) {
        const topTools = [...new Set(result.featureAdoptionTips.slice(0, 3).map(t => t.toolName))];
        observation += ` Tips for: ${topTools.join(', ')}.`;
      }

      if (tipCount === 0) {
        observation = `Analyzed ${toolsAnalyzed} tools but no underused features detected. User appears to be using their tools effectively.`;
      }

      logger.info('Feature Adoption Skill: Execution complete', {
        tipCount,
        toolsAnalyzed,
        executionTimeMs,
      });

      return {
        success: true, // Success even with 0 tips (means user is using tools well)
        observation,
        stateUpdates: {
          featureAdoptionTips: result.featureAdoptionTips ?? [],
          userToolbox,
        },
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Feature Adoption Skill: Execution failed', error instanceof Error ? error : new Error(errorMessage));

      return {
        success: false,
        observation: `Failed to discover underused features: ${errorMessage}`,
        stateUpdates: {},
        error: errorMessage,
        executionTimeMs,
      };
    }
  },

  // =========================================================================
  // METADATA
  // =========================================================================

  wrapsAgent: 'A5_FEATURE_ADOPTION',
  canRunInParallel: true, // Can run in parallel with A3, A4 skills
  estimatedExecutionMs: 5000,
};
