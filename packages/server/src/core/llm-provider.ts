import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { generateObject, generateText, LanguageModel, streamText } from 'ai';
import { z } from 'zod';
import { getLangfuse } from './langfuse.js';
import { withRetry, isRateLimitError, extractRetryAfter, type RetryOptions } from './retry-utils.js';

export interface LLMConfig {
  provider: 'openai' | 'google' | 'custom';
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse<T = string> {
  content: T;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Reason the model stopped generating. 'length' indicates truncation. */
  finishReason?: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' | 'unknown';
}

export interface LLMProvider {
  /**
   * Simple completion interface for services that expect a string prompt
   * This is a convenience wrapper around generateText
   */
  complete(
    prompt: string,
    options?: { model?: string; responseFormat?: string }
  ): Promise<string>;

  generateText(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse<string>>;

  generateStructuredResponse<T>(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    schema: z.ZodSchema<T>,
    options?: {
      temperature?: number;
      maxTokens?: number;
      experimental_repairText?: (params: {
        text: string;
        error: any;
      }) => Promise<string>;
    }
  ): Promise<LLMResponse<T>>;

  streamText(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { temperature?: number; maxTokens?: number }
  ): AsyncIterable<string>;
}

export class AISDKLLMProvider implements LLMProvider {
  private model: LanguageModel | any; // Allow v2 and v3 models
  private defaultTemperature: number;
  private defaultMaxTokens: number;
  private providerName: string;
  private modelName: string;
  private retryOptions: RetryOptions;

  constructor(config: LLMConfig) {
    this.defaultTemperature = config.temperature ?? 0.7;
    this.defaultMaxTokens = config.maxTokens ?? 8000; // Increased to prevent truncation with Gemini 3
    this.providerName = config.provider;
    this.modelName = config.model;

    // Configure retry options based on provider
    this.retryOptions = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitter: true,
      onRetry: (error, attempt, delayMs) => {
        console.warn(`[LLM] Retry attempt ${attempt} for ${this.providerName}/${this.modelName} after ${delayMs}ms`, {
          error: error?.message || String(error),
          isRateLimit: isRateLimitError(error),
          suggestedDelay: extractRetryAfter(error),
        });
      },
    };

    // Initialize model based on provider
    switch (config.provider) {
      case 'openai':
        this.model = openai(config.model);
        break;

      case 'google':
        this.model = google(config.model);
        break;

      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
  }

  /**
   * Track an LLM generation with Langfuse
   * Uses full input/output (not summarized) for complete observability
   */
  private trackGeneration(
    name: string,
    input: any,
    startTime: number,
    output: any,
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number },
    metadata?: Record<string, any>
  ): void {
    const langfuse = getLangfuse();
    if (!langfuse) return;

    try {
      // Create trace with full input/output for complete observability
      const trace = langfuse.trace({
        name,
        input,
        output,
        metadata: {
          provider: this.providerName,
          model: this.modelName,
          ...metadata,
        },
      });

      // Also create generation with full details
      trace.generation({
        name: `${name}-generation`,
        model: this.modelName,
        modelParameters: {
          temperature: this.defaultTemperature,
          maxTokens: this.defaultMaxTokens,
        },
        input,
        output,
        usage: usage
          ? {
              input: usage.promptTokens,
              output: usage.completionTokens,
              total: usage.totalTokens,
            }
          : undefined,
        metadata: {
          durationMs: Date.now() - startTime,
        },
      });
    } catch (error) {
      // Don't let Langfuse errors affect the main flow
      console.warn('[Langfuse] Failed to track generation:', error);
    }
  }

  /**
   * Simple completion interface for services expecting a string prompt
   * This wraps generateText for backward compatibility with services
   */
  async complete(
    prompt: string,
    options?: { model?: string; responseFormat?: string }
  ): Promise<string> {
    const result = await this.generateText(
      [{ role: 'user', content: prompt }],
      { temperature: this.defaultTemperature, maxTokens: this.defaultMaxTokens }
    );
    return result.content;
  }

  async generateText(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: { temperature?: number; maxTokens?: number } = {}
  ): Promise<LLMResponse<string>> {
    const startTime = Date.now();

    // Use retry wrapper for resilience against rate limits and transient errors
    return withRetry(
      async () => {
        const result = await generateText({
          model: this.model,
          messages,
          temperature: options.temperature ?? this.defaultTemperature,
          maxOutputTokens: options.maxTokens ?? this.defaultMaxTokens,
        });

        const usage = result.usage
          ? {
              promptTokens: result.usage.inputTokens || 0,
              completionTokens: result.usage.outputTokens || 0,
              totalTokens: result.usage.totalTokens || 0,
            }
          : undefined;

        // Track with Langfuse
        this.trackGeneration('generateText', messages, startTime, result.text, usage);

        return {
          content: result.text,
          usage,
          finishReason: result.finishReason as LLMResponse['finishReason'],
        };
      },
      this.retryOptions
    ).catch((error) => {
      throw new Error(`LLM generation failed after retries: ${error}`);
    });
  }

