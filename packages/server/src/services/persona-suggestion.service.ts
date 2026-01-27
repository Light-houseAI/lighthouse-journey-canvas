/**
 * PersonaSuggestionService
 * Generates contextual query suggestions based on user personas.
 * Each active persona gets at least one relevant suggestion.
 *
 * Suggestions are displayed as buttons in the Insight Assistant chat interface.
 */

import {
  PersonaType,
  PERSONA_TYPE_ICONS,
  type DerivedPersona,
  type PersonaSuggestion,
  type WorkPersonaContext,
  type PersonalProjectPersonaContext,
  type JobSearchPersonaContext,
  type LearningPersonaContext,
} from '@journey/schema';

import type { Logger } from '../core/logger.js';
import type { PersonaService } from './persona.service.js';
import type { SessionMappingRepository } from '../repositories/session-mapping.repository.js';

// ============================================================================
// TYPES
// ============================================================================

export interface PersonaSuggestionServiceDeps {
  personaService: PersonaService;
  sessionMappingRepository: SessionMappingRepository;
  logger: Logger;
}

export interface GenerateSuggestionsOptions {
  /** Maximum number of suggestions to return */
  limit?: number;
  /** Specific persona types to include */
  personaTypes?: PersonaType[];
}

// ============================================================================
// SUGGESTION TEMPLATES
// ============================================================================

/**
 * General workflow suggestions that apply to any user regardless of persona
 * These are shown when no persona-specific suggestions are available or as additional options
 */
const GENERAL_WORKFLOW_SUGGESTIONS: Array<{ query: string; label: string }> = [
  {
    query: 'What are my most time-consuming workflows and how can I optimize them?',
    label: 'Optimize slow workflows',
  },
  {
    query: 'Analyze my recent work sessions and identify patterns that could be improved.',
    label: 'Analyze work patterns',
  },
  {
    query: 'What repetitive tasks could I automate to save time?',
    label: 'Find automation opportunities',
  },
  {
    query: 'What tools am I using most and are there better alternatives?',
    label: 'Review tool usage',
  },
  {
    query: 'How does my workflow compare to best practices in my field?',
    label: 'Compare to best practices',
  },
  {
    query: 'What are the biggest bottlenecks in my daily work?',
    label: 'Identify bottlenecks',
  },
  {
    query: 'Suggest ways to reduce context switching and improve focus.',
    label: 'Improve focus',
  },
  {
    query: 'What skills should I develop based on my recent work?',
    label: 'Skill recommendations',
  },
];

/**
 * Template-based suggestions for each persona type
 * Multiple templates per persona for variety and optimization focus
 */
const SUGGESTION_TEMPLATES: Record<
  PersonaType,
  Array<(persona: DerivedPersona, recentActivity?: string) => { query: string; label: string }>
