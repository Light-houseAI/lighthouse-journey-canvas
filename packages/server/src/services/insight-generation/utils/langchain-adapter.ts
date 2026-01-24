/**
 * LangChain Adapter for Existing LLMProvider
 *
 * Wraps the existing AISDKLLMProvider to be compatible with LangGraph/LangChain.
 * This allows us to use the existing LLM infrastructure while leveraging
 * LangGraph's agent orchestration capabilities.
 */

import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { BaseMessage } from '@langchain/core/messages';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import type { ChatResult, ChatGeneration } from '@langchain/core/outputs';
import type { LLMProvider } from '../../../core/llm-provider.js';
import type { Logger } from '../../../core/logger.js';

// ============================================================================
// ADAPTER
// ============================================================================

export interface LangChainAdapterOptions {
  llmProvider: LLMProvider;
  logger: Logger;
  defaultModel?: string;
  defaultTemperature?: number;
}

/**
 * Adapter that wraps the existing LLMProvider for LangChain compatibility.
 *
 * This allows LangGraph to use our existing LLM infrastructure including:
 * - Langfuse tracing
 * - Token tracking
 * - Model switching (OpenAI/Google)
 */
export class LangChainAdapter extends BaseChatModel {
  private llmProvider: LLMProvider;
  private logger: Logger;
  private defaultModel: string;
  private defaultTemperature: number;

  static lc_name(): string {
    return 'LangChainAdapter';
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return undefined;
  }

  get lc_aliases(): { [key: string]: string } | undefined {
    return undefined;
  }

  constructor(options: LangChainAdapterOptions) {
    super({});
    this.llmProvider = options.llmProvider;
    this.logger = options.logger;
    this.defaultModel = options.defaultModel || 'gpt-4o';
    this.defaultTemperature = options.defaultTemperature || 0.3;
  }

  _llmType(): string {
    return 'langchain-adapter';
  }

  /**
   * Generate a chat response using the wrapped LLMProvider
   */
  async _generate(
    messages: BaseMessage[],
    _options: this['ParsedCallOptions'],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    this.logger.debug('LangChainAdapter generating response', {
      messageCount: messages.length,
    });

    try {
      // Convert LangChain messages to prompt format
      const prompt = this.messagesToPrompt(messages);

      // Use the existing LLM provider
      const response = await this.llmProvider.generateText({
        prompt,
        model: this.defaultModel,
        temperature: this.defaultTemperature,
      });

      // Convert response to LangChain format
      const generation: ChatGeneration = {
        text: response.text,
        message: new AIMessage({
          content: response.text,
        }),
        generationInfo: {
          tokensUsed: response.tokensUsed,
          model: this.defaultModel,
        },
      };

      return {
        generations: [generation],
        llmOutput: {
          tokenUsage: {
            totalTokens: response.tokensUsed,
          },
        },
      };
    } catch (error) {
      this.logger.error('LangChainAdapter generation failed', { error });
      throw error;
    }
  }

  /**
   * Convert LangChain messages to a single prompt string
   */
  private messagesToPrompt(messages: BaseMessage[]): string {
    const parts: string[] = [];

    for (const message of messages) {
      const content =
        typeof message.content === 'string'
          ? message.content
          : JSON.stringify(message.content);

      if (message instanceof SystemMessage) {
        parts.push(`System: ${content}`);
      } else if (message instanceof HumanMessage) {
        parts.push(`User: ${content}`);
      } else if (message instanceof AIMessage) {
        parts.push(`Assistant: ${content}`);
      } else {
        parts.push(content);
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Bind tools to the model (for agent tool use)
   */
  bindTools(tools: any[]): this {
    // Store tools for use in generation
    // Note: The actual LLMProvider handles structured output via Zod schemas
    this.logger.debug('Binding tools to LangChainAdapter', {
      toolCount: tools.length,
    });
    return this;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a LangChain-compatible model from the existing LLMProvider
 */
export function createLangChainModel(
  llmProvider: LLMProvider,
  logger: Logger,
  options?: {
    model?: string;
    temperature?: number;
  }
): LangChainAdapter {
  return new LangChainAdapter({
    llmProvider,
    logger,
    defaultModel: options?.model || 'gpt-4o',
    defaultTemperature: options?.temperature || 0.3,
  });
}

// ============================================================================
// MESSAGE HELPERS
// ============================================================================

/**
 * Create a system message
 */
export function createSystemMessage(content: string): SystemMessage {
  return new SystemMessage({ content });
}

/**
 * Create a human/user message
 */
export function createHumanMessage(content: string): HumanMessage {
  return new HumanMessage({ content });
}

/**
 * Create an AI/assistant message
 */
export function createAIMessage(content: string): AIMessage {
  return new AIMessage({ content });
}

/**
 * Build a conversation from a system prompt and user query
 */
export function buildConversation(
  systemPrompt: string,
  userQuery: string
): BaseMessage[] {
  return [createSystemMessage(systemPrompt), createHumanMessage(userQuery)];
}
