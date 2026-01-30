/**
 * Web Search Skill (wraps A4-Web Best Practices Agent)
 *
 * This skill searches the web for industry best practices, expert recommendations,
 * and established workflows using the Perplexity API.
 */

import { createWebBestPracticesGraph, type WebBestPracticesGraphDeps } from '../graphs/web-best-practices-graph.js';
import { createAgentLLMProvider } from '../utils/model-provider-factory.js';
import type { Skill, SkillDependencies } from './skill-types.js';
import type { SkillInput, SkillExecutionResult } from '../types.js';
import type { InsightState } from '../state/insight-state.js';

// ============================================================================
// SKILL DEFINITION
// ============================================================================

export const webSearchSkill: Skill = {
  // =========================================================================
  // DESCRIPTION (for LLM reasoning)
  // =========================================================================

  id: 'search_web_best_practices',

  name: 'Search Web Best Practices',

  description: `This skill searches the web for industry best practices, expert recommendations, and established workflows using the Perplexity API. It finds external knowledge to supplement internal analysis.

The skill generates targeted search queries from identified inefficiencies, extracts actionable recommendations with source citations, and maps best practices to the user's specific workflow steps.

This is typically used as a fallback when internal analysis (A2) produces insufficient results, or when the user explicitly asks for industry best practices.`,

  whenToUse: [
    'User explicitly asks for industry best practices',
    'Internal analysis (A2) produced insufficient results (< 3 findings)',
    'Looking for tool-specific tips not covered by peer data',
    'Need external validation for recommendations',
    'User mentions unfamiliar tools or techniques',
    'User asks "what do experts recommend?"',
    'Need up-to-date information about tools or workflows',
  ],

  capabilities: [
    'Generates targeted search queries from identified inefficiencies',
    'Searches via Perplexity API for relevant articles/documentation',
    'Extracts actionable recommendations with source citations',
    'Maps external best practices to user-specific workflow steps',
    'Generates Claude Code prompts for applicable suggestions',
    'Filters for relevance and quality',
    'Provides URLs for further reading',
  ],

  produces: ['webOptimizationPlan'],

  requires: ['userDiagnostics'], // Needs diagnostics to generate relevant searches

  // =========================================================================
  // EXECUTION (callable function)
  // =========================================================================

  async execute(
    input: SkillInput,
    state: InsightState,
    deps: SkillDependencies
  ): Promise<SkillExecutionResult> {
    const { logger, modelConfig, perplexityApiKey } = deps;
    const startTime = Date.now();

    logger.info('Web Search Skill: Starting execution', {
      hasUserDiagnostics: !!state.userDiagnostics,
      hasPerplexityApiKey: !!perplexityApiKey,
      userId: state.userId,
    });

    // Check prerequisites
    if (!perplexityApiKey) {
      return {
        success: false,
        observation: 'Cannot search web: Perplexity API key not configured.',
        stateUpdates: {},
        error: 'Missing configuration: perplexityApiKey',
        executionTimeMs: Date.now() - startTime,
      };
    }

    if (!state.userDiagnostics) {
      return {
        success: false,
        observation: 'Cannot search web best practices: No diagnostics available. Run analyze_workflow_efficiency first to identify what to search for.',
        stateUpdates: {},
        error: 'Missing prerequisite: userDiagnostics',
        executionTimeMs: Date.now() - startTime,
      };
    }

    try {
      // Get agent-specific LLM provider
      let llmProvider;
      try {
        llmProvider = createAgentLLMProvider('A4_WEB', modelConfig);
      } catch {
        logger.warn('Web Search Skill: Failed to create A4-Web-specific provider, using default');
        llmProvider = deps.llmProvider;
      }

      // Prepare graph dependencies
      const graphDeps: WebBestPracticesGraphDeps = {
        logger,
        llmProvider,
        perplexityApiKey,
      };

      // Create and invoke the A4-Web graph
      const graph = createWebBestPracticesGraph(graphDeps);
      const result = await graph.invoke(state);

      const executionTimeMs = Date.now() - startTime;

      // Build observation
      const blockCount = result.webOptimizationPlan?.blocks?.length ?? 0;
      const citationCount = result.webOptimizationPlan?.blocks?.reduce(
        (sum, b) => sum + (b.citations?.length ?? 0),
        0
      ) ?? 0;

      let observation = `Found ${blockCount} optimization recommendations from web research.`;
      if (citationCount > 0) {
        observation += ` Includes ${citationCount} source citations.`;
      }

      if (blockCount === 0) {
        observation = 'Web search complete but no actionable recommendations found. The search may not have returned relevant results for the identified inefficiencies.';
      }

      logger.info('Web Search Skill: Execution complete', {
        blockCount,
        citationCount,
        executionTimeMs,
      });

      return {
        success: blockCount > 0,
        observation,
        stateUpdates: {
          webOptimizationPlan: result.webOptimizationPlan,
        },
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Web Search Skill: Execution failed', error instanceof Error ? error : new Error(errorMessage));

      return {
        success: false,
        observation: `Failed to search web best practices: ${errorMessage}`,
        stateUpdates: {},
        error: errorMessage,
        executionTimeMs,
      };
    }
  },

  // =========================================================================
  // METADATA
  // =========================================================================

  wrapsAgent: 'A4_WEB',
  canRunInParallel: true, // Can run in parallel with A3, A4-Company, A5
  estimatedExecutionMs: 10000, // Web search can be slow
};
