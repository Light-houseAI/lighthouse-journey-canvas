/**
 * OpenAI Embedding Service
 *
 * Generates embeddings using OpenAI's text-embedding-3-small model
 */

import OpenAI from 'openai';

import type { Logger } from '../core/logger.js';
import type { EmbeddingService } from './interfaces';
import { getLangfuse } from '../core/langfuse.js';

export class OpenAIEmbeddingService implements EmbeddingService {
  private openai: OpenAI;
  private model = 'text-embedding-3-small';
  private dimensions = 1536;
  private logger?: Logger;

  constructor({ logger }: { logger?: Logger } = {}) {
    this.logger = logger;

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000, // 30 second timeout for Render compatibility
      maxRetries: 2,
    });
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<Float32Array> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text,
        dimensions: this.dimensions,
      });

      const embedding = response.data[0].embedding;
      return new Float32Array(embedding);
    } catch (error) {
      this.logger?.error(
        'Failed to generate embedding',
        Object.assign(new Error('Failed to generate embedding'), { error })
      );
      throw new Error(
        `Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    const startTime = Date.now();
    try {
      // OpenAI API supports batch embedding
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: texts,
        dimensions: this.dimensions,
      });

      const embeddings = response.data.map((item) => new Float32Array(item.embedding));

      // Track embedding generation with Langfuse
      this.trackEmbeddingGeneration(texts.length, startTime, response.usage);

      return embeddings;
    } catch (error) {
      this.logger?.error(
        'Failed to generate batch embeddings',
        Object.assign(new Error('Failed to generate batch embeddings'), {
          error,
        })
      );
      throw new Error(
        `Batch embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Track embedding generation with Langfuse
   */
  private trackEmbeddingGeneration(
    textCount: number,
    startTime: number,
    usage?: { prompt_tokens: number; total_tokens: number }
  ): void {
    const langfuse = getLangfuse();
    if (!langfuse) return;

    try {
      const trace = langfuse.trace({
        name: 'embedding-generation',
        metadata: {
          model: this.model,
          dimensions: this.dimensions,
          textCount,
        },
        tags: ['embedding', 'openai'],
      });

      trace.generation({
        name: 'openai-embedding',
        model: this.model,
        input: { textCount },
        output: { dimensions: this.dimensions },
        usage: usage
          ? {
              input: usage.prompt_tokens,
              total: usage.total_tokens,
            }
          : undefined,
        metadata: {
          durationMs: Date.now() - startTime,
        },
      });
    } catch (error) {
      // Don't let Langfuse errors affect the main flow
      console.warn('[Langfuse] Failed to track embedding generation:', error);
    }
  }
}

/**
 * Mock Embedding Service for testing
 */
export class MockEmbeddingService implements EmbeddingService {
  private callCount = 0;

  async generateEmbedding(text: string): Promise<Float32Array> {
    this.callCount++;
    // Generate deterministic mock embedding based on text
    const embedding = new Float32Array(1536);
    const hash = text
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    for (let i = 0; i < 1536; i++) {
      embedding[i] = Math.sin(hash + i) * 0.5 + 0.5; // Values between 0 and 1
    }
    return embedding;
  }

  async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    return Promise.all(texts.map((text) => this.generateEmbedding(text)));
  }

  getCallCount(): number {
    return this.callCount;
  }

  reset(): void {
    this.callCount = 0;
  }
}
