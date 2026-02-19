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

const REASONING_SYSTEM_PROMPT = `You are the REASONING ENGINE of a workflow productivity assistant. Your SOLE PURPOSE is to decide which skill to invoke next OR whether to terminate and generate a final response.

You operate in a ReAct (Reason-Act-Observe) loop. Each iteration you must output a SINGLE decision.

================================================================================
SECTION 1: FACT DISAMBIGUATION - KEY DEFINITIONS
================================================================================

**SKILL**: A specialized function that retrieves or analyzes data. Skills are ATOMIC - they do one thing well.

**TERMINATION**: Stopping the loop to generate a final user response. Terminate ONLY when you have SUFFICIENT data.

**SUFFICIENT DATA** means:
- For EXPLORATION queries: User workflow evidence exists (even partial)
- For DIAGNOSTIC/OPTIMIZATION queries: User evidence (enriched with gap analysis, insights from session_mappings)
- For TOOL_INTEGRATION queries: Web search results about the tool
- For COMPARISON queries: User evidence (enriched with peer insights from session_mappings)
- For BLOG_CREATION/PROGRESS_UPDATE/SKILL_FILE_GENERATION queries: User workflow evidence ONLY (retrieval-only — specialized prompt handles generation)

**SKILL PREREQUISITES**: Some skills require outputs from other skills:
- search_web_best_practices: No prerequisites (can run first for TOOL_INTEGRATION)
- search_company_docs: No prerequisites
- search_conversation_memory: No prerequisites

================================================================================
SECTION 2: AVAILABLE SKILLS
================================================================================
{skills}

================================================================================
SECTION 3: STRICT DECISION RULES (follow in order)
================================================================================

RULE 1: NEVER invoke a skill that has already been used (check usedSkills list)
RULE 2: NEVER invoke a skill whose prerequisites are not met
RULE 3: ALWAYS prefer skills from the recommendedSkills list (intent-matched)
RULE 4: If user provided URLs, prioritize search_web_best_practices to fetch them
RULE 5: For TOOL_INTEGRATION intent, web search is PRIMARY source (invoke first)
RULE 6: Terminate when: (a) recommended skills exhausted, OR (b) sufficient data gathered

================================================================================
SECTION 4: TERMINATION DECISION MATRIX
================================================================================

| Intent                | Terminate When                                                |
|-----------------------|---------------------------------------------------------------|
| EXPLORATION           | Have userEvidence (any workflow data)                         |
| DIAGNOSTIC            | Have userEvidence (enriched with gap analysis + insights)     |
| OPTIMIZATION          | Have userEvidence + web/company optimization plan             |
| COMPARISON            | Have userEvidence (enriched with peer insights)               |
| TOOL_INTEGRATION      | Have web search results                                       |
| FEATURE_DISCOVERY     | Have userEvidence (enriched with insights)                    |
| BLOG_CREATION         | Have userEvidence (retrieval only — prompt does heavy lifting)|
| PROGRESS_UPDATE       | Have userEvidence (retrieval only — prompt does heavy lifting)|
| SKILL_FILE_GENERATION | Have userEvidence (retrieval only — prompt does heavy lifting)|
| GENERAL               | Have userEvidence + web/company optimization plan             |

Note: A1 retrieval now returns enriched session data (gap analysis, insights, peer insights) from session_mappings JSONB. No separate analysis or comparison skills needed.

================================================================================
SECTION 5: FEW-SHOT EXAMPLES
================================================================================

### EXAMPLE 1: First iteration, diagnostic query
Input State:
- Query: "Why am I so slow at deploying?"
- Intent: DIAGNOSTIC
- Iteration: 0
- Used skills: []
- Has user evidence: false
- Recommended: [retrieve_user_workflows, search_web_best_practices, ...]

Correct Output:
{
  "thought": "DIAGNOSTIC query about deployment speed. No data yet. RULE 3: prefer recommended skills. First skill is retrieve_user_workflows.",
  "shouldTerminate": false,
  "skillToInvoke": "retrieve_user_workflows",
  "skillInput": { "query": "deployment" }
}

### EXAMPLE 2: After retrieval, ready to respond (enriched data from session_mappings)
Input State:
- Query: "Why am I so slow at deploying?"
- Intent: DIAGNOSTIC
- Iteration: 1
- Used skills: [retrieve_user_workflows]
- Has user evidence: true (enriched with gap analysis, insights)

Correct Output:
{
  "thought": "Have enriched user evidence with gap analysis and insights. DIAGNOSTIC satisfied per termination matrix. Terminating.",
  "shouldTerminate": true,
  "terminationReason": "Sufficient enriched data for diagnostic response"
}

### EXAMPLE 3: Tool integration query
Input State:
- Query: "How do I integrate Notion with Slack?"
- Intent: TOOL_INTEGRATION
- Iteration: 0
- Used skills: []

Correct Output:
{
  "thought": "TOOL_INTEGRATION query. RULE 5: web search is PRIMARY for tool integration. Invoke search_web_best_practices first.",
  "shouldTerminate": false,
  "skillToInvoke": "search_web_best_practices",
  "skillInput": { "query": "Notion Slack integration setup guide" }
}

### EXAMPLE 4: Ready to terminate
Input State:
- Query: "Show me my workflow patterns"
- Intent: EXPLORATION
- Iteration: 1
- Used skills: [retrieve_user_workflows]
- Has user evidence: true

Correct Output:
{
  "thought": "EXPLORATION query. Matrix says: terminate when userEvidence exists. I have userEvidence=true. Terminating.",
  "shouldTerminate": true,
  "terminationReason": "EXPLORATION satisfied per termination matrix"
}

### EXAMPLE 5: OPTIMIZATION query with web search
Input State:
- Query: "How can I optimize my coding workflow?"
- Intent: OPTIMIZATION
- Iteration: 1
- Used skills: [retrieve_user_workflows]
- Has user evidence: true (enriched with gap analysis, insights)
- Has web optimization plan: false

Correct Output:
{
  "thought": "OPTIMIZATION query. Have enriched user evidence. Could benefit from web best practices. Invoking search_web_best_practices.",
  "shouldTerminate": false,
  "skillToInvoke": "search_web_best_practices",
  "skillInput": { "query": "coding workflow optimization best practices" }
}

### EXAMPLE 6: COMPARISON query — enriched data sufficient
Input State:
- Query: "How do I compare to others?"
- Intent: COMPARISON
- Iteration: 1
- Used skills: [retrieve_user_workflows]
- Has user evidence: true (enriched with peer insights from session_mappings)

Correct Output:
{
  "thought": "COMPARISON query. Have enriched user evidence with peer insights. Terminating per matrix.",
  "shouldTerminate": true,
  "terminationReason": "Enriched peer insights data sufficient for comparison"
}

================================================================================
SECTION 6: NEGATIVE EXAMPLES (common mistakes to avoid)
================================================================================

### WRONG: Terminating without enriched evidence
Input: Intent=DIAGNOSTIC, hasUserEvidence=false
WRONG Output: { "shouldTerminate": true, "terminationReason": "Ready to respond" }
WHY WRONG: DIAGNOSTIC requires enriched user evidence (with gap analysis and insights).

### WRONG: Invoking unavailable skill
Input: availableSkills=[retrieve_user_workflows, search_web_best_practices]
WRONG Output: { "skillToInvoke": "search_company_docs" }
WHY WRONG: search_company_docs is NOT in availableSkills. Violates RULE 2.

### WRONG: Re-invoking used skill
Input: usedSkills=[retrieve_user_workflows]
WRONG Output: { "skillToInvoke": "retrieve_user_workflows" }
WHY WRONG: Skill already used. Violates RULE 1.

### WRONG: Vague reasoning without rule citation
WRONG Output: { "thought": "I think we need more data so let's search" }
WHY WRONG: No rule or matrix citation. Must say "Per RULE 3..." or "Matrix shows..."

================================================================================
SECTION 7: OUTPUT FORMAT (strict JSON schema)
================================================================================

You MUST output valid JSON with these exact fields:
- thought: string (MUST cite which RULE or MATRIX row you're applying)
- shouldTerminate: boolean
- terminationReason: string | null (REQUIRED if shouldTerminate=true)
- skillToInvoke: string | null (REQUIRED if shouldTerminate=false, must be from availableSkills)
- skillInput: { query?: string, lookbackDays?: number, maxResults?: number } | null`;

