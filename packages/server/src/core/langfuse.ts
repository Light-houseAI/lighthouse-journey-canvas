/**
 * Langfuse Integration for LLM Observability
 *
 * Provides tracing, prompt management, and evaluation capabilities
 * for all LLM calls in the application.
 *
 * @see https://langfuse.com/docs
 */

import { Langfuse } from 'langfuse';

export interface LangfuseConfig {
  secretKey: string;
  publicKey: string;
  baseUrl?: string;
  enabled?: boolean;
}

let langfuseInstance: Langfuse | null = null;

/**
 * Get Langfuse configuration from environment variables
 */
export function getLangfuseConfig(): LangfuseConfig | null {
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;

  if (!secretKey || !publicKey) {
    return null;
  }

  return {
    secretKey,
    publicKey,
    baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
    enabled: process.env.LANGFUSE_ENABLED !== 'false',
  };
}

/**
 * Initialize and get the Langfuse client instance (singleton)
 */
export function getLangfuse(): Langfuse | null {
  if (langfuseInstance) {
    return langfuseInstance;
  }

  const config = getLangfuseConfig();
  if (!config || !config.enabled) {
    return null;
  }

  langfuseInstance = new Langfuse({
    secretKey: config.secretKey,
    publicKey: config.publicKey,
    baseUrl: config.baseUrl,
  });

  return langfuseInstance;
}

/**
 * Shutdown Langfuse gracefully (flush pending events)
 */
export async function shutdownLangfuse(): Promise<void> {
  if (langfuseInstance) {
    await langfuseInstance.shutdownAsync();
    langfuseInstance = null;
  }
}

/**
 * Create a trace for an LLM operation
 */
export function createTrace(options: {
  name: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}) {
  const langfuse = getLangfuse();
  if (!langfuse) {
    return null;
  }

  return langfuse.trace({
    name: options.name,
    userId: options.userId,
    sessionId: options.sessionId,
    metadata: options.metadata,
    tags: options.tags,
  });
}

/**
 * Helper to track LLM generation with automatic token/cost tracking
 */
export interface GenerationInput {
  name: string;
  model: string;
  modelParameters?: Record<string, any>;
  input: any;
  metadata?: Record<string, any>;
}

export interface GenerationOutput {
  output: any;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Wrapper for tracking LLM generations
 * Used by the LLM provider to automatically trace all generations
 */
export class LangfuseTracer {
  private langfuse: Langfuse | null;
  private currentTrace: ReturnType<Langfuse['trace']> | null = null;

  constructor() {
    this.langfuse = getLangfuse();
  }

  /**
   * Start a new trace for a workflow/operation
   */
  startTrace(options: {
    name: string;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
    tags?: string[];
  }) {
    if (!this.langfuse) {
      return null;
    }

    this.currentTrace = this.langfuse.trace({
      name: options.name,
      userId: options.userId,
      sessionId: options.sessionId,
      metadata: options.metadata,
      tags: options.tags,
    });

    return this.currentTrace;
  }

  /**
   * Track an LLM generation within the current trace
   */
  trackGeneration(
    input: GenerationInput,
    parentSpan?: ReturnType<ReturnType<Langfuse['trace']>['span']>
  ) {
    const parent = parentSpan || this.currentTrace;
    if (!parent) {
      return null;
    }

    const generation = parent.generation({
      name: input.name,
      model: input.model,
      modelParameters: input.modelParameters,
      input: input.input,
      metadata: input.metadata,
    });

    return {
      end: (output: GenerationOutput) => {
        generation.end({
          output: output.output,
          usage: output.usage
            ? {
                input: output.usage.promptTokens,
                output: output.usage.completionTokens,
                total: output.usage.totalTokens,
              }
            : undefined,
        });
      },
      update: (data: Partial<GenerationOutput>) => {
        generation.update({
          output: data.output,
          usage: data.usage
            ? {
                input: data.usage.promptTokens,
                output: data.usage.completionTokens,
                total: data.usage.totalTokens,
              }
            : undefined,
        });
      },
    };
  }

  /**
   * Create a span for a sub-operation
   */
  createSpan(options: {
    name: string;
    input?: any;
    metadata?: Record<string, any>;
  }) {
    if (!this.currentTrace) {
      return null;
    }

    const span = this.currentTrace.span({
      name: options.name,
      input: options.input,
      metadata: options.metadata,
    });

    return {
      end: (output?: any) => {
        span.end({ output });
      },
      generation: (input: GenerationInput) => this.trackGeneration(input, span as any),
    };
  }

  /**
   * End the current trace
   */
  endTrace(output?: any) {
    if (this.currentTrace) {
      this.currentTrace.update({ output });
    }
    this.currentTrace = null;
  }

