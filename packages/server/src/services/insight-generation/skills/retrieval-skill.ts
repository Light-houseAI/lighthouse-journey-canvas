/**
 * Retrieval Skill (wraps A1 Retrieval Agent)
 *
 * This skill retrieves the user's captured workflow data from their recorded
 * work sessions using hybrid RAG (Retrieval-Augmented Generation).
 */

import { createRetrievalGraph, type RetrievalGraphDeps } from '../graphs/retrieval-graph.js';
import { createAgentLLMProvider } from '../utils/model-provider-factory.js';
import type { Skill, SkillDependencies } from './skill-types.js';
import type { SkillInput, SkillExecutionResult } from '../types.js';
import type { InsightState } from '../state/insight-state.js';

// ============================================================================
// SKILL DEFINITION
// ============================================================================

export const retrievalSkill: Skill = {
  // =========================================================================
  // DESCRIPTION (for LLM reasoning)
  // =========================================================================

  id: 'retrieve_user_workflows',

  name: 'Retrieve User Workflows',

  description: `This skill retrieves the user's captured workflow data from their recorded work sessions. It uses a hybrid RAG (Retrieval-Augmented Generation) approach combining semantic vector search with graph-based retrieval from ArangoDB.

The skill searches across all user sessions using natural language, extracts workflows, steps, tools used, and duration metrics. It also identifies entities (technologies, tools, people) mentioned in the workflows and can retrieve anonymized peer patterns for comparison.

This is typically the FIRST skill to invoke when you need to understand what the user has been working on before performing any analysis or providing recommendations.`,

  whenToUse: [
    'User asks about their past work (e.g., "What did I work on yesterday?")',
    'Need to understand user workflow patterns before analysis',
    'Looking for specific sessions or activities',
    'User references a task, project, or timeframe',
    'Starting any analysis that requires user context',
    'User asks about their tools, apps, or technologies used',
    'Need to gather evidence for efficiency analysis',
  ],

  capabilities: [
    'Searches across all user sessions using natural language queries',
    'Filters by time range (lookbackDays parameter)',
    'Extracts workflows with intent, approach, and steps',
    'Identifies duration metrics for each step and workflow',
    'Extracts entities (technologies, tools, people, organizations)',
    'Identifies concepts and topics from workflow content',
    'Can filter out noise (Slack, communication apps) if requested',
    'Retrieves anonymized peer patterns for comparison (if available)',
    'Supports attached sessions via @mention (bypasses NLQ retrieval)',
  ],

  produces: ['userEvidence', 'peerEvidence', 'a1CritiqueResult'],

  requires: [], // No prerequisites - this is typically the first skill

  // =========================================================================
  // EXECUTION (callable function)
  // =========================================================================

  async execute(
    input: SkillInput,
    state: InsightState,
    deps: SkillDependencies
  ): Promise<SkillExecutionResult> {
    const { logger, nlqService, platformWorkflowRepository, sessionMappingRepository, embeddingService, noiseFilterService, graphService, modelConfig, enableContextStitching } = deps;
    const startTime = Date.now();

    logger.info('Retrieval Skill: Starting execution', {
      query: input.query || state.query,
      lookbackDays: input.lookbackDays || state.lookbackDays,
      userId: state.userId,
    });

    try {
      // Get agent-specific LLM provider (Gemini 2.5 Flash by default)
      let llmProvider;
      try {
        llmProvider = createAgentLLMProvider('A1_RETRIEVAL', modelConfig);
      } catch {
        logger.warn('Retrieval Skill: Failed to create A1-specific provider, using default');
        llmProvider = deps.llmProvider;
      }

      // Prepare graph dependencies
      const graphDeps: RetrievalGraphDeps = {
        logger,
        nlqService,
        platformWorkflowRepository,
        sessionMappingRepository,
        embeddingService,
        llmProvider,
        noiseFilterService,
        graphService,
        enableContextStitching,
      };

      // Create and invoke the A1 retrieval graph
      const graph = createRetrievalGraph(graphDeps);

      // Prepare input state for the graph
      const graphInput: Partial<InsightState> = {
        ...state,
        query: input.query || state.query,
        lookbackDays: input.lookbackDays || state.lookbackDays || 30,
      };

      const result = await graph.invoke(graphInput);

      const executionTimeMs = Date.now() - startTime;

      // Build observation for the reasoning node
      const workflowCount = result.userEvidence?.workflows?.length ?? 0;
      const stepCount = result.userEvidence?.totalStepCount ?? 0;
      const sessionCount = result.userEvidence?.sessions?.length ?? 0;
      const peerWorkflowCount = result.peerEvidence?.workflows?.length ?? 0;
      const entityCount = result.userEvidence?.entities?.length ?? 0;

      let observation = `Retrieved ${workflowCount} workflows with ${stepCount} steps from ${sessionCount} sessions.`;

      if (entityCount > 0) {
        observation += ` Identified ${entityCount} entities (technologies, tools, people).`;
      }

      if (peerWorkflowCount > 0) {
        observation += ` Also retrieved ${peerWorkflowCount} anonymized peer workflow patterns for comparison.`;
      }

      if (workflowCount === 0) {
        observation = 'No workflow data found for the given query and time range. The user may not have captured any sessions yet, or the query may not match any recorded activities.';
      }

      logger.info('Retrieval Skill: Execution complete', {
        workflowCount,
        stepCount,
        sessionCount,
        peerWorkflowCount,
        executionTimeMs,
      });

      return {
        success: workflowCount > 0,
        observation,
        stateUpdates: {
          userEvidence: result.userEvidence,
          peerEvidence: result.peerEvidence,
          a1CritiqueResult: result.a1CritiqueResult,
        },
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Retrieval Skill: Execution failed', error instanceof Error ? error : new Error(errorMessage));

      return {
        success: false,
        observation: `Failed to retrieve user workflows: ${errorMessage}`,
        stateUpdates: {},
        error: errorMessage,
        executionTimeMs,
      };
    }
  },

  // =========================================================================
  // METADATA
  // =========================================================================

  wrapsAgent: 'A1_RETRIEVAL',
  canRunInParallel: false, // Should run first to provide context for other skills
  estimatedExecutionMs: 5000,
};
