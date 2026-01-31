/**
 * Reasoning Node for Agentic Loop
 *
 * Implements the "Think" step of the ReAct pattern.
 * Decides which skill to invoke next based on:
 * 1. Current state and gathered information
 * 2. Query classification and intent
 * 3. Skill prerequisites and availability
 */

import type { Logger } from '../../../core/logger.js';
import type { LLMProvider } from '../../../core/llm-provider.js';
import type { SkillId, AgenticReasoningStep } from '../types.js';
import type { AgenticState, AgenticStateUpdate } from './agentic-state.js';
import { getLastObservation, hasUsedSkill } from './agentic-state.js';
import {
  createSkillRegistry,
  getRecommendedSkills,
  getNextRecommendedSkill,
  formatSkillsForPrompt,
} from '../skills/skill-registry.js';
import { getAvailableSkills, arePrerequisitesMet } from '../skills/skill-types.js';
import { z } from 'zod';

// ============================================================================
// TYPES
// ============================================================================

export interface ReasoningNodeDeps {
  logger: Logger;
  llmProvider: LLMProvider;
}

// ============================================================================
// REASONING PROMPTS
// ============================================================================

const REASONING_SYSTEM_PROMPT = `You are the reasoning engine of a productivity assistant that helps users understand and optimize their workflows.

Your task is to decide which skill to invoke next (or whether to terminate) based on the current state of analysis.

## AVAILABLE SKILLS
{skills}

## DECISION PROCESS
1. Review the user's query and what information has been gathered so far
2. Consider what skills have already been used and their results
3. Determine if you have enough information to answer the user's query
4. If not, select the most appropriate skill to invoke next

## TERMINATION CRITERIA
Terminate (set shouldTerminate: true) when:
- You have gathered sufficient information to answer the user's query
- All relevant skills have been used
- Further skill invocations would not add value
- An error has occurred that prevents further progress

## OUTPUT
Provide your reasoning thought and either:
- Select a skill to invoke (skillToInvoke: "skill_id")
- Decide to terminate (shouldTerminate: true)`;

const REASONING_USER_PROMPT = `## USER QUERY
"{query}"

## QUERY CLASSIFICATION
- Intent: {intent}
- Scope: {scope}
- Recommended skills: {recommendedSkills}

## CURRENT STATE
- Iteration: {iteration}
- Skills used: {usedSkills}
- Has user evidence: {hasUserEvidence}
- Has diagnostics: {hasDiagnostics}
- Has optimization plans: {hasOptimizationPlans}
- Has conversation memory: {hasConversationMemory}

## LAST OBSERVATION
{lastObservation}

## AVAILABLE SKILLS (prerequisites met)
{availableSkills}

Analyze the situation and decide what to do next.`;

// ============================================================================
// REASONING SCHEMA
// ============================================================================

// Schema for skill input parameters - uses explicit fields to satisfy Gemini's JSON Schema requirements
// (z.record(z.unknown()) produces empty properties which Gemini rejects)
const skillInputSchema = z
  .object({
    query: z.string().optional().describe('Search query or context string'),
    lookbackDays: z.number().optional().describe('Number of days to look back'),
    maxResults: z.number().optional().describe('Maximum results to return'),
  })
  .describe('Input parameters for the skill');

const reasoningOutputSchema = z.object({
  thought: z.string().describe('Your reasoning about what to do next'),
  shouldTerminate: z.boolean().describe('Whether to stop and generate final response'),
  terminationReason: z.string().optional().describe('Why you decided to terminate'),
  skillToInvoke: z.string().optional().describe('The skill ID to invoke next'),
  skillInput: skillInputSchema.optional(),
});

// ============================================================================
// REASONING NODE
// ============================================================================

/**
 * Reasoning node for the agentic loop graph
 * Decides which skill to invoke next or whether to terminate
 */
