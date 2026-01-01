import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { generateObject, generateText, LanguageModel, streamText } from 'ai';
import { z } from 'zod';

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
}

export interface LLMProvider {
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

  constructor(config: LLMConfig) {
    this.defaultTemperature = config.temperature ?? 0.7;
    this.defaultMaxTokens = config.maxTokens ?? 2000;

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

  async generateText(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: { temperature?: number; maxTokens?: number } = {}
  ): Promise<LLMResponse<string>> {
    try {
      const result = await generateText({
        model: this.model,
        messages,
        temperature: options.temperature ?? this.defaultTemperature,
        maxOutputTokens: options.maxTokens ?? this.defaultMaxTokens,
      });

      return {
        content: result.text,
        usage: result.usage
          ? {
              promptTokens: result.usage.inputTokens || 0,
              completionTokens: result.usage.outputTokens || 0,
              totalTokens: result.usage.totalTokens || 0,
            }
          : undefined,
      };
    } catch (error) {
      throw new Error(`LLM generation failed: ${error}`);
    }
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
    try {
      const result = await generateObject({
        model: this.model,
        schema,
        messages,
        temperature: options.temperature ?? this.defaultTemperature,
        maxOutputTokens: options.maxTokens ?? this.defaultMaxTokens,
        experimental_repairText: options.experimental_repairText,
      } as any);

      return {
        content: result.object as T,
        usage: result.usage
          ? {
              promptTokens: result.usage.inputTokens || 0,
              completionTokens: result.usage.outputTokens || 0,
              totalTokens: result.usage.totalTokens || 0,
            }
          : undefined,
      };
    } catch (error) {
      throw new Error(`Structured LLM generation failed: ${error}`);
    }
  }

  async *streamText(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: { temperature?: number; maxTokens?: number } = {}
  ): AsyncIterable<string> {
    try {
      const { textStream } = await streamText({
        model: this.model,
        messages,
        temperature: options.temperature ?? this.defaultTemperature,
        maxOutputTokens: options.maxTokens ?? this.defaultMaxTokens,
      });

      for await (const chunk of textStream) {
        yield chunk;
      }
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
      model: process.env.GOOGLE_MODEL || 'gemini-2.0-flash-exp',
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.3'),
      maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '4000'),
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