const REASONING_USER_PROMPT = `================================================================================
CURRENT DECISION CONTEXT
================================================================================

## USER QUERY
"{query}"

## QUERY CLASSIFICATION (use this to determine termination criteria)
- Intent: {intent}
- Scope: {scope}
- Recommended skills (in priority order): [{recommendedSkills}]

## STATE FLAGS (check these against TERMINATION MATRIX)
- Iteration: {iteration}
- Skills already used: [{usedSkills}]
- hasUserEvidence: {hasUserEvidence}
- hasOptimizationPlans: {hasOptimizationPlans}
- hasConversationMemory: {hasConversationMemory}

## LAST OBSERVATION (result from previous skill)
{lastObservation}

## AVAILABLE SKILLS (only these can be invoked - prerequisites are met)
[{availableSkills}]

================================================================================
YOUR TASK
================================================================================

1. Check TERMINATION MATRIX: Does current state satisfy termination for intent={intent}?
   - If YES: Set shouldTerminate=true, provide terminationReason
   - If NO: Continue to step 2

2. Select next skill:
   - Apply RULE 1: Exclude skills in usedSkills
   - Apply RULE 3: Prefer skills from recommendedSkills list
   - Apply RULE 2: Only select from availableSkills
   - Set skillToInvoke and skillInput

3. Output your decision as valid JSON.

IMPORTANT: Your "thought" field must explicitly reference which RULE or MATRIX row justifies your decision.`;

