/**
 * Company Docs Skill (wraps A4-Company Agent)
 *
 * This skill searches the user's uploaded company documentation for relevant
 * procedures and guidelines using hybrid RAG with pgvector.
 */

import { createCompanyDocsGraph, type CompanyDocsGraphDeps } from '../graphs/company-docs-graph.js';
import { createAgentLLMProvider } from '../utils/model-provider-factory.js';
import type { Skill, SkillDependencies } from './skill-types.js';
import type { SkillInput, SkillExecutionResult } from '../types.js';
import type { InsightState } from '../state/insight-state.js';

// ============================================================================
// SKILL DEFINITION
// ============================================================================

export const companyDocsSkill: Skill = {
  // =========================================================================
  // DESCRIPTION (for LLM reasoning)
  // =========================================================================

  id: 'search_company_docs',

  name: 'Search Company Documentation',

  description: `This skill searches the user's uploaded company documentation (internal wikis, runbooks, SOPs, engineering guides) for relevant procedures and guidelines using hybrid RAG with pgvector.

The skill retrieves relevant sections from company docs with page/section citations, extracts guidance applicable to the user's workflow, and maps internal procedures to current workflow steps.

This skill requires company docs to be enabled and indexed for the user's organization.`,

  whenToUse: [
    'User\'s company has indexed documentation',
    'Looking for internal procedures or guidelines',
    'Task involves company-specific tools or processes',
    'Need authoritative internal references',
    'User mentions company policies or standards',
    'Looking for team-specific best practices',
    'User asks about internal tools or workflows',
  ],

  capabilities: [
    'Searches company docs using semantic similarity (pgvector)',
    'Retrieves relevant sections with page/section citations',
    'Extracts guidance applicable to user\'s workflow',
    'Maps internal procedures to current workflow steps',
    'Generates Claude Code prompts aligned with company practices',
    'Cites specific documents, titles, and page numbers',
  ],

  produces: ['companyOptimizationPlan'],

  requires: ['userEvidence'], // Needs user evidence for context

  // =========================================================================
  // EXECUTION (callable function)
  // =========================================================================

  async execute(
    input: SkillInput,
    state: InsightState,
    deps: SkillDependencies
  ): Promise<SkillExecutionResult> {
    const { logger, nlqService, companyDocsEnabled, modelConfig } = deps;
    const startTime = Date.now();

    logger.info('Company Docs Skill: Starting execution', {
      hasUserEvidence: !!state.userEvidence,
      companyDocsEnabled,
      userId: state.userId,
    });

    // Check prerequisites
    if (!companyDocsEnabled) {
      return {
        success: false,
        observation: 'Cannot search company docs: Company documentation feature is not enabled for this organization.',
        stateUpdates: {},
        error: 'Company docs not enabled',
        executionTimeMs: Date.now() - startTime,
      };
    }

    if (!state.userEvidence) {
      return {
        success: false,
        observation: 'Cannot search company docs: No user evidence available. Run retrieve_user_workflows first.',
        stateUpdates: {},
        error: 'Missing prerequisite: userEvidence',
        executionTimeMs: Date.now() - startTime,
      };
    }

    try {
      // Get agent-specific LLM provider
      let llmProvider;
      try {
        llmProvider = createAgentLLMProvider('A4_COMPANY', modelConfig);
      } catch {
        logger.warn('Company Docs Skill: Failed to create A4-Company-specific provider, using default');
        llmProvider = deps.llmProvider;
      }

      // Prepare graph dependencies
      const graphDeps: CompanyDocsGraphDeps = {
        logger,
        llmProvider,
        nlqService,
      };

      // Create and invoke the A4-Company graph
      const graph = createCompanyDocsGraph(graphDeps);
      const result = await graph.invoke(state);

      const executionTimeMs = Date.now() - startTime;

      // Build observation
      const blockCount = result.companyOptimizationPlan?.blocks?.length ?? 0;
      const citationCount = result.companyOptimizationPlan?.blocks?.reduce(
        (sum, b) => sum + (b.citations?.length ?? 0),
        0
      ) ?? 0;

      let observation = `Found ${blockCount} recommendations from company documentation.`;
      if (citationCount > 0) {
        observation += ` Includes ${citationCount} document citations.`;
      }

      if (blockCount === 0) {
        observation = 'Company docs search complete but no relevant guidance found. The indexed documents may not contain information related to the identified workflow patterns.';
      }

      logger.info('Company Docs Skill: Execution complete', {
        blockCount,
        citationCount,
        executionTimeMs,
      });

      return {
        success: blockCount > 0,
        observation,
        stateUpdates: {
          companyOptimizationPlan: result.companyOptimizationPlan,
        },
        executionTimeMs,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error('Company Docs Skill: Execution failed', error instanceof Error ? error : new Error(errorMessage));

      return {
        success: false,
        observation: `Failed to search company docs: ${errorMessage}`,
        stateUpdates: {},
        error: errorMessage,
        executionTimeMs,
      };
    }
  },

  // =========================================================================
  // METADATA
  // =========================================================================

  wrapsAgent: 'A4_COMPANY',
  canRunInParallel: true, // Can run in parallel with A4-Web
  estimatedExecutionMs: 6000,
};