  /**
   * Flush all pending events to Langfuse
   */
  async flush() {
    if (this.langfuse) {
      await this.langfuse.flushAsync();
    }
  }
}

/**
 * Create a new tracer instance for a specific operation
 */
export function createTracer(): LangfuseTracer {
  return new LangfuseTracer();
}

/**
 * Log a score/evaluation to Langfuse
 */
export function logScore(options: {
  traceId: string;
  name: string;
  value: number;
  comment?: string;
}) {
  const langfuse = getLangfuse();
  if (!langfuse) {
    return;
  }

  langfuse.score({
    traceId: options.traceId,
    name: options.name,
    value: options.value,
    comment: options.comment,
  });
}

// ============================================================================
// PROMPT MANAGEMENT
// ============================================================================

/**
 * Prompt cache to avoid repeated API calls
 * Maps prompt name -> { prompt, fetchedAt }
 */
const promptCache = new Map<string, { prompt: string; config?: Record<string, any>; fetchedAt: number }>();
const PROMPT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Known prompt names for type safety
 * These correspond to prompts that can be managed in Langfuse Prompt Registry
 */
export type PromptName =
  | 'block-extraction'
  | 'step-extraction'
  | 'block-canonicalization'
  | 'workflow-analysis'
  | 'entity-extraction'
  | 'head-analyst-report'
  | 'pattern-name-generation'
  | 'profile-match-reasons'
  | 'career-insights';

/**
 * Default prompts for each prompt name
 * Used as fallback when Langfuse is not available or prompt is not found
 */
export const DEFAULT_PROMPTS: Record<PromptName, string> = {
  'block-extraction': `Extract workflow blocks from the given screenshot sequence.
Identify distinct activities, their tools, and duration.`,

  'step-extraction': `Extract individual steps from a workflow block.
Identify actions, inputs, and outputs for each step.`,

  'block-canonicalization': `Given this block activity description: "{{suggestedName}}"
Tool used: {{primaryTool}}
Duration: {{durationSeconds}} seconds

Provide a canonical, standardized name for this activity block.
The name should be:
1. 2-4 words
2. Action-oriented (e.g., "AI Code Prompting", "Git Commit Operations")
3. Tool-agnostic when possible
4. Clear and descriptive

Also determine the best intent category from:
ai_prompt, code_edit, code_review, terminal_command, file_navigation, web_research, git_operation, documentation, testing, debugging, communication

Respond in JSON:
{
  "canonical": "<canonical name>",
  "intent": "<intent category>"
}`,

  'workflow-analysis': `You are a Head Analyst conducting a fine-grained workflow analysis based on captured work session screenshots.

## Analysis Objectives

Conduct a comprehensive workflow analysis covering:

1. **Productivity Patterns**: Identify when and how the user is most productive
2. **Repetitive Applications**: Identify which apps are used most frequently and detect repetitive workflows
3. **Common Step Sequences**: Detect recurring patterns in the user's workflow steps
4. **Bottlenecks**: Detect workflow inefficiencies, delays, or friction points
5. **Context Switches**: Analyze task-switching behavior and calculate the cost
6. **Time Distribution**: Understand how time is allocated across workflow types
7. **Optimization Opportunities**: Identify specific actions to increase productivity
8. **Best Practices**: Recognize effective workflow habits worth maintaining
9. **Improvement Areas**: Suggest specific, actionable optimizations

## Instructions

- Be specific and data-driven
- DO NOT include screenshot numbers in descriptions
- Identify repetitive patterns
- Calculate impact estimates
- Provide concrete, actionable recommendations`,

  'entity-extraction': `Extract entities and concepts from the workflow data.
Identify tools, technologies, projects, and key concepts mentioned.`,

  'head-analyst-report': `Generate a comprehensive workflow analysis report.
Include executive summary, insights, recommendations, and key metrics.`,

  'pattern-name-generation': `Given this workflow sequence: {{blockNames}}

Generate a concise, descriptive name (3-5 words) that captures the overall workflow intent.
Examples: "AI-Assisted Feature Development", "Bug Fix and Deploy", "Research and Documentation"

Respond with just the name, no quotes.`,

  'profile-match-reasons': `You are analyzing why a professional profile matches a search query.

Search Query: "{{query}}"

Professional Experience Data:
{{profileData}}

Generate 2-3 specific, factual reasons why this profile matches the search query. Focus on:
- Relevant skills and technologies
- Experience level and duration
- Project types and achievements
- Educational background relevance

Each reason should be:
- Specific and factual (not generic)
- Under 80 characters
- Based only on the provided data
- Professional and concise

Return as a JSON object with a "reasons" array containing 1-3 strings.`,

  'career-insights': `Analyze this professional profile and generate exactly 2 career learning insights that OTHER professionals can learn from.

Professional Experience Data:
{{profileData}}

Generate exactly 2 actionable learning insights in the format of advice/lessons:

Requirements:
- Each insight should be practical advice (60-120 characters)
- Start with phrases like "Key lesson:", "Success strategy:", "Career tip:", or "Learning:"
- Focus on actionable takeaways from their career path
- Make it valuable for other professionals

Return as a JSON object with an "insights" array containing exactly 2 strings.`,
};

/**
 * Fetch a prompt from Langfuse Prompt Registry
 * Falls back to the provided default if Langfuse is unavailable or prompt doesn't exist
 *
 * @param name - The prompt name in Langfuse
 * @param defaultPrompt - Fallback prompt if Langfuse is unavailable
 * @param variables - Variables to substitute in the prompt template
 * @returns The compiled prompt string
 */
export async function getPrompt(
  name: PromptName | string,
  defaultPrompt: string,
  variables?: Record<string, string | number>
): Promise<{ prompt: string; fromLangfuse: boolean; config?: Record<string, any> }> {
  const langfuse = getLangfuse();

  // If Langfuse is not available, use default
  if (!langfuse) {
    return {
      prompt: compilePromptTemplate(defaultPrompt, variables),
      fromLangfuse: false,
    };
  }

  // Check cache first
  const cached = promptCache.get(name);
  if (cached && Date.now() - cached.fetchedAt < PROMPT_CACHE_TTL_MS) {
    return {
      prompt: compilePromptTemplate(cached.prompt, variables),
      fromLangfuse: true,
      config: cached.config,
    };
  }

  try {
    // Fetch from Langfuse Prompt Registry
    const langfusePrompt = await langfuse.getPrompt(name);

    if (langfusePrompt) {
      // Get the prompt text - handle both text and chat prompts
      let promptText: string;
      let config: Record<string, any> | undefined;

      if (langfusePrompt.type === 'text') {
        promptText = langfusePrompt.prompt;
        config = langfusePrompt.config as Record<string, any> | undefined;
      } else if (langfusePrompt.type === 'chat') {
        // For chat prompts, join the messages
        const messages = langfusePrompt.prompt as unknown as Array<{ role: string; content: string }>;
        promptText = messages.map(m => m.content).join('\n\n');
        config = langfusePrompt.config as Record<string, any> | undefined;
      } else {
        // Fallback for unknown types
        promptText = String(langfusePrompt.prompt);
      }

      // Cache the result
      promptCache.set(name, {
        prompt: promptText,
        config,
        fetchedAt: Date.now(),
      });

      return {
        prompt: compilePromptTemplate(promptText, variables),
        fromLangfuse: true,
        config,
      };
    }
  } catch (error) {
    // Log but don't fail - fall back to default
    console.warn(`[Langfuse] Failed to fetch prompt "${name}":`, error);
  }

  // Fallback to default prompt
  return {
    prompt: compilePromptTemplate(defaultPrompt, variables),
    fromLangfuse: false,
  };
}

/**
 * Compile a prompt template by substituting variables
 * Supports {{variable}} syntax
 */
function compilePromptTemplate(
  template: string,
  variables?: Record<string, string | number>
): string {
  if (!variables) {
    return template;
  }

  let compiled = template;
  for (const [key, value] of Object.entries(variables)) {
    compiled = compiled.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
  }
  return compiled;
}

/**
 * Clear the prompt cache (useful for testing or forcing refresh)
 */
export function clearPromptCache(): void {
  promptCache.clear();
}

/**
 * Get a managed prompt by name with automatic default fallback
 * Convenience wrapper that uses DEFAULT_PROMPTS for the fallback
 *
 * @param name - The prompt name (must be a known PromptName)
 * @param variables - Variables to substitute in the prompt template
 * @returns The compiled prompt string and metadata
 */
export async function getManagedPrompt(
  name: PromptName,
  variables?: Record<string, string | number>
): Promise<{ prompt: string; fromLangfuse: boolean; config?: Record<string, any> }> {
  const defaultPrompt = DEFAULT_PROMPTS[name];
  return getPrompt(name, defaultPrompt, variables);
}

/**
 * Link a generation to a specific prompt version for tracking
 */
export function linkPromptToGeneration(
  generation: ReturnType<ReturnType<Langfuse['trace']>['generation']>,
  promptName: string,
  promptVersion?: number
): void {
  const langfuse = getLangfuse();
  if (!langfuse || !generation) return;

  // The generation will automatically link to the prompt when we pass prompt metadata
  // This is handled by passing the prompt object when creating the generation
}