// ============================================================================
// REASONING SCHEMA
// ============================================================================

// Schema for skill input parameters - OpenAI structured outputs requires all properties in 'required' array
// So we use nullable instead of optional to allow null values while satisfying schema requirements
const skillInputSchema = z
  .object({
    query: z.string().nullable().describe('Search query or context string'),
    lookbackDays: z.number().nullable().describe('Number of days to look back'),
    maxResults: z.number().nullable().describe('Maximum results to return'),
  })
  .describe('Input parameters for the skill');

const reasoningOutputSchema = z.object({
  thought: z.string().describe('Your reasoning about what to do next'),
  shouldTerminate: z.boolean().describe('Whether to stop and generate final response'),
  terminationReason: z.string().nullable().describe('Why you decided to terminate'),
  skillToInvoke: z.string().nullable().describe('The skill ID to invoke next'),
  skillInput: skillInputSchema.nullable(),
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
    currentStage: result.shouldTerminate
      ? 'agentic_terminating'
      : result.skillToInvoke
        ? `agentic_executing:${result.skillToInvoke}`
        : 'agentic_reasoning_complete',
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
  // A1 now provides enriched data (gap analysis, insights, peerInsights) from session_mappings
  const hasEnrichedEvidence = !!state.userEvidence;
  const hasOptimizations =
    state.webOptimizationPlan ||
    state.companyOptimizationPlan;

  // For exploration queries, just user evidence is enough
  if (state.queryClassification?.intent === 'EXPLORATION' && hasEnrichedEvidence) {
    return {
      thought: 'Have enriched user evidence for exploration query. Ready to respond.',
      shouldTerminate: true,
      terminationReason: 'Sufficient data for exploration query',
    };
  }

  // For template-based generation (blog, progress update, skill file),
  // only retrieval is needed — the specialized system prompt does the heavy lifting
  const templateIntents = ['BLOG_CREATION', 'PROGRESS_UPDATE', 'SKILL_FILE_GENERATION'];
  if (templateIntents.includes(state.queryClassification?.intent || '') && hasEnrichedEvidence) {
    return {
      thought: `Have user evidence for ${state.queryClassification?.intent} query. Retrieval only — specialized prompt handles generation.`,
      shouldTerminate: true,
      terminationReason: `Sufficient data for ${state.queryClassification?.intent} (retrieval-only intent)`,
    };
  }

  // For TOOL_INTEGRATION queries, web search is the PRIMARY source
  if (state.queryClassification?.intent === 'TOOL_INTEGRATION') {
    if (state.webOptimizationPlan) {
      return {
        thought: 'Have web search results for tool integration query. Ready to respond with integration guidance.',
        shouldTerminate: true,
        terminationReason: 'Web search provided integration guidance',
      };
    }
    if (!usedSkillsSet.has('search_web_best_practices') && availableSkillIds.includes('search_web_best_practices')) {
      return {
        thought: 'Tool integration query - need to search web for tool information and integration guidance.',
        shouldTerminate: false,
        skillToInvoke: 'search_web_best_practices',
        skillInput: { query: state.query },
      };
    }
  }

  // For COMPARISON queries, enriched evidence (with peerInsights) is sufficient
  if (state.queryClassification?.intent === 'COMPARISON' && hasEnrichedEvidence) {
    return {
      thought: 'Have enriched user evidence with peer insights for comparison query. Ready to respond.',
      shouldTerminate: true,
      terminationReason: 'Enriched evidence sufficient for comparison',
    };
  }

  // For DIAGNOSTIC/OPTIMIZATION/GENERAL, enriched evidence is the base requirement
  // Web/company optimization plans are bonus if available
  if (hasEnrichedEvidence && hasOptimizations) {
    return {
      thought: 'Have enriched evidence and optimization recommendations. Ready to generate response.',
      shouldTerminate: true,
      terminationReason: 'Sufficient data gathered for comprehensive response',
    };
  }

  // If we have enriched evidence but no optimizations, check if any optimization skills remain
  if (hasEnrichedEvidence) {
    const hasWebSearchAvailable = !usedSkillsSet.has('search_web_best_practices') && availableSkillIds.includes('search_web_best_practices');
    const hasCompanyDocsAvailable = !usedSkillsSet.has('search_company_docs') && availableSkillIds.includes('search_company_docs');

    // For intents that benefit from web/company search, try those first
    const benefitsFromSearch = ['DIAGNOSTIC', 'OPTIMIZATION', 'GENERAL', 'LEARNING', 'TOOL_MASTERY'].includes(
      state.queryClassification?.intent || ''
    );

    if (!benefitsFromSearch || (!hasWebSearchAvailable && !hasCompanyDocsAvailable)) {
      // No search skills needed or available — terminate with enriched evidence alone
      return {
        thought: 'Have enriched user evidence. No additional search skills needed. Ready to respond.',
        shouldTerminate: true,
        terminationReason: 'Enriched evidence sufficient',
      };
    }
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
    // Use regex with global flag for variables that may appear multiple times
    const intent = state.queryClassification?.intent || 'GENERAL';
    const userPrompt = REASONING_USER_PROMPT
      .replace('{query}', state.query)
      .replace(/{intent}/g, intent) // Global replace - appears in both classification and task sections
      .replace('{scope}', state.queryClassification?.scope || 'HOLISTIC')
      .replace('{recommendedSkills}', recommendedSkills.join(', '))
      .replace('{iteration}', String(state.currentIteration))
      .replace('{usedSkills}', state.usedSkills.join(', ') || 'none')
      .replace('{hasUserEvidence}', String(!!state.userEvidence))
      .replace('{hasOptimizationPlans}', String(
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

    // Ensure required fields are present and convert null to undefined for optional fields
    // (nullable is used in schema to satisfy OpenAI structured output requirements)
    return {
      thought: result.content.thought ?? 'No reasoning provided',
      shouldTerminate: result.content.shouldTerminate ?? false,
      terminationReason: result.content.terminationReason ?? undefined,
      skillToInvoke: result.content.skillToInvoke ?? undefined,
      skillInput: result.content.skillInput ?? undefined,
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

// ============================================================================
// TEST HELPERS (exported for validation tests)
// ============================================================================

/**
 * Build prompts with substituted values for testing
 * Validates that all template placeholders are properly replaced
 */
export function buildPromptsForTest(params: {
  skills: string;
  query: string;
  intent: string;
  scope: string;
  recommendedSkills: string[];
  iteration: number;
  usedSkills: string[];
  hasUserEvidence: boolean;
  hasOptimizationPlans: boolean;
  hasConversationMemory: boolean;
  lastObservation: string;
  availableSkills: string[];
}): { systemPrompt: string; userPrompt: string; unreplacedPlaceholders: string[] } {
  const systemPrompt = REASONING_SYSTEM_PROMPT.replace('{skills}', params.skills);

  const userPrompt = REASONING_USER_PROMPT
    .replace('{query}', params.query)
    .replace(/{intent}/g, params.intent)
    .replace('{scope}', params.scope)
    .replace('{recommendedSkills}', params.recommendedSkills.join(', '))
    .replace('{iteration}', String(params.iteration))
    .replace('{usedSkills}', params.usedSkills.join(', ') || 'none')
    .replace('{hasUserEvidence}', String(params.hasUserEvidence))
    .replace('{hasOptimizationPlans}', String(params.hasOptimizationPlans))
    .replace('{hasConversationMemory}', String(params.hasConversationMemory))
    .replace('{lastObservation}', params.lastObservation)
    .replace('{availableSkills}', params.availableSkills.join(', ') || 'none');

  // Check for any unreplaced placeholders (pattern: {word})
  const placeholderPattern = /\{[a-zA-Z_]+\}/g;
  const systemUnreplaced = systemPrompt.match(placeholderPattern) || [];
  const userUnreplaced = userPrompt.match(placeholderPattern) || [];
  const unreplacedPlaceholders = [...new Set([...systemUnreplaced, ...userUnreplaced])];

  return { systemPrompt, userPrompt, unreplacedPlaceholders };
}
