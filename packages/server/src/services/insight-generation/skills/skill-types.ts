/**
 * Skill Types for Agentic Loop
 *
 * Defines the Skill interface that combines:
 * 1. Rich detailed descriptions for LLM reasoning
 * 2. Callable execute functions that wrap existing agents
 */

import type { Logger } from '../../../core/logger.js';
import type { LLMProvider } from '../../../core/llm-provider.js';
import type { NaturalLanguageQueryService } from '../../natural-language-query.service.js';
import type { PlatformWorkflowRepository } from '../../../repositories/platform-workflow.repository.js';
import type { SessionMappingRepository } from '../../../repositories/session-mapping.repository.js';
import type { EmbeddingService } from '../../interfaces/index.js';
import type { MemoryService } from '../memory.service.js';
import type { PersonaService } from '../../persona.service.js';
import type { NoiseFilterService } from '../filters/noise-filter.service.js';
import type { InsightModelConfiguration } from '../types.js';
import type { InsightState } from '../state/insight-state.js';
import type {
  SkillId,
  SkillDescription,
  SkillInput,
  SkillExecutionResult,
} from '../types.js';

// ============================================================================
// SKILL DEPENDENCIES
// ============================================================================

/**
 * Dependencies required by skills to execute
 * These are injected from the service container
 */
export interface SkillDependencies {
  logger: Logger;
  llmProvider: LLMProvider;
  nlqService: NaturalLanguageQueryService;
  platformWorkflowRepository: PlatformWorkflowRepository;
  sessionMappingRepository: SessionMappingRepository;
  embeddingService: EmbeddingService;
  memoryService?: MemoryService;
  personaService?: PersonaService;
  noiseFilterService?: NoiseFilterService;
  companyDocsEnabled: boolean;
  perplexityApiKey?: string;
  modelConfig?: Partial<InsightModelConfiguration>;
}

// ============================================================================
// SKILL INTERFACE
// ============================================================================

/**
 * A Skill combines a rich description (for LLM reasoning) with
 * a callable execute function (wrapping existing agent logic).
 *
 * The description fields help the agentic loop decide WHEN to use the skill.
 * The execute function performs the actual work by invoking the underlying agent.
 */
export interface Skill {
  // =========================================================================
  // DESCRIPTION (for LLM reasoning)
  // =========================================================================

  /** Unique skill identifier */
  id: SkillId;

  /** Human-readable skill name */
  name: string;

  /**
   * Detailed description of what the skill does.
   * This should be comprehensive enough for an LLM to understand
   * the skill's purpose and decide when to use it.
   */
  description: string;

  /**
   * Specific conditions/triggers for when to use this skill.
   * Examples: "User asks about their past work", "Need to identify inefficiencies"
   */
  whenToUse: string[];

  /**
   * Capabilities of this skill - what it can do.
   * Examples: "Searches across all user sessions", "Identifies inefficiency types"
   */
  capabilities: string[];

  /**
   * State fields this skill produces (outputs).
   * Examples: ['userEvidence', 'peerEvidence']
   */
  produces: string[];

  /**
   * State fields this skill requires (prerequisites).
   * Examples: ['userEvidence'] for skills that need user data first.
   * Empty array means no prerequisites.
   */
  requires: string[];

  // =========================================================================
  // EXECUTION (callable function)
  // =========================================================================

  /**
   * Execute the skill with the given input and current state.
   * This function wraps the underlying agent graph and returns structured results.
   *
   * @param input - Parameters for the skill execution
   * @param state - Current agentic loop state (read-only for skill)
   * @param deps - Injected dependencies (logger, services, etc.)
   * @returns Promise resolving to the execution result
   */
  execute(
    input: SkillInput,
    state: InsightState,
    deps: SkillDependencies
  ): Promise<SkillExecutionResult>;

  // =========================================================================
  // METADATA
  // =========================================================================

  /**
   * Which agent this skill wraps (for tracing/debugging)
   * Examples: 'A1_RETRIEVAL', 'A2_JUDGE', 'MEMORY_SERVICE'
   */
  wrapsAgent: string;

  /**
   * Whether this skill can run in parallel with others.
   * Skills that modify shared state should be sequential.
   */
  canRunInParallel: boolean;

  /**
   * Estimated execution time in milliseconds (for planning)
   */
  estimatedExecutionMs: number;
}

// ============================================================================
// SKILL REGISTRY TYPE
// ============================================================================

/**
 * Registry containing all available skills
 */
export type SkillRegistry = Map<SkillId, Skill>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert a Skill to its description-only form for LLM reasoning
 */
export function skillToDescription(skill: Skill): SkillDescription {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    whenToUse: skill.whenToUse,
    capabilities: skill.capabilities,
    produces: skill.produces,
    requires: skill.requires,
  };
}

/**
 * Format all skills as a string for inclusion in LLM prompts
 */
export function formatSkillsForPrompt(registry: SkillRegistry): string {
  const skills = Array.from(registry.values());

  return skills
    .map(
      (skill) => `
### ${skill.name} (\`${skill.id}\`)

**Description:** ${skill.description}

**When to Use:**
${skill.whenToUse.map((w) => `- ${w}`).join('\n')}

**Capabilities:**
${skill.capabilities.map((c) => `- ${c}`).join('\n')}

**Produces:** ${skill.produces.join(', ') || 'None'}

**Requires:** ${skill.requires.join(', ') || 'None (can be first skill)'}
`
    )
    .join('\n---\n');
}

/**
 * Check if a skill's prerequisites are satisfied by the current state
 */
export function arePrerequisitesMet(
  skill: Skill,
  state: InsightState
): { met: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const req of skill.requires) {
    const value = (state as Record<string, unknown>)[req];
    if (value === null || value === undefined) {
      missing.push(req);
    }
  }

  return {
    met: missing.length === 0,
    missing,
  };
}

/**
 * Get available skills based on current state
 * Returns skills whose prerequisites are satisfied
 */
export function getAvailableSkills(
  registry: SkillRegistry,
  state: InsightState
): Skill[] {
  return Array.from(registry.values()).filter(
    (skill) => arePrerequisitesMet(skill, state).met
  );
}
