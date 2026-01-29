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
  type WorkflowV2,
  type SemanticStep,
  type WorkflowInefficiency,
  type WorkflowRecommendation,
  type SessionChapter,
} from '@journey/schema';
import { z } from 'zod';

import type { Logger } from '../core/logger.js';
import type { PersonaService } from './persona.service.js';
import type { SessionMappingRepository, SessionMapping } from '../repositories/session-mapping.repository.js';
import { AISDKLLMProvider, type LLMProvider, type LLMConfig } from '../core/llm-provider.js';

// ============================================================================
// TYPES
// ============================================================================

export interface PersonaSuggestionServiceDeps {
  personaService: PersonaService;
  sessionMappingRepository: SessionMappingRepository;
  logger: Logger;
}

// ============================================================================
// LLM QUERY GENERATION SCHEMA
// ============================================================================

/**
 * Zod schema for LLM-generated CTA + query suggestions
 * New format with CTA prompt and improved suggested queries
 */
const LLMQuerySuggestionSchema = z.object({
  cta: z.object({
    label: z.string(),
    text: z.string(),
  }),
  suggested_queries: z.array(
    z.object({
      label: z.string(),
      tier: z.string(),
      query: z.string(),
      why_this: z.string(),
    })
  ),
});

type LLMQuerySuggestionResponse = z.infer<typeof LLMQuerySuggestionSchema>;

/**
 * CTA (Call-to-Action) for workflow optimization
 */
export interface WorkflowCTA {
  label: string;
  text: string;
}

/**
 * Create a Gemini Flash provider for query generation
 */
function createGeminiProvider(): LLMProvider | null {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.log('[PersonaSuggestionService] GOOGLE_API_KEY not found, LLM generation disabled');
    return null;
  }

  const config: LLMConfig = {
    provider: 'google',
    apiKey,
    model: 'gemini-2.5-flash',
    temperature: 0.7,
    maxTokens: 2000,
  };

  console.log('[PersonaSuggestionService] Creating Gemini 2.5 Flash provider for query suggestions');
  return new AISDKLLMProvider(config);
}

export interface GenerateSuggestionsOptions {
  /** Maximum number of suggestions to return */
  limit?: number;
  /** Specific persona types to include */
  personaTypes?: PersonaType[];
}

/**
 * Aggregated workflow data extracted from multiple sessions
 * Used to generate highly specific, context-rich query suggestions
 */
/**
 * 5-Tier Classification Priorities:
 * Tier 1 (Intent/Why) - level_1_intent → Priority 100
 * Tier 2 (Problem/What) - level_2_problem → Priority 80
 * Tier 3 (Approach/How) - level_3_approach → Priority 60
 * Tier 4 (Tools) - level_4_tools → Priority 40
 * Tier 5 (Outcome) - level_5_outcome → Priority 20
 */
const TIER_PRIORITIES = {
  INTENT: 100,    // Tier 1: Why
  PROBLEM: 80,    // Tier 2: What
  APPROACH: 60,   // Tier 3: How
  TOOLS: 40,      // Tier 4: With what
  OUTCOME: 20,    // Tier 5: Result
} as const;