> = {
  [PersonaType.Work]: [
    (persona) => {
      const ctx = persona.context as WorkPersonaContext;
      return {
        query: `How can I improve my workflow efficiency for my role${ctx.company ? ` at ${ctx.company}` : ''}?`,
        label: `Optimize workflow`,
      };
    },
    (persona) => {
      const ctx = persona.context as WorkPersonaContext;
      return {
        query: `What tools or automations could save me time in my daily work${ctx.company ? ` at ${ctx.company}` : ''}?`,
        label: `Find time-savers`,
      };
    },
    (persona) => {
      const ctx = persona.context as WorkPersonaContext;
      return {
        query: `Analyze my work patterns and suggest areas where I could be more productive${ctx.company ? ` at ${ctx.company}` : ''}.`,
        label: `Analyze productivity`,
      };
    },
    (persona) => {
      const ctx = persona.context as WorkPersonaContext;
      return {
        query: `What are the common bottlenecks in workflows similar to mine and how can I avoid them?`,
        label: `Identify bottlenecks`,
      };
    },
  ],

  [PersonaType.PersonalProject]: [
    (persona) => {
      const ctx = persona.context as PersonalProjectPersonaContext;
      const projectName = ctx.projectName || 'my project';
      return {
        query: `What are the best practices and tools to accelerate progress on ${projectName}?`,
        label: `Boost ${truncate(projectName, 20)}`,
      };
    },
    (persona) => {
      const ctx = persona.context as PersonalProjectPersonaContext;
      const projectName = ctx.projectName || 'my project';
      return {
        query: `What development workflows would help me ship features faster on ${projectName}?`,
        label: `Ship faster`,
      };
    },
    (persona) => {
      const ctx = persona.context as PersonalProjectPersonaContext;
      const projectName = ctx.projectName || 'my project';
      return {
        query: `How can I automate repetitive tasks in ${projectName} to focus on building features?`,
        label: `Automate tasks`,
      };
    },
  ],

  [PersonaType.JobSearch]: [
    (persona) => {
      const ctx = persona.context as JobSearchPersonaContext;
      const targetRole = ctx.targetRole || 'my target role';
      return {
        query: `What skills should I highlight and practice for ${targetRole} positions?`,
        label: `Prepare for ${truncate(targetRole, 15)}`,
      };
    },
    (persona) => {
      const ctx = persona.context as JobSearchPersonaContext;
      const targetRole = ctx.targetRole || 'my target role';
      return {
        query: `How can I optimize my job search process for ${targetRole} positions?`,
        label: `Optimize job search`,
      };
    },
  ],

  [PersonaType.Learning]: [
    (persona) => {
      const ctx = persona.context as LearningPersonaContext;
      const focus = getLearningFocus(ctx);
      return {
        query: `What complementary topics or resources should I explore alongside ${focus}?`,
        label: `Enhance ${truncate(focus, 20)}`,
      };
    },
    (persona) => {
      const ctx = persona.context as LearningPersonaContext;
      const focus = getLearningFocus(ctx);
      return {
        query: `How can I learn ${focus} more efficiently and retain knowledge better?`,
        label: `Learn efficiently`,
      };
    },
  ],
};

/**
 * Contextual suggestion templates based on recent activity
 */
const ACTIVITY_BASED_TEMPLATES: Record<
  PersonaType,
  (persona: DerivedPersona, activitySummary: string) => { query: string; label: string } | null
> = {
  [PersonaType.Work]: (persona, activity) => {
    const ctx = persona.context as WorkPersonaContext;
    if (activity.toLowerCase().includes('debug') || activity.toLowerCase().includes('error')) {
      return {
        query: `I've been debugging issues recently. What are some efficient debugging strategies and tools I should consider?`,
        label: 'Improve debugging',
      };
    }
    if (activity.toLowerCase().includes('meeting') || activity.toLowerCase().includes('call')) {
      return {
        query: `I've been in a lot of meetings. How can I optimize my meeting workflow and follow-up process?`,
        label: 'Optimize meetings',
      };
    }
    if (activity.toLowerCase().includes('code review') || activity.toLowerCase().includes('pr')) {
      return {
        query: `I've been doing code reviews. What are best practices for efficient and effective code reviews?`,
        label: 'Better code reviews',
      };
    }
    return null;
  },

  [PersonaType.PersonalProject]: (persona, activity) => {
    const ctx = persona.context as PersonalProjectPersonaContext;
    if (activity.toLowerCase().includes('stuck') || activity.toLowerCase().includes('problem')) {
      return {
        query: `I'm working on ${ctx.projectName} and facing some challenges. What approaches might help me get unstuck?`,
        label: 'Get unstuck',
      };
    }
    return null;
  },

  [PersonaType.JobSearch]: (persona, activity) => {
    const ctx = persona.context as JobSearchPersonaContext;
    if (activity.toLowerCase().includes('interview')) {
      return {
        query: `I have interviews coming up for ${ctx.targetRole || 'my target role'}. What preparation tips would be most valuable?`,
        label: 'Interview prep tips',
      };
    }
    if (activity.toLowerCase().includes('application') || activity.toLowerCase().includes('apply')) {
      return {
        query: `I've been applying to ${ctx.targetRole || 'roles'}. How can I improve my application strategy and materials?`,
        label: 'Improve applications',
      };
    }
    return null;
  },

  [PersonaType.Learning]: (persona, activity) => {
    const ctx = persona.context as LearningPersonaContext;
    if (activity.toLowerCase().includes('practice') || activity.toLowerCase().includes('exercise')) {
      return {
        query: `I've been practicing ${getLearningFocus(ctx)}. What projects would help reinforce what I've learned?`,
        label: 'Practice projects',
      };
    }
    return null;
  },
};