  async generateStructuredResponse<T>(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    schema: z.ZodSchema<T>,
    options: {
      temperature?: number;
      maxTokens?: number;
      experimental_repairText?: (params: {
        text: string;
        error: any;
      }) => Promise<string>;
    } = {}
  ): Promise<LLMResponse<T>> {
    const startTime = Date.now();

    // Default repair function to handle common JSON issues from LLMs
    const defaultRepairText = async ({ text, error }: { text: string; error: any }): Promise<string> => {
      // Log the repair attempt for debugging
      console.log('Attempting to repair LLM response', {
        textLength: text.length,
        error: error?.message || String(error),
      });

      // Try to extract JSON from markdown code blocks
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        return jsonMatch[1].trim();
      }

      // Find the start of JSON (first { or [ character)
      const jsonStartBrace = text.indexOf('{');
      const jsonStartBracket = text.indexOf('[');
      let jsonStart = -1;
      if (jsonStartBrace >= 0 && jsonStartBracket >= 0) {
        jsonStart = Math.min(jsonStartBrace, jsonStartBracket);
      } else if (jsonStartBrace >= 0) {
        jsonStart = jsonStartBrace;
      } else if (jsonStartBracket >= 0) {
        jsonStart = jsonStartBracket;
      }

      if (jsonStart === -1) {
        return text;
      }

      // Extract from the first { or [ to the end of the text
      let json = text.slice(jsonStart);

      // Remove trailing garbage characters (non-JSON characters after the last } or ])
      // This handles cases like `},\n.\n` where there's a stray `.` character
      const lastBrace = json.lastIndexOf('}');
      const lastBracket = json.lastIndexOf(']');
      const lastValidChar = Math.max(lastBrace, lastBracket);
      if (lastValidChar > 0) {
        // Check if there's garbage after the last valid JSON character
        const afterLastValid = json.slice(lastValidChar + 1).trim();
        if (afterLastValid && !/^[,\s]*$/.test(afterLastValid)) {
          // There's non-whitespace/comma garbage after the last brace/bracket
          json = json.slice(0, lastValidChar + 1);
        }
      }

      // Remove trailing commas before closing braces/brackets (common LLM error)
      json = json.replace(/,\s*([\]}])/g, '$1');

      // Count brackets to determine what needs closing
      const openBrackets = (json.match(/\[/g) || []).length;
      const closeBrackets = (json.match(/\]/g) || []).length;
      const openBraces = (json.match(/\{/g) || []).length;
      const closeBraces = (json.match(/\}/g) || []).length;

      // Check if we're in the middle of a string value (unclosed quote)
      const quoteCount = (json.match(/"/g) || []).length;
      if (quoteCount % 2 !== 0) {
        // Odd number of quotes - close the string
        json += '"';
      }

      // If there's an incomplete property (like `"foo": ` with no value), add empty string
      if (/:\s*$/.test(json.trim())) {
        json = json.trim() + '""';
      }

      // Close unclosed arrays first (inner structures)
      if (openBrackets > closeBrackets) {
        json += ']'.repeat(openBrackets - closeBrackets);
      }

      // Close unclosed objects (outer structures)
      if (openBraces > closeBraces) {
        json += '}'.repeat(openBraces - closeBraces);
      }

      return json;
    };

    // Use retry wrapper for resilience against rate limits and transient errors
    return withRetry(
      async () => {
        const result = await generateObject({
          model: this.model,
          schema,
          messages,
          temperature: options.temperature ?? this.defaultTemperature,
          maxOutputTokens: options.maxTokens ?? this.defaultMaxTokens,
          experimental_repairText: options.experimental_repairText ?? defaultRepairText,
        } as any);

        const usage = result.usage
          ? {
              promptTokens: result.usage.inputTokens || 0,
              completionTokens: result.usage.outputTokens || 0,
              totalTokens: result.usage.totalTokens || 0,
            }
          : undefined;

        // Track with Langfuse
        this.trackGeneration(
          'generateStructuredResponse',
          messages,
          startTime,
          result.object,
          usage,
          { schemaName: schema.description || 'structured-output' }
        );

        return {
          content: result.object as T,
          usage,
        };
      },
      this.retryOptions
    ).catch((error) => {
      throw new Error(`Structured LLM generation failed: ${error}`);
    });
  }

  async *streamText(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: { temperature?: number; maxTokens?: number } = {}
  ): AsyncIterable<string> {
    const startTime = Date.now();
    const chunks: string[] = [];
    try {
      const { textStream } = await streamText({
        model: this.model,
        messages,
        temperature: options.temperature ?? this.defaultTemperature,
        maxOutputTokens: options.maxTokens ?? this.defaultMaxTokens,
      });

      for await (const chunk of textStream) {
        chunks.push(chunk);
        yield chunk;
      }

      // Track streaming completion with Langfuse
      this.trackGeneration(
        'streamText',
        messages,
        startTime,
        chunks.join(''),
        undefined,
        { streaming: true }
      );
    } catch (error) {
      throw new Error(`LLM streaming failed: ${error}`);
    }
  }
}

// Factory function for creating LLM providers
export function createLLMProvider(config: LLMConfig): LLMProvider {
  return new AISDKLLMProvider(config);
}

// Configuration helper
export function getLLMConfig(): LLMConfig {
  const provider = (process.env.LLM_PROVIDER as 'openai' | 'google') || 'openai';

  const configs: Record<string, LLMConfig> = {
    openai: {
      provider: 'openai' as const,
      apiKey: process.env.OPENAI_API_KEY!,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.1'),
      maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '2000'),
    },
    google: {
      provider: 'google' as const,
      apiKey: process.env.GOOGLE_API_KEY!,
      model: process.env.GOOGLE_MODEL || 'gemini-2.5-flash',
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.3'),
      maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '8000'), // Increased from 4000 to prevent truncation
    },
  };

  const config = configs[provider];

  if (!config) {
    throw new Error(`Unsupported LLM provider: ${provider}`);
  }

  if (!config.apiKey) {
    throw new Error(
      `API key not found for ${provider}. Please set ${provider.toUpperCase()}_API_KEY environment variable.`
    );
  }

  return config;
}