export async function reasoningNode(
  state: AgenticState,
  deps: ReasoningNodeDeps
): Promise<AgenticStateUpdate> {
  const { logger, llmProvider } = deps;

  logger.info('Reasoning: Starting skill selection', {
    iteration: state.currentIteration,
    usedSkills: state.usedSkills,
    query: state.query,
  });

  // Create skill registry
  const registry = createSkillRegistry();

  // Get query intent from classification
  const intent = state.queryClassification?.intent || 'GENERAL';
  const scope = state.queryClassification?.scope || 'HOLISTIC';

  // Get recommended skills based on intent
  const recommendedSkills = getRecommendedSkills(registry, intent, state.query);

  // Get available skills (prerequisites met)
  const availableSkills = getAvailableSkills(registry, state);
  const availableSkillIds = availableSkills.map((s) => s.id);

  // Get last observation
  const lastObservation = getLastObservation(state) || 'No previous actions taken.';

  // Check if we should use rule-based selection (faster) or LLM reasoning
  const useLLMReasoning = shouldUseLLMReasoning(state, availableSkillIds);

  let result: {
    thought: string;
    shouldTerminate: boolean;
    terminationReason?: string;
    skillToInvoke?: string;
    skillInput?: Record<string, unknown>;
  };

  if (useLLMReasoning) {
    // Use LLM for complex reasoning
    result = await llmBasedReasoning(
      state,
      deps,
      registry,
      recommendedSkills,
      availableSkillIds,
      lastObservation
    );
  } else {
    // Use rule-based selection (faster)
    result = ruleBasedReasoning(
      state,
      recommendedSkills,
      availableSkillIds,
      lastObservation
    );
  }

  logger.info('Reasoning: Decision made', {
    shouldTerminate: result.shouldTerminate,
    skillToInvoke: result.skillToInvoke,
    thought: result.thought.slice(0, 100) + '...',
  });

  // Create reasoning step
  const reasoningStep: AgenticReasoningStep = {
    stepNumber: state.currentIteration + 1,
    thought: result.thought,
    selectedSkill: result.skillToInvoke as SkillId | null,
    skillInput: result.skillInput || {},
    timestamp: new Date().toISOString(),
  };

  return {
    reasoningSteps: [reasoningStep],
    selectedSkill: result.skillToInvoke as SkillId || null,
    selectedSkillInput: result.skillInput || null,
    shouldTerminate: result.shouldTerminate,
    terminationReason: result.terminationReason || null,
    currentIteration: state.currentIteration + 1,
    currentStage: result.shouldTerminate ? 'agentic_terminating' : 'agentic_reasoning_complete',
    progress: Math.min(10 + state.currentIteration * 8, 90),
  };
}

// ============================================================================
// RULE-BASED REASONING
// ============================================================================

function shouldUseLLMReasoning(
  state: AgenticState,
  availableSkillIds: SkillId[]
): boolean {
  // Use LLM reasoning when:
  // 1. Multiple skills are available and it's not obvious which to choose
  // 2. We're past the first few iterations (complex state)
  // 3. The query is conversational (needs context understanding)

  if (state.queryClassification?.intent === 'GENERAL') {
    return true; // Ambiguous queries need LLM reasoning
  }

  if (state.currentIteration > 3) {
    return true; // Complex state needs LLM reasoning
  }

  if (availableSkillIds.length > 3 && state.currentIteration > 1) {
    return true; // Many options need LLM reasoning
  }

  return false; // Default to rule-based for speed
}

function ruleBasedReasoning(
  state: AgenticState,
  recommendedSkills: SkillId[],
  availableSkillIds: SkillId[],
  lastObservation: string
): {
  thought: string;
  shouldTerminate: boolean;
  terminationReason?: string;
  skillToInvoke?: string;
  skillInput?: Record<string, unknown>;
} {
  const usedSkillsSet = new Set(state.usedSkills);

  // =========================================================================
  // URL HANDLING: Prioritize fetching user-provided URLs first
  // =========================================================================
  const hasUrlsToFetch = (state.userProvidedUrls?.length ?? 0) > 0 && !state.urlFetchedContent;

  if (hasUrlsToFetch) {
    // If user provided URLs and we haven't fetched them yet, do that first
    if (availableSkillIds.includes('search_web_best_practices')) {
      return {
        thought: `User provided ${state.userProvidedUrls?.length} URL(s) in their query. Need to fetch and analyze this content first.`,
        shouldTerminate: false,
        skillToInvoke: 'search_web_best_practices',
        skillInput: { query: state.query, fetchUrls: true },
      };
    }
  }

  // If we have URL content, we may be ready to respond (for simple URL-based queries)
  if (state.urlFetchedContent && state.userProvidedUrls?.length) {
    // Check if the query is primarily about the URL content
    const queryLower = state.query.toLowerCase();
    const isUrlFocusedQuery =
      queryLower.includes('based on') ||
      queryLower.includes('from this') ||
      queryLower.includes('using this') ||
      queryLower.includes('create') ||
      queryLower.includes('make') ||
      queryLower.includes('skill file') ||
      !state.attachedSessionContext; // No attached sessions = likely URL-focused

    if (isUrlFocusedQuery) {
      return {
        thought: 'Have fetched content from user-provided URLs. Ready to respond based on URL content.',
        shouldTerminate: true,
        terminationReason: 'URL content fetched and ready to respond',
      };
    }
  }

  // Check if we should terminate
  // Condition 1: Have final result components
  const hasBasicAnalysis = state.userEvidence && state.userDiagnostics;
  const hasOptimizations =
    state.peerOptimizationPlan ||
    state.webOptimizationPlan ||
    state.companyOptimizationPlan ||
    (state.featureAdoptionTips && state.featureAdoptionTips.length > 0);

  // For exploration queries, just user evidence is enough
  if (state.queryClassification?.intent === 'EXPLORATION' && state.userEvidence) {
    return {
      thought: 'Have user evidence for exploration query. Ready to respond.',
      shouldTerminate: true,
      terminationReason: 'Sufficient data for exploration query',
    };
  }

  // For TOOL_INTEGRATION queries, web search is the PRIMARY source
  // Terminate when we have web search results (user context is optional bonus)
  if (state.queryClassification?.intent === 'TOOL_INTEGRATION') {
    if (state.webOptimizationPlan) {
      return {
        thought: 'Have web search results for tool integration query. Ready to respond with integration guidance.',
        shouldTerminate: true,
        terminationReason: 'Web search provided integration guidance',
      };
    }
    // For tool integration, prioritize web search skill
    if (!usedSkillsSet.has('search_web_best_practices') && availableSkillIds.includes('search_web_best_practices')) {
      return {
        thought: 'Tool integration query - need to search web for tool information and integration guidance.',
        shouldTerminate: false,
        skillToInvoke: 'search_web_best_practices',
        skillInput: { query: state.query },
      };
    }
  }

  // For optimization/diagnostic queries, need analysis and some optimizations
  if (hasBasicAnalysis && hasOptimizations) {
    return {
      thought: 'Have diagnostics and optimization recommendations. Ready to generate response.',
      shouldTerminate: true,
      terminationReason: 'Sufficient data gathered for comprehensive response',
    };
  }

  // Find next skill to use
  for (const skillId of recommendedSkills) {
    if (!usedSkillsSet.has(skillId) && availableSkillIds.includes(skillId)) {
      return {
        thought: `Need to gather more information. Next recommended skill: ${skillId}`,
        shouldTerminate: false,
        skillToInvoke: skillId,
        skillInput: { query: state.query },
      };
    }
  }

  // No more skills available - terminate
  return {
    thought: 'No more skills available or all prerequisites not met. Terminating with available data.',
    shouldTerminate: true,
    terminationReason: 'No more applicable skills available',
  };
}