// ============================================================================
// SERVICE
// ============================================================================

export class PersonaSuggestionService {
  private readonly personaService: PersonaService;
  private readonly sessionMappingRepository: SessionMappingRepository;
  private readonly logger: Logger;

  constructor(deps: PersonaSuggestionServiceDeps) {
    this.personaService = deps.personaService;
    this.sessionMappingRepository = deps.sessionMappingRepository;
    this.logger = deps.logger;
  }

  // --------------------------------------------------------------------------
  // PUBLIC METHODS
  // --------------------------------------------------------------------------

  /**
   * Generate suggestions based on user's workflows and active personas
   * Returns a mix of persona-specific and general workflow suggestions
   */
  async generateSuggestions(
    userId: number,
    options?: GenerateSuggestionsOptions
  ): Promise<PersonaSuggestion[]> {
    const limit = options?.limit ?? 10;
    const filterTypes = options?.personaTypes;

    this.logger.info('Generating persona suggestions', { userId, limit, filterTypes });

    try {
      const suggestions: PersonaSuggestion[] = [];
      let priority = limit;

      // 1. Try to get persona-based suggestions first
      let personas = await this.personaService.getActivePersonas(userId);

      // Filter by type if specified
      if (filterTypes && filterTypes.length > 0) {
        personas = personas.filter((p) => filterTypes.includes(p.type));
      }

      // 2. Generate persona-specific suggestions if we have personas
      if (personas.length > 0) {
        const suggestionsPerPersona = Math.max(2, Math.ceil(limit / personas.length));

        for (const persona of personas) {
          const personaSuggestions = await this.generateMultipleSuggestionsForPersona(
            userId,
            persona,
            suggestionsPerPersona,
            priority
          );
          suggestions.push(...personaSuggestions);
          priority -= personaSuggestions.length;

          if (suggestions.length >= limit) {
            break;
          }
        }
      }

      // 3. Fill remaining slots with general workflow suggestions
      if (suggestions.length < limit) {
        const generalSuggestions = this.getGeneralWorkflowSuggestions(
          limit - suggestions.length,
          priority
        );
        suggestions.push(...generalSuggestions);
      }

      this.logger.info('Generated persona suggestions', {
        userId,
        suggestionCount: suggestions.length,
        personaCount: personas.length,
      });

      return suggestions.slice(0, limit);
    } catch (error) {
      this.logger.error('Failed to generate persona suggestions', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });

      // Fall back to general suggestions on error
      this.logger.info('Falling back to general workflow suggestions', { userId });
      return this.getGeneralWorkflowSuggestions(limit, limit);
    }
  }

  /**
   * Generate multiple suggestions for a specific persona
   */
  async generateMultipleSuggestionsForPersona(
    userId: number,
    persona: DerivedPersona,
    count: number,
    startPriority: number
  ): Promise<PersonaSuggestion[]> {
    const suggestions: PersonaSuggestion[] = [];

    try {
      // Get recent activity for this persona's node
      const recentSessions = await this.sessionMappingRepository.getRecentByNode(
        userId,
        persona.nodeId,
        5
      );

      // Build activity summary from recent sessions
      const activitySummary = recentSessions
        .map((s) => s.highLevelSummary)
        .filter(Boolean)
        .join('; ');

      let priority = startPriority;

      // Try activity-based suggestion first
      if (activitySummary) {
        const activityTemplate = ACTIVITY_BASED_TEMPLATES[persona.type];
        const activitySuggestion = activityTemplate?.(persona, activitySummary);
        if (activitySuggestion) {
          suggestions.push(this.buildSuggestion(persona, activitySuggestion, priority--, 'activity'));
        }
      }

      // Add template-based suggestions
      const templates = SUGGESTION_TEMPLATES[persona.type] || [];
      for (let i = 0; i < templates.length && suggestions.length < count; i++) {
        const template = templates[i];
        const suggestion = template(persona, activitySummary);
        suggestions.push(this.buildSuggestion(persona, suggestion, priority--, 'template', i));
      }

      return suggestions.slice(0, count);
    } catch (error) {
      this.logger.warn('Failed to generate suggestions for persona', {
        error: error instanceof Error ? error.message : String(error),
        personaType: persona.type,
        nodeId: persona.nodeId,
      });

      // Return template-based fallback (first template only)
      const templates = SUGGESTION_TEMPLATES[persona.type] || [];
      if (templates.length > 0) {
        const suggestion = templates[0](persona);
        return [this.buildSuggestion(persona, suggestion, startPriority, 'fallback')];
      }
      return [];
    }
  }

  /**
   * Generate a single suggestion for a specific persona (legacy method)
   */
  async generateSuggestionForPersona(
    userId: number,
    persona: DerivedPersona,
    priority: number = 1
  ): Promise<PersonaSuggestion | null> {
    const suggestions = await this.generateMultipleSuggestionsForPersona(userId, persona, 1, priority);
    return suggestions[0] || null;
  }

  // --------------------------------------------------------------------------
  // PRIVATE METHODS
  // --------------------------------------------------------------------------

  /**
   * Get general workflow suggestions that apply to any user
   * Used when no persona-specific suggestions are available or to fill remaining slots
   */
  private getGeneralWorkflowSuggestions(count: number, startPriority: number): PersonaSuggestion[] {
    const suggestions: PersonaSuggestion[] = [];
    let priority = startPriority;

    // Shuffle general suggestions for variety
    const shuffled = [...GENERAL_WORKFLOW_SUGGESTIONS].sort(() => Math.random() - 0.5);

    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      const template = shuffled[i];
      suggestions.push({
        id: `general-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        personaType: PersonaType.Work, // Default to work type for styling
        personaDisplayName: 'Your Workflows',
        nodeId: '',
        suggestedQuery: template.query,
        buttonLabel: `✨ ${template.label}`,
        reasoning: 'Based on general workflow optimization strategies',
        priority: priority--,
      });
    }

    return suggestions;
  }

  /**
   * Build a PersonaSuggestion object from template result
   */
  private buildSuggestion(
    persona: DerivedPersona,
    template: { query: string; label: string },
    priority: number,
    source: 'activity' | 'template' | 'fallback',
    templateIndex?: number
  ): PersonaSuggestion {
    const icon = PERSONA_TYPE_ICONS[persona.type] || '';
    const uniqueSuffix = templateIndex !== undefined ? `-${templateIndex}` : '';

    return {
      id: `${persona.type}-${persona.nodeId}${uniqueSuffix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      personaType: persona.type,
      personaDisplayName: persona.displayName,
      nodeId: persona.nodeId,
      suggestedQuery: template.query,
      buttonLabel: `${icon} ${template.label}`,
      reasoning: `Based on your ${getPersonaTypeLabel(persona.type).toLowerCase()} (${source})`,
      priority,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Truncate text to max length with ellipsis
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 1) + '…';
}

/**
 * Get the learning focus description from context
 */
function getLearningFocus(ctx: LearningPersonaContext): string {
  switch (ctx.learningType) {
    case 'university':
      return ctx.areaOfStudy || ctx.school || 'my studies';
    case 'certification':
      return ctx.courseName || ctx.provider || 'my certification';
    case 'self-study':
      return ctx.learningFocus || 'my learning';
    default:
      return 'my learning';
  }
}

/**
 * Get human-readable label for persona type
 */
function getPersonaTypeLabel(type: PersonaType): string {
  const labels: Record<PersonaType, string> = {
    [PersonaType.Work]: 'Work',
    [PersonaType.PersonalProject]: 'Personal Project',
    [PersonaType.JobSearch]: 'Job Search',
    [PersonaType.Learning]: 'Learning',
  };
  return labels[type] || 'Activity';
}
