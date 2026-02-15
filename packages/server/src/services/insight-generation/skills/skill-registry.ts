/**
 * Skill Registry
 *
 * Central registry of all available skills for the agentic loop.
 * Integrates with the query classifier to help select appropriate skills.
 */

import type { SkillId, QueryIntent } from '../types.js';
import type { Skill, SkillRegistry, SkillDependencies } from './skill-types.js';
import { formatSkillsForPrompt, getAvailableSkills } from './skill-types.js';
import type { InsightState } from '../state/insight-state.js';
import { withTimeout } from '../../../core/retry-utils.js';

// Import all skills
import { retrievalSkill } from './retrieval-skill.js';
import { webSearchSkill } from './web-search-skill.js';
import { companyDocsSkill } from './company-docs-skill.js';
import { memorySearchSkill } from './memory-search-skill.js';

// ============================================================================
// SKILL REGISTRY
// ============================================================================

/**
 * Create and initialize the skill registry with all available skills
 */
export function createSkillRegistry(): SkillRegistry {
  const registry: SkillRegistry = new Map();

  // Register all skills (A2 Judge, A3 Comparator, A5 Feature Adoption removed — data now in session_mappings JSONB)
  registry.set('retrieve_user_workflows', retrievalSkill);
  registry.set('search_web_best_practices', webSearchSkill);
  registry.set('search_company_docs', companyDocsSkill);
  registry.set('search_conversation_memory', memorySearchSkill);

  return registry;
}

/**
 * Get a skill by ID from the registry
 */
export function getSkill(registry: SkillRegistry, skillId: SkillId): Skill | undefined {
  return registry.get(skillId);
}

/**
 * Get all skill IDs
 */
export function getAllSkillIds(registry: SkillRegistry): SkillId[] {
  return Array.from(registry.keys());
}

/**
 * Get all skills as an array
 */
export function getAllSkills(registry: SkillRegistry): Skill[] {
  return Array.from(registry.values());
}

// ============================================================================
// QUERY INTENT TO SKILL MAPPING
// ============================================================================

/**
 * Maps query intents to recommended skill sequences.
 * This guides the agentic loop on which skills to prioritize.
 */
export const INTENT_TO_SKILLS: Record<QueryIntent, SkillId[]> = {
  DIAGNOSTIC: [
    'retrieve_user_workflows',
    'search_web_best_practices',
    'search_company_docs',
  ],
  OPTIMIZATION: [
    'retrieve_user_workflows',
    'search_web_best_practices',
    'search_company_docs',
  ],
  COMPARISON: [
    'retrieve_user_workflows',
  ],
  EXPLORATION: [
    'retrieve_user_workflows',
  ],
  LEARNING: [
    'retrieve_user_workflows',
    'search_web_best_practices',
    'search_company_docs',
  ],
  PATTERN: [
    'retrieve_user_workflows',
  ],
  FEATURE_DISCOVERY: [
    'retrieve_user_workflows',
  ],
  TOOL_MASTERY: [
    'retrieve_user_workflows',
    'search_web_best_practices',
    'search_company_docs',
  ],
  TOOL_INTEGRATION: [
    'search_web_best_practices',
    'retrieve_user_workflows',
  ],
  GENERAL: [
    'retrieve_user_workflows',
    'search_web_best_practices',
    'search_company_docs',
  ],
  BLOG_CREATION: [
    'retrieve_user_workflows',
  ],
  PROGRESS_UPDATE: [
    'retrieve_user_workflows',
  ],
  SKILL_FILE_GENERATION: [
    'retrieve_user_workflows',
  ],
};

/**
 * Patterns that indicate memory search should be prioritized
 */
const MEMORY_SEARCH_PATTERNS = [
  /\bremember\s+(when|what|that)/i,
  /\bearlier\s+(you|we)\s+(mentioned|discussed|said)/i,
  /\blast\s+time\s+(we|you|i)/i,
  /\bwhat\s+did\s+(we|you)\s+(discuss|talk)/i,
  /\bprevious(ly)?\s+(conversation|discussion|recommendation)/i,
  /\bbefore\s+(you|we)\s+(mentioned|discussed|said)/i,
  /\bwhat\s+(did\s+)?you\s+suggest/i,
];

/**
 * Get recommended skills for a query based on its intent
 */
export function getRecommendedSkills(
  registry: SkillRegistry,
  intent: QueryIntent,
  query: string
): SkillId[] {
  const skills = [...INTENT_TO_SKILLS[intent]];

  // Check if memory search should be prioritized
  const needsMemorySearch = MEMORY_SEARCH_PATTERNS.some((p) => p.test(query));
  if (needsMemorySearch && !skills.includes('search_conversation_memory')) {
    // Add memory search at the beginning for conversational queries
    skills.unshift('search_conversation_memory');
  }

  return skills;
}

/**
 * Get the next recommended skill based on current state and intent
 */
export function getNextRecommendedSkill(
  registry: SkillRegistry,
  state: InsightState,
  intent: QueryIntent,
  query: string,
  usedSkills: Set<SkillId>
): SkillId | null {
  const recommendedSkills = getRecommendedSkills(registry, intent, query);
  const availableSkills = getAvailableSkills(registry, state);
  const availableIds = new Set(availableSkills.map((s) => s.id));

  // Find the first recommended skill that:
  // 1. Hasn't been used yet
  // 2. Has its prerequisites met
  for (const skillId of recommendedSkills) {
    if (!usedSkills.has(skillId) && availableIds.has(skillId)) {
      return skillId;
    }
  }

  return null;
}

// ============================================================================
// SKILL EXECUTION HELPERS
// ============================================================================

/**
 * Execute a skill with timeout protection
 * Uses withTimeout utility for proper cleanup of setTimeout handlers
 */
export async function executeSkillWithTimeout(
  skill: Skill,
  input: Parameters<Skill['execute']>[0],
  state: InsightState,
  deps: SkillDependencies,
  timeoutMs: number = 60000
): Promise<ReturnType<Skill['execute']>> {
  return withTimeout(
    skill.execute(input, state, deps),
    timeoutMs,
    `Skill ${skill.id} timed out`
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export skill types and utilities
export { formatSkillsForPrompt, getAvailableSkills } from './skill-types.js';

// Export individual skills for direct use if needed
export { retrievalSkill } from './retrieval-skill.js';
export { webSearchSkill } from './web-search-skill.js';
export { companyDocsSkill } from './company-docs-skill.js';
export { memorySearchSkill } from './memory-search-skill.js';