interface AggregatedWorkflowData {
  /** Tool usage aggregated across sessions: tool name -> usage stats (Tier 4) */
  toolUsage: Map<string, { totalDurationSeconds: number; sessionCount: number; workflowCount: number }>;
  /** Approaches used (level_3_approach) -> frequency (Tier 3) */
  approaches: Map<string, number>;
  /** Problems addressed (level_2_problem) -> frequency (Tier 2) */
  problems: Map<string, number>;
  /** Intents (level_1_intent) -> frequency (Tier 1) */
  intents: Map<string, number>;
  /** Outcomes (level_5_outcome) -> frequency (Tier 5) */
  outcomes: Map<string, number>;
  /** Inefficiencies detected across sessions (maps to Tier 2 - Problems) */
  inefficiencies: Array<{ type: string; description: string; timeLostSeconds: number; sessionId?: string }>;
  /** Agentic patterns detected: pattern name -> stats (maps to Tier 3 - Approach) */
  agenticPatterns: Map<string, { count: number; totalDurationSeconds: number; tools: Set<string> }>;
  /** AI-generated recommendations (maps to Tier 5 - Outcome) */
  recommendations: Array<{ title: string; description: string; confidenceScore?: number }>;
  /** Total sessions processed */
  totalSessions: number;
  /** Total duration across all sessions */
  totalDurationSeconds: number;
  /** Recent workflow summaries for context */
  recentWorkflowSummaries: string[];
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
/**
 * Template-based suggestions for each persona type
 * NOTE: Avoid using track names (company, project names) in queries to prevent
 * misleading web search results when queries are passed to web agents.
 * Focus on workflow intent, tools, and approaches instead.
 */
const SUGGESTION_TEMPLATES: Record<
  PersonaType,
  Array<(persona: DerivedPersona, recentActivity?: string) => { query: string; label: string }>
> = {
  [PersonaType.Work]: [
    () => ({
      query: `Based on my recent work sessions, where am I losing the most time and how can I reclaim it?`,
      label: `Find time sinks`,
    }),
    () => ({
      query: `Analyze my workflow patterns and identify the biggest productivity bottlenecks I should fix.`,
      label: `Find bottlenecks`,
    }),
    () => ({
      query: `What repetitive tasks in my workflow could be automated to increase my output?`,
      label: `Automate tasks`,
    }),
    () => ({
      query: `Based on my tool usage, what integrations or shortcuts could speed up my development cycle?`,
      label: `Speed up workflow`,
    }),
  ],

  [PersonaType.PersonalProject]: [
    () => ({
      query: `Analyze my project sessions and identify what's blocking me from shipping faster.`,
      label: `Find blockers`,
    }),
    () => ({
      query: `What patterns in my workflow are slowing down my progress, and how can I fix them?`,
      label: `Improve velocity`,
    }),
    () => ({
      query: `Based on my recent sessions, what should I prioritize to make the most progress?`,
      label: `Prioritize work`,
    }),
  ],

  [PersonaType.JobSearch]: [
    (persona) => {
      const ctx = persona.context as JobSearchPersonaContext;
      const targetRole = ctx.targetRole || 'software engineering';
      return {
        query: `Based on my preparation activities, what gaps should I focus on for ${targetRole} roles?`,
        label: `Identify gaps`,
      };
    },
    (persona) => {
      const ctx = persona.context as JobSearchPersonaContext;
      const targetRole = ctx.targetRole || 'technical';
      return {
        query: `Analyze my job search patterns and suggest how to make my ${targetRole} applications more effective.`,
        label: `Improve applications`,
      };
    },
  ],

  [PersonaType.Learning]: [
    (persona) => {
      const ctx = persona.context as LearningPersonaContext;
      const focus = getLearningFocus(ctx);
      return {
        query: `Based on my learning sessions, what concepts in ${focus} should I reinforce or practice more?`,
        label: `Reinforce learning`,
      };
    },
    (persona) => {
      const ctx = persona.context as LearningPersonaContext;
      const focus = getLearningFocus(ctx);
      return {
        query: `Analyze my ${focus} study patterns and suggest how I can retain knowledge better.`,
        label: `Improve retention`,
      };
    },
  ],
};

/**
 * Contextual suggestion templates based on recent activity
 * NOTE: Avoid using track names in queries to prevent misleading web search results.
 */
const ACTIVITY_BASED_TEMPLATES: Record<
  PersonaType,
  (persona: DerivedPersona, activitySummary: string) => { query: string; label: string } | null
> = {
  [PersonaType.Work]: (_persona, activity) => {
    if (activity.toLowerCase().includes('debug') || activity.toLowerCase().includes('error')) {
      return {
        query: `I've been spending time debugging. What patterns in my debugging sessions suggest inefficiencies I could fix?`,
        label: 'Debug faster',
      };
    }
    if (activity.toLowerCase().includes('meeting') || activity.toLowerCase().includes('call')) {
      return {
        query: `I've had many meetings recently. How much productive time am I losing, and how can I reclaim it?`,
        label: 'Reclaim focus time',
      };
    }
    if (activity.toLowerCase().includes('code review') || activity.toLowerCase().includes('pr')) {
      return {
        query: `I've been doing code reviews frequently. Am I spending too much time on reviews, and how can I make them more efficient?`,
        label: 'Faster reviews',
      };
    }
    return null;
  },

  [PersonaType.PersonalProject]: (_persona, activity) => {
    if (activity.toLowerCase().includes('stuck') || activity.toLowerCase().includes('problem')) {
      return {
        query: `I keep getting stuck on my project. What's the pattern behind these blockers, and how do I prevent them?`,
        label: 'Break blockers',
      };
    }
    return null;
  },

  [PersonaType.JobSearch]: (persona, activity) => {
    const ctx = persona.context as JobSearchPersonaContext;
    const roleType = ctx.targetRole || 'technical';
    if (activity.toLowerCase().includes('interview')) {
      return {
        query: `I have ${roleType} interviews coming up. Based on my preparation patterns, what gaps should I focus on?`,
        label: 'Fill prep gaps',
      };
    }
    if (activity.toLowerCase().includes('application') || activity.toLowerCase().includes('apply')) {
      return {
        query: `I've been applying to ${roleType} roles. What's my application success rate suggesting about my materials?`,
        label: 'Improve success rate',
      };
    }
    return null;
  },

  [PersonaType.Learning]: (persona, activity) => {
    const ctx = persona.context as LearningPersonaContext;
    const focus = getLearningFocus(ctx);
    if (activity.toLowerCase().includes('practice') || activity.toLowerCase().includes('exercise')) {
      return {
        query: `I've been practicing ${focus}. Based on my learning patterns, what concepts am I struggling with most?`,
        label: 'Target weak areas',
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
  private readonly llmProvider: LLMProvider | null;

  constructor(deps: PersonaSuggestionServiceDeps) {
    this.personaService = deps.personaService;
    this.sessionMappingRepository = deps.sessionMappingRepository;
    this.logger = deps.logger;
    this.llmProvider = createGeminiProvider();

    if (this.llmProvider) {
      this.logger.info('Gemini Flash 2.0 provider initialized for query suggestions');
    } else {
      this.logger.warn('Gemini provider not available - falling back to template-based suggestions');
    }
  }

  // --------------------------------------------------------------------------
  // PUBLIC METHODS
  // --------------------------------------------------------------------------

  /**
   * Result from generating suggestions, including optional CTA
   */
  public static readonly DEFAULT_CTA: WorkflowCTA = {
    label: 'Explore optimizations',
    text: 'I noticed a few optimized methods and tools for this workflow based on how you work—want to explore them to make this task smoother?',
  };

  /**
   * Generate suggestions based on user's workflows and active personas
   * Uses Gemini Flash 2.0 to create highly specific, context-aware queries
   * Returns both suggestions and an optional CTA prompt
   */
  async generateSuggestions(
    userId: number,
    options?: GenerateSuggestionsOptions
  ): Promise<{ suggestions: PersonaSuggestion[]; cta: WorkflowCTA | null }> {
    const limit = options?.limit ?? 5;

    this.logger.info('Generating workflow suggestions', { userId, limit, hasLLM: !!this.llmProvider });

    try {
      // 1. Fetch recent sessions for workflow analysis
      const recentSessions = await this.sessionMappingRepository.getRecentSessions(userId, 30, 15);

      this.logger.info('Found recent sessions', {
        userId,
        sessionCount: recentSessions.length,
        sessionsWithSummary: recentSessions.filter((s) => s.summary).length,
      });

      if (recentSessions.length === 0) {
        this.logger.info('No recent sessions, using general suggestions', { userId });
        return this.getGeneralWorkflowSuggestions(limit, limit);
      }

      // 2. Aggregate workflow data from ALL sessions
      const workflowData = aggregateWorkflowData(recentSessions);

      this.logger.info('Aggregated workflow data', {
        userId,
        sessionsAnalyzed: workflowData.totalSessions,
        intentsFound: workflowData.intents.size,
        problemsFound: workflowData.problems.size,
        approachesFound: workflowData.approaches.size,
        toolsFound: workflowData.toolUsage.size,
        outcomesFound: workflowData.outcomes.size,
        workflowSummaries: workflowData.recentWorkflowSummaries.length,
      });

      // 3. Try LLM-based generation first (Gemini Flash 2.0)
      if (this.llmProvider) {
        try {
          console.log('[PersonaSuggestionService] Attempting LLM-based query generation...');
          const llmResult = await this.generateQueriesWithLLM(workflowData, limit);
          if (llmResult.queries.length > 0) {
            console.log('[PersonaSuggestionService] LLM generated', llmResult.queries.length, 'queries successfully');
            const personas = await this.personaService.getActivePersonas(userId);
            const defaultPersonaType = personas.length > 0 ? personas[0].type : PersonaType.Work;
            const icon = PERSONA_TYPE_ICONS[defaultPersonaType] || '✨';

            const suggestions: PersonaSuggestion[] = llmResult.queries.slice(0, limit).map((query, idx) => ({
              id: `llm-${query.tier}-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              personaType: defaultPersonaType,
              personaDisplayName: 'AI Insight',
              nodeId: '',
              suggestedQuery: query.query,
              buttonLabel: `${icon} ${query.label}`,
              reasoning: query.reasoning,
              priority: limit - idx,
            }));

            this.logger.info('Generated LLM-based suggestions', {
              userId,
              suggestionCount: suggestions.length,
              hasCta: !!llmResult.cta,
              queries: suggestions.map((s) => s.suggestedQuery.slice(0, 50) + '...'),
            });

            return { suggestions, cta: llmResult.cta };
          }
        } catch (llmError) {
          console.log('[PersonaSuggestionService] LLM generation failed:', llmError instanceof Error ? llmError.message : String(llmError));
          this.logger.warn('LLM query generation failed, falling back to templates', {
            error: llmError instanceof Error ? llmError.message : String(llmError),
            userId,
          });
        }
      }

      // 4. Fall back to template-based generation
      const contextualQueries = generateContextualQueries(workflowData);

      this.logger.info('Generated template-based queries', {
        userId,
        queryCount: contextualQueries.length,
        tiers: contextualQueries.map((q) => q.tier),
      });

      if (contextualQueries.length === 0) {
        const fallbackSuggestions = this.getGeneralWorkflowSuggestions(limit, limit);
        return { suggestions: fallbackSuggestions, cta: PersonaSuggestionService.DEFAULT_CTA };
      }

      const personas = await this.personaService.getActivePersonas(userId);
      const defaultPersonaType = personas.length > 0 ? personas[0].type : PersonaType.Work;
      const icon = PERSONA_TYPE_ICONS[defaultPersonaType] || '✨';

      const suggestions: PersonaSuggestion[] = contextualQueries.slice(0, limit).map((cq, idx) => ({
        id: `tier${cq.tier}-${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        personaType: defaultPersonaType,
        personaDisplayName: `Tier ${cq.tier} Insight`,
        nodeId: '',
        suggestedQuery: cq.query,
        buttonLabel: `${icon} ${cq.label}`,
        reasoning: cq.reasoning,
        priority: limit - idx,
      }));

      return { suggestions, cta: PersonaSuggestionService.DEFAULT_CTA };
    } catch (error) {
      this.logger.error('Failed to generate workflow suggestions', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId,
      });

      const fallbackSuggestions = this.getGeneralWorkflowSuggestions(limit, limit);
      return { suggestions: fallbackSuggestions, cta: null };
    }
  }

  /**
   * Generate CTA + query suggestions using Gemini Flash 2.0
   * Sends workflow data (5-tier classification + session summaries) to LLM
   */
  private async generateQueriesWithLLM(
    workflowData: AggregatedWorkflowData,
    limit: number
  ): Promise<{ cta: WorkflowCTA | null; queries: Array<{ query: string; label: string; tier: string; reasoning: string }> }> {
    if (!this.llmProvider) {
      return { cta: null, queries: [] };
    }

    // Build context from workflow data
    const workflowContext = this.buildWorkflowContextForLLM(workflowData);

    if (!workflowContext) {
      console.log('[PersonaSuggestionService] Insufficient workflow data for LLM generation');
      this.logger.debug('Insufficient workflow data for LLM generation');
      return { cta: null, queries: [] };
    }

    console.log('[PersonaSuggestionService] Workflow context length:', workflowContext.length, 'chars');

    const systemPrompt = `You are a "Suggested Queries + CTA" generator for a workflow insight product.
Your job: generate:
1. A single CTA prompt that invites the user to explore optimized methods/tools for their current task
2. ${limit} high-signal suggested queries the user can ask to uncover workflow improvements from their captured sessions

Hard rules:
- Be hyper-specific to workflowContext: reference the user's real tools/actions/patterns
- No counts or numeric metrics (no "two sessions", "15 minutes", "3 times")
- Never include track names, company names, or project names
- Exclude irrelevant context switches by default: Slack/DMs
- Queries must be actionable and lead to insights or a concrete next step
- Use plain user language. No buzzwords
- No ellipses and no vague questions
- Don't mention "tiers" in the user-facing text

Prioritization (highest → lowest):
Outcome clarity → approach improvement → problem diagnosis → intent alignment → tool mechanics

CTA requirements:
- Must be one sentence question
- Must be inviting, not pushy
- Must not include any forbidden names or numbers
- Should reference "optimized methods/tools" without naming the project/track/company
- Prefer wording like: "based on how you work" / "for this task" / "for this workflow"
- Style target: "I noticed a few optimized methods and tools for this workflow based on how you work—want to explore them to make this task smoother?"

Output format (STRICT):
Return only valid JSON with this shape:
{
  "cta": {
    "label": "Explore optimizations",
    "text": "..."
  },
  "suggested_queries": [
    {
      "label": "",
      "tier": "outcome | approach | problem | intent | tools",
      "query": "",
      "why_this": ""
    }
  ]
}`;

    const userPrompt = `Here is the user's workflowContext (derived from their captured sessions, steps, and summaries). Use ONLY this information.

${workflowContext}

Generate:
1. A single CTA (as specified)
2. ${limit} suggested queries in the required JSON format

Additional guidance:
- Tie each query to a specific observed pattern (tool switching, repeated edits, re-checking, rework, duplicated effort, waiting, unclear step boundaries)
- If "Detected Inefficiencies" exists, ensure at least half the queries directly target them
- If "AI Collaboration Patterns" exists, include a few queries about improving human+AI handoffs (prompting, grounding, verification, context packaging) while staying tool/step-specific

Return only valid JSON.`;

    try {
      const response = await this.llmProvider.generateStructuredResponse(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        LLMQuerySuggestionSchema,
        {
          temperature: 0.7,
          maxTokens: 2000,
          // Repair function to fix common JSON issues from LLM
          experimental_repairText: async ({ text, error }) => {
            this.logger.debug('Attempting to repair LLM response', {
              textLength: text.length,
              error: String(error),
            });
            // Try to extract JSON from the response if wrapped in markdown
            const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
              return jsonMatch[1].trim();
            }
            // Try to find JSON object in the text
            const objMatch = text.match(/\{[\s\S]*\}/);
            if (objMatch) {
              return objMatch[0];
            }
            return text;
          },
        }
      );

      const { cta, suggested_queries } = response.content;

      this.logger.debug('LLM generated CTA + queries', {
        hasCta: !!cta,
        queryCount: suggested_queries.length,
      });

      // Transform to the expected format
      const queries = suggested_queries.map((q) => ({
        query: q.query,
        label: q.label,
        tier: q.tier,
        reasoning: q.why_this,
      }));

      return { cta, queries };
    } catch (error) {
      this.logger.error('LLM query generation error', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Build a context string from workflow data for the LLM
   */
  private buildWorkflowContextForLLM(data: AggregatedWorkflowData): string | null {
    const sections: string[] = [];

    // Session summaries (most important context)
    if (data.recentWorkflowSummaries.length > 0) {
      sections.push('## Recent Session Summaries');
      data.recentWorkflowSummaries.slice(0, 5).forEach((summary, i) => {
        sections.push(`${i + 1}. ${summary}`);
      });
    }

    // Tier 5: Outcomes
    if (data.outcomes.size > 0) {
      sections.push('\n## Workflow Outcomes (Tier 5 - Results)');
      Array.from(data.outcomes.entries()).slice(0, 3).forEach(([outcome]) => {
        sections.push(`- ${outcome}`);
      });
    }

    // Tier 3: Approaches
    if (data.approaches.size > 0) {
      sections.push('\n## Approaches Used (Tier 3 - How)');
      Array.from(data.approaches.entries()).slice(0, 3).forEach(([approach]) => {
        sections.push(`- ${approach}`);
      });
    }

    // Tier 2: Problems
    if (data.problems.size > 0) {
      sections.push('\n## Problems Addressed (Tier 2 - What)');
      Array.from(data.problems.entries()).slice(0, 3).forEach(([problem]) => {
        sections.push(`- ${problem}`);
      });
    }

    // Tier 1: Intents
    if (data.intents.size > 0) {
      sections.push('\n## User Intents (Tier 1 - Why)');
      Array.from(data.intents.entries()).slice(0, 3).forEach(([intent]) => {
        sections.push(`- ${intent}`);
      });
    }

    // Tier 4: Tools
    if (data.toolUsage.size > 0) {
      sections.push('\n## Tools Used (Tier 4)');
      const tools = Array.from(data.toolUsage.keys()).slice(0, 5);
      sections.push(`- ${tools.join(', ')}`);
    }

    // Inefficiencies (if any)
    if (data.inefficiencies.length > 0) {
      sections.push('\n## Detected Inefficiencies');
      data.inefficiencies.slice(0, 3).forEach((ineff) => {
        sections.push(`- ${ineff.type}: ${ineff.description}`);
      });
    }

    // Recommendations (if any)
    if (data.recommendations.length > 0) {
      sections.push('\n## AI Recommendations');
      data.recommendations.slice(0, 3).forEach((rec) => {
        sections.push(`- ${rec.title}: ${rec.description}`);
      });
    }

    // Agentic patterns (if any)
    if (data.agenticPatterns.size > 0) {
      sections.push('\n## AI Collaboration Patterns');
      Array.from(data.agenticPatterns.entries()).slice(0, 2).forEach(([pattern, stats]) => {
        const tools = Array.from(stats.tools).slice(0, 3).join(', ');
        sections.push(`- ${pattern}${tools ? ` (using ${tools})` : ''}`);
      });
    }

    if (sections.length === 0) {
      return null;
    }

    return sections.join('\n');
  }

  /**
   * Generate multiple suggestions for a specific persona
   * Enhanced to use rich workflow data for highly specific, contextual queries
   */
  async generateMultipleSuggestionsForPersona(
    userId: number,
    persona: DerivedPersona,
    count: number,
    startPriority: number
  ): Promise<PersonaSuggestion[]> {
    const suggestions: PersonaSuggestion[] = [];

    try {
      // Get recent activity for this persona's node (increased from 5 to 10 for more context)
      const recentSessions = await this.sessionMappingRepository.getRecentByNode(
        userId,
        persona.nodeId,
        10
      );

      let priority = startPriority;

      // 1. Try workflow-aware contextual suggestions first (using rich summary data)
      const sessionsWithSummary = recentSessions.filter((s) => s.summary != null);

      if (sessionsWithSummary.length >= 2) {
        // Aggregate workflow data from sessions
        const workflowData = aggregateWorkflowData(sessionsWithSummary);

        // Generate contextual queries from workflow data
        const contextualQueries = generateContextualQueries(workflowData);

        this.logger.debug('Generated contextual queries from workflow data', {
          personaType: persona.type,
          nodeId: persona.nodeId,
          sessionCount: sessionsWithSummary.length,
          queryCount: contextualQueries.length,
          toolsFound: workflowData.toolUsage.size,
          inefficienciesFound: workflowData.inefficiencies.length,
          agenticPatternsFound: workflowData.agenticPatterns.size,
        });

        // Add contextual suggestions
        for (const query of contextualQueries) {
          if (suggestions.length >= count) break;

          suggestions.push(this.buildContextualSuggestion(
            persona,
            query,
            priority--
          ));
        }
      }

      // 2. Fall back to activity-based suggestions if we need more
      if (suggestions.length < count) {
        const activitySummary = recentSessions
          .map((s) => s.highLevelSummary)
          .filter(Boolean)
          .join('; ');

        if (activitySummary) {
          const activityTemplate = ACTIVITY_BASED_TEMPLATES[persona.type];
          const activitySuggestion = activityTemplate?.(persona, activitySummary);
          if (activitySuggestion) {
            suggestions.push(this.buildSuggestion(persona, activitySuggestion, priority--, 'activity'));
          }
        }
      }

      // 3. Fill remaining slots with template-based suggestions
      if (suggestions.length < count) {
        const templates = SUGGESTION_TEMPLATES[persona.type] || [];
        for (let i = 0; i < templates.length && suggestions.length < count; i++) {
          const template = templates[i];
          const activitySummary = recentSessions.map((s) => s.highLevelSummary).filter(Boolean).join('; ');
          const suggestion = template(persona, activitySummary);
          suggestions.push(this.buildSuggestion(persona, suggestion, priority--, 'template', i));
        }
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

  /**
   * Build a PersonaSuggestion from a contextual query result (workflow-aware)
   */
  private buildContextualSuggestion(
    persona: DerivedPersona,
    contextualQuery: ContextualQueryResult,
    priority: number
  ): PersonaSuggestion {
    const icon = PERSONA_TYPE_ICONS[persona.type] || '';

    return {
      id: `workflow-${persona.nodeId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      personaType: persona.type,
      personaDisplayName: persona.displayName,
      nodeId: persona.nodeId,
      suggestedQuery: contextualQuery.query,
      buttonLabel: `${icon} ${contextualQuery.label}`,
      reasoning: contextualQuery.reasoning,
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

// ============================================================================
// WORKFLOW DATA EXTRACTION HELPERS
// ============================================================================

/**
 * Detect schema version from a session summary
 */
function detectSchemaVersion(summary: unknown): 1 | 2 {
  if (typeof summary !== 'object' || summary === null) return 1;
  const obj = summary as Record<string, unknown>;
  if (obj.schema_version === 2 || obj.workflows) return 2;
  if (obj.chapters) return 1;
  return 1;
}

/**
 * Extract workflows from a session summary (handles V1 and V2)
 */
function extractWorkflows(summary: unknown): WorkflowV2[] {
  if (!summary || typeof summary !== 'object') return [];

  const version = detectSchemaVersion(summary);
  const obj = summary as Record<string, unknown>;

  if (version === 2 && Array.isArray(obj.workflows)) {
    return obj.workflows as WorkflowV2[];
  }

  // V1: Convert chapters to pseudo-workflows for tool extraction
  if (Array.isArray(obj.chapters)) {
    const chapters = obj.chapters as SessionChapter[];
    return chapters.map((chapter, idx) => ({
      id: `chapter-${idx}`,
      workflow_summary: chapter.summary || chapter.title,
      classification: {
        level_1_intent: 'Work task',
        level_2_problem: chapter.title,
        level_3_approach: 'Manual workflow',
        level_4_tools: chapter.primary_app ? [chapter.primary_app] : [],
        level_5_outcome: 'Completed',
        workflow_type: 'INTERNALLY_COMPARABLE' as const,
      },
      timestamps: {
        start: chapter.time_start || '',
        end: chapter.time_end || '',
        duration_ms: 0,
      },
      comparison_signature: {
        step_hash: '',
        complexity_score: 1,
      },
      semantic_steps: (chapter.granular_steps || []).map((step, stepIdx) => ({
        step_name: step.description,
        duration_seconds: 0,
        tools_involved: step.app ? [step.app] : [],
        description: step.description,
      })),
    }));
  }

  return [];
}

/**
 * Aggregate workflow data from multiple sessions
 * Extracts tools, approaches, inefficiencies, agentic patterns, and recommendations
 */
function aggregateWorkflowData(sessions: SessionMapping[]): AggregatedWorkflowData {
  const data: AggregatedWorkflowData = {
    toolUsage: new Map(),
    approaches: new Map(),
    problems: new Map(),
    intents: new Map(),
    outcomes: new Map(),
    inefficiencies: [],
    agenticPatterns: new Map(),
    recommendations: [],
    totalSessions: sessions.length,
    totalDurationSeconds: 0,
    recentWorkflowSummaries: [],
  };

  for (const session of sessions) {
    // Track total duration
    if (session.durationSeconds) {
      data.totalDurationSeconds += session.durationSeconds;
    }

    // Skip sessions without summary data
    if (!session.summary) continue;

    const workflows = extractWorkflows(session.summary);

    for (const workflow of workflows) {
      // Collect workflow summaries for context
      if (workflow.workflow_summary && data.recentWorkflowSummaries.length < 5) {
        data.recentWorkflowSummaries.push(workflow.workflow_summary);
      }

      // Extract classification data (5-tier hierarchy)
      if (workflow.classification) {
        const { level_1_intent, level_2_problem, level_3_approach, level_4_tools, level_5_outcome } = workflow.classification;

        // Tier 1: Track intents (Why)
        if (level_1_intent) {
          data.intents.set(level_1_intent, (data.intents.get(level_1_intent) || 0) + 1);
        }

        // Tier 2: Track problems (What)
        if (level_2_problem) {
          data.problems.set(level_2_problem, (data.problems.get(level_2_problem) || 0) + 1);
        }

        // Tier 3: Track approaches (How)
        if (level_3_approach) {
          data.approaches.set(level_3_approach, (data.approaches.get(level_3_approach) || 0) + 1);
        }

        // Tier 4: Track tools from classification
        if (level_4_tools && Array.isArray(level_4_tools)) {
          for (const tool of level_4_tools) {
            const existing = data.toolUsage.get(tool) || { totalDurationSeconds: 0, sessionCount: 0, workflowCount: 0 };
            existing.workflowCount++;
            data.toolUsage.set(tool, existing);
          }
        }

        // Tier 5: Track outcomes (Result)
        if (level_5_outcome) {
          data.outcomes.set(level_5_outcome, (data.outcomes.get(level_5_outcome) || 0) + 1);
        }
      }

      // Extract semantic steps for tool usage and agentic patterns
      if (workflow.semantic_steps && Array.isArray(workflow.semantic_steps)) {
        for (const step of workflow.semantic_steps) {
          // Track tools from steps
          if (step.tools_involved && Array.isArray(step.tools_involved)) {
            for (const tool of step.tools_involved) {
              const existing = data.toolUsage.get(tool) || { totalDurationSeconds: 0, sessionCount: 0, workflowCount: 0 };
              existing.totalDurationSeconds += step.duration_seconds || 0;
              data.toolUsage.set(tool, existing);
            }
          }

          // Track agentic patterns
          if (step.agentic_pattern) {
            const existing = data.agenticPatterns.get(step.agentic_pattern) || { count: 0, totalDurationSeconds: 0, tools: new Set() };
            existing.count++;
            existing.totalDurationSeconds += step.duration_seconds || 0;
            if (step.tools_involved) {
              for (const tool of step.tools_involved) {
                existing.tools.add(tool);
              }
            }
            data.agenticPatterns.set(step.agentic_pattern, existing);
          }
        }
      }

      // Extract inefficiencies
      if (workflow.inefficiencies && Array.isArray(workflow.inefficiencies)) {
        for (const ineff of workflow.inefficiencies) {
          data.inefficiencies.push({
            type: ineff.type,
            description: ineff.description,
            timeLostSeconds: ineff.time_lost_seconds,
            sessionId: session.id,
          });
        }
      }

      // Extract recommendations
      if (workflow.recommendations && Array.isArray(workflow.recommendations)) {
        for (const rec of workflow.recommendations) {
          data.recommendations.push({
            title: rec.title,
            description: rec.description,
            confidenceScore: rec.confidence_score,
          });
        }
      }
    }

    // Mark session as contributing to tool usage counts
    for (const [tool, stats] of data.toolUsage) {
      if (stats.workflowCount > 0) {
        stats.sessionCount++;
      }
    }
  }

  return data;
}

/**
 * Format duration in a human-readable way
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)} seconds`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  const hours = Math.round(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  return `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
}

/**
 * Get the top N items from a map sorted by value
 */
function getTopItems<T>(map: Map<string, T>, count: number, getValue: (item: T) => number): Array<[string, T]> {
  return Array.from(map.entries())
    .sort((a, b) => getValue(b[1]) - getValue(a[1]))
    .slice(0, count);
}

// ============================================================================
// CONTEXTUAL QUERY GENERATORS
// ============================================================================

/**
 * Agentic pattern descriptions for query generation
 */
const AGENTIC_PATTERN_DESCRIPTIONS: Record<string, string> = {
  'The Architect': 'planning and spec generation with AI',
  'The Operator': 'code generation with AI assistance',
  'The Reviewer': 'debugging and critique with AI',
  'The Centaur': 'rapid switching between IDE and AI',
};

interface ContextualQueryResult {
  query: string;
  label: string;
  reasoning: string;
  priority: number;
  tier: 1 | 2 | 3 | 4 | 5; // 5-tier classification level
}

/**
 * TIER 1: Generate intent-focused query (Why)
 * Highest priority - understanding user's underlying motivation
 */
function generateIntentQuery(data: AggregatedWorkflowData): ContextualQueryResult | null {
  const topIntents = getTopItems(data.intents, 1, (count) => count);
  if (topIntents.length === 0) return null;

  const [intent, count] = topIntents[0];

  const intentIsShort = intent.length <= 100;
  const query = intentIsShort
    ? `My main goal is "${intent}". Am I making efficient progress toward this goal, or are there obstacles slowing me down?`
    : `I've been focused on a specific goal recently. Am I making efficient progress, or are there obstacles slowing me down?`;

  return {
    query,
    label: `Check progress`,
    reasoning: `Primary intent detected across ${count} sessions`,
    priority: TIER_PRIORITIES.INTENT,
    tier: 1,
  };
}

/**
 * TIER 2: Generate problem-focused query (What)
 */
function generateProblemQuery(data: AggregatedWorkflowData): ContextualQueryResult | null {
  const topProblems = getTopItems(data.problems, 1, (count) => count);
  if (topProblems.length === 0) return null;

  const [problem, count] = topProblems[0];

  const problemIsShort = problem.length <= 100;
  const query = problemIsShort
    ? `I keep working on "${problem}". Why does this keep coming up, and how can I resolve it more permanently?`
    : `I keep returning to the same type of problem. What's causing this pattern, and how do I break it?`;

  return {
    query,
    label: `Resolve: ${truncate(problem, 18)}`,
    reasoning: `Recurring problem pattern detected`,
    priority: TIER_PRIORITIES.PROBLEM,
    tier: 2,
  };
}

/**
 * TIER 2: Generate inefficiency-focused query (What - as it identifies problems)
 */
function generateInefficiencyQuery(data: AggregatedWorkflowData): ContextualQueryResult | null {
  if (data.inefficiencies.length === 0) return null;

  const sorted = [...data.inefficiencies].sort((a, b) => b.timeLostSeconds - a.timeLostSeconds);
  const top = sorted[0];
  const timeStr = formatDuration(top.timeLostSeconds);

  const descriptionIsShort = top.description.length <= 120;
  const query = descriptionIsShort
    ? `I experience ${top.type.toLowerCase()}: "${top.description}". What's the root cause, and how do I eliminate this?`
    : `I experience ${top.type.toLowerCase()} in my workflow. What's causing this, and how do I eliminate it?`;

  return {
    query,
    label: `Fix: ${truncate(top.type, 20)}`,
    reasoning: `Detected inefficiency: ${top.description}`,
    priority: TIER_PRIORITIES.PROBLEM - 5, // Slightly lower than direct problem queries
    tier: 2,
  };
}

/**
 * TIER 3: Generate approach-focused query (How)
 */
function generateApproachQuery(data: AggregatedWorkflowData): ContextualQueryResult | null {
  const topApproaches = getTopItems(data.approaches, 1, (count) => count);
  if (topApproaches.length === 0) return null;

  const [approach, count] = topApproaches[0];

  const approachIsShort = approach.length <= 80;
  const query = approachIsShort
    ? `I repeatedly use "${approach}". Is this approach optimal, or are there faster alternatives I should try?`
    : `I've been using the same approach repeatedly. Could a different methodology help me move faster?`;

  return {
    query,
    label: `Evaluate approach`,
    reasoning: `Detected approach pattern: ${approach}`,
    priority: TIER_PRIORITIES.APPROACH,
    tier: 3,
  };
}

/**
 * TIER 3: Generate agentic pattern query (How - methodology with AI)
 */
function generateAgenticQuery(data: AggregatedWorkflowData): ContextualQueryResult | null {
  const patterns = Array.from(data.agenticPatterns.entries());
  if (patterns.length === 0) return null;

  const [patternName, stats] = patterns.sort((a, b) => b[1].count - a[1].count)[0];
  const description = AGENTIC_PATTERN_DESCRIPTIONS[patternName] || patternName.toLowerCase();
  const toolsUsed = Array.from(stats.tools).slice(0, 3).join(', ');

  return {
    query: `I'm using '${patternName}' pattern (${description})${toolsUsed ? ` with ${toolsUsed}` : ''}. Am I getting the most out of this AI collaboration, or could I leverage it better?`,
    label: `Maximize AI`,
    reasoning: `Detected ${patternName} pattern`,
    priority: TIER_PRIORITIES.APPROACH - 5, // Slightly lower than direct approach queries
    tier: 3,
  };
}

/**
 * TIER 4: Generate tool-specific query (With what)
 */
function generateToolQuery(data: AggregatedWorkflowData): ContextualQueryResult | null {
  const topTools = getTopItems(data.toolUsage, 3, (stats) => stats.totalDurationSeconds);
  if (topTools.length === 0) return null;

  const [toolName, usage] = topTools[0];

  const toolList = topTools.slice(0, 3).map(([name]) => name).join(', ');

  if (topTools.length >= 2) {
    return {
      query: `I frequently switch between ${toolList}. How can I reduce context-switching overhead and integrate them more seamlessly?`,
      label: `Reduce switching`,
      reasoning: `Based on your tool usage across ${data.totalSessions} sessions`,
      priority: TIER_PRIORITIES.TOOLS,
      tier: 4,
    };
  }

  return {
    query: `I use ${toolName} frequently. What productivity shortcuts or features am I likely underutilizing?`,
    label: `Optimize ${truncate(toolName, 20)}`,
    reasoning: `Based on frequent usage of ${toolName}`,
    priority: TIER_PRIORITIES.TOOLS,
    tier: 4,
  };
}

/**
 * TIER 5: Generate outcome-focused query (Result)
 */
function generateOutcomeQuery(data: AggregatedWorkflowData): ContextualQueryResult | null {
  const topOutcomes = getTopItems(data.outcomes, 1, (count) => count);
  if (topOutcomes.length === 0) return null;

  const [outcome, count] = topOutcomes[0];

  const outcomeIsShort = outcome.length <= 100;
  const query = outcomeIsShort
    ? `My workflows typically result in "${outcome}". How can I improve the quality or speed of these outcomes?`
    : `I've achieved similar outcomes across my workflows. How can I improve the quality or speed of these results?`;

  return {
    query,
    label: `Improve outcomes`,
    reasoning: `Common outcome pattern detected`,
    priority: TIER_PRIORITIES.OUTCOME,
    tier: 5,
  };
}

/**
 * TIER 5: Generate recommendation follow-up query (Result - improving outcomes)
 */
function generateRecommendationQuery(data: AggregatedWorkflowData): ContextualQueryResult | null {
  if (data.recommendations.length === 0) return null;

  const sorted = [...data.recommendations].sort((a, b) => (b.confidenceScore || 0.5) - (a.confidenceScore || 0.5));
  const top = sorted[0];

  const descriptionIsShort = top.description.length <= 150;
  const query = descriptionIsShort
    ? `My analysis recommended "${top.title}": ${top.description}. How much productivity gain could this bring, and what's the quickest way to implement it?`
    : `My analysis recommended "${top.title}". How much productivity gain could this bring, and how do I implement it?`;

  return {
    query,
    label: `Implement: ${truncate(top.title, 15)}`,
    reasoning: `AI recommendation from workflow analysis`,
    priority: TIER_PRIORITIES.OUTCOME - 5, // Slightly lower than direct outcome queries
    tier: 5,
  };
}

/**
 * Generate contextual queries following priority order:
 * Tier 5 (Outcome) → Tier 3 (Approach) → Tier 2 (Problem) → Tier 1 (Intent) → Tier 4 (Tools)
 *
 * This order prioritizes actionable insights:
 * - Outcomes/Recommendations first (what to improve)
 * - Approach improvements (how to work better)
 * - Problem patterns (what's recurring)
 * - Intent alignment (are you on track)
 * - Tool optimization (lowest priority)
 */
function generateContextualQueries(data: AggregatedWorkflowData): ContextualQueryResult[] {
  const queries: ContextualQueryResult[] = [];

  // TIER 5: Outcome (Result) - HIGHEST PRIORITY - actionable improvements
  const outcomeQuery = generateOutcomeQuery(data);
  if (outcomeQuery) queries.push(outcomeQuery);

  const recommendationQuery = generateRecommendationQuery(data);
  if (recommendationQuery) queries.push(recommendationQuery);

  // TIER 3: Approach (How) - Methodology and patterns
  const approachQuery = generateApproachQuery(data);
  if (approachQuery) queries.push(approachQuery);

  const agenticQuery = generateAgenticQuery(data);
  if (agenticQuery) queries.push(agenticQuery);

  // TIER 2: Problem (What) - Challenges and inefficiencies
  const problemQuery = generateProblemQuery(data);
  if (problemQuery) queries.push(problemQuery);

  const inefficiencyQuery = generateInefficiencyQuery(data);
  if (inefficiencyQuery) queries.push(inefficiencyQuery);

  // TIER 1: Intent (Why) - User's underlying motivation
  const intentQuery = generateIntentQuery(data);
  if (intentQuery) queries.push(intentQuery);

  // TIER 4: Tools (With what) - LOWEST PRIORITY
  const toolQuery = generateToolQuery(data);
  if (toolQuery) queries.push(toolQuery);

  // If we have fewer than 3 queries but have workflow summaries, generate summary-based queries
  if (queries.length < 3 && data.recentWorkflowSummaries.length > 0) {
    const summaryQueries = generateWorkflowSummaryQueries(data, 3 - queries.length);
    queries.push(...summaryQueries);
  }

  // Return in strict order (no sorting)
  return queries;
}

/**
 * Generate queries based on workflow summaries when tier data is sparse
 * Uses actual workflow descriptions to create specific questions
 */
function generateWorkflowSummaryQueries(
  data: AggregatedWorkflowData,
  count: number
): ContextualQueryResult[] {
  const queries: ContextualQueryResult[] = [];
  const summaries = data.recentWorkflowSummaries.slice(0, count);

  for (let i = 0; i < summaries.length && queries.length < count; i++) {
    const summary = summaries[i];
    if (!summary || summary.length < 10) continue;

    // Truncate if too long but keep meaningful content
    const displaySummary = summary.length > 80 ? summary.slice(0, 77) + '...' : summary;

    queries.push({
      query: `I recently worked on "${displaySummary}". How can I be more efficient next time I do this type of work?`,
      label: `Improve: ${truncate(summary, 20)}`,
      reasoning: `Based on recent workflow: ${summary}`,
      priority: TIER_PRIORITIES.OUTCOME - 10,
      tier: 5,
    });
  }

  // If still need more, use tool data even if partial
  if (queries.length < count && data.toolUsage.size > 0) {
    const tools = Array.from(data.toolUsage.keys()).slice(0, 3);
    if (tools.length > 0) {
      queries.push({
        query: `I've been using ${tools.join(', ')} frequently. What integrations or workflows could make these tools work better together?`,
        label: `Integrate tools`,
        reasoning: `Based on tool usage patterns`,
        priority: TIER_PRIORITIES.TOOLS - 10,
        tier: 4,
      });
    }
  }

  return queries;
}