// ============================================================================
// LLM-BASED REASONING
// ============================================================================

async function llmBasedReasoning(
  state: AgenticState,
  deps: ReasoningNodeDeps,
  registry: ReturnType<typeof createSkillRegistry>,
  recommendedSkills: SkillId[],
  availableSkillIds: SkillId[],
  lastObservation: string
): Promise<{
  thought: string;
  shouldTerminate: boolean;
  terminationReason?: string;
  skillToInvoke?: string;
  skillInput?: Record<string, unknown>;
}> {
  const { logger, llmProvider } = deps;

  try {
    // Build system prompt with available skills
    const skillsDescription = formatSkillsForPrompt(registry);
    const systemPrompt = REASONING_SYSTEM_PROMPT.replace('{skills}', skillsDescription);

    // Build user prompt with current state
    const userPrompt = REASONING_USER_PROMPT
      .replace('{query}', state.query)
      .replace('{intent}', state.queryClassification?.intent || 'GENERAL')
      .replace('{scope}', state.queryClassification?.scope || 'HOLISTIC')
      .replace('{recommendedSkills}', recommendedSkills.join(', '))
      .replace('{iteration}', String(state.currentIteration))
      .replace('{usedSkills}', state.usedSkills.join(', ') || 'none')
      .replace('{hasUserEvidence}', String(!!state.userEvidence))
      .replace('{hasDiagnostics}', String(!!state.userDiagnostics))
      .replace('{hasOptimizationPlans}', String(
        !!state.peerOptimizationPlan ||
        !!state.webOptimizationPlan ||
        !!state.companyOptimizationPlan
      ))
      .replace('{hasConversationMemory}', String(!!state.conversationMemory))
      .replace('{lastObservation}', lastObservation)
      .replace('{availableSkills}', availableSkillIds.join(', ') || 'none');

    const result = await llmProvider.generateStructuredResponse(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      reasoningOutputSchema
    );

    // Validate skill selection
    if (result.content.skillToInvoke && !availableSkillIds.includes(result.content.skillToInvoke as SkillId)) {
      logger.warn('Reasoning: LLM selected unavailable skill, falling back', {
        selected: result.content.skillToInvoke,
        available: availableSkillIds,
      });
      // Fall back to rule-based
      return ruleBasedReasoning(state, recommendedSkills, availableSkillIds, lastObservation);
    }

    // Ensure required fields are present (type inference from generateStructuredResponse may be partial)
    return {
      thought: result.content.thought ?? 'No reasoning provided',
      shouldTerminate: result.content.shouldTerminate ?? false,
      terminationReason: result.content.terminationReason,
      skillToInvoke: result.content.skillToInvoke,
      skillInput: result.content.skillInput,
    };
  } catch (error) {
    logger.error('Reasoning: LLM reasoning failed, falling back to rule-based', error instanceof Error ? error : new Error(String(error)));
    return ruleBasedReasoning(state, recommendedSkills, availableSkillIds, lastObservation);
  }
}

// ============================================================================
// ROUTING
// ============================================================================

/**
 * Route after reasoning node
 */
export function routeAfterReasoning(
  state: AgenticState
): 'act' | 'terminate' {
  if (state.shouldTerminate || !state.selectedSkill) {
    return 'terminate';
  }
  return 'act';
}
