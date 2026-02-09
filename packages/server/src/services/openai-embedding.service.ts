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

  // In-memory cache for query embeddings (same query text → same embedding)
  // Avoids redundant OpenAI API calls when the same text is embedded multiple
  // times across NLQ, GraphRAG, and session search within a short window.
  private static embeddingCache = new Map<string, { embedding: Float32Array; expiry: number }>();
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
   * Generate embedding for a single text (with caching)
   */
  async generateEmbedding(text: string): Promise<Float32Array> {
    // Check cache first
    const cached = OpenAIEmbeddingService.embeddingCache.get(text);
    if (cached && cached.expiry > Date.now()) {
      return cached.embedding;
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text,
        dimensions: this.dimensions,
      });

      const embedding = new Float32Array(response.data[0].embedding);

      // Cache the result
      OpenAIEmbeddingService.embeddingCache.set(text, {
        embedding,
        expiry: Date.now() + OpenAIEmbeddingService.CACHE_TTL_MS,
      });

      // Evict expired entries periodically (every 100 cache sets)
      if (OpenAIEmbeddingService.embeddingCache.size % 100 === 0) {
        const now = Date.now();
        for (const [key, val] of OpenAIEmbeddingService.embeddingCache) {
          if (val.expiry <= now) OpenAIEmbeddingService.embeddingCache.delete(key);
        }
      }

      return embedding;
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
      this.trackEmbeddingGeneration(texts, embeddings, startTime, response.usage);

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
   * Includes full input texts and output embedding info for observability
   */
  private trackEmbeddingGeneration(
    texts: string[],
    embeddings: Float32Array[],
    startTime: number,
    usage?: { prompt_tokens: number; total_tokens: number }
  ): void {
    const langfuse = getLangfuse();
    if (!langfuse) return;

    try {
      // Prepare input - show text previews for observability
      const inputData = {
        textCount: texts.length,
        texts: texts.map((t, i) => ({
          index: i,
          preview: t.substring(0, 200) + (t.length > 200 ? '...' : ''),
          length: t.length,
        })),
      };

      // Prepare output - show embedding dimensions (not the actual vectors)
      const outputData = {
        embeddingCount: embeddings.length,
        dimensions: this.dimensions,
        model: this.model,
      };

      const trace = langfuse.trace({
        name: 'embedding-generation',
        input: inputData,
        output: outputData,
        metadata: {
          model: this.model,
          dimensions: this.dimensions,
          textCount: texts.length,
        },
        tags: ['embedding', 'openai'],
      });

      trace.generation({
        name: 'openai-embedding',
        model: this.model,
        input: inputData,
        output: outputData,
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
