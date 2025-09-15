/**
 * OpenAI Service Mocks using Vitest vi.mock()
 *
 * This follows best practices from the testing community:
 * - Uses vi.mock() for proper module mocking
 * - Provides deterministic mock responses
 * - Avoids environment detection anti-patterns
 * - Enables test isolation and control
 */

import { vi } from 'vitest';

// Mock the OpenAI embedding service module
vi.mock('../../services/openai-embedding.service.ts', () => {
  return {
    OpenAIEmbeddingService: vi.fn().mockImplementation(() => ({
      generateEmbedding: vi.fn().mockResolvedValue(
        new Float32Array(1536).fill(0.1) // Deterministic mock embedding
      ),
      generateEmbeddings: vi
        .fn()
        .mockImplementation((texts: string[]) =>
          Promise.resolve(texts.map(() => new Float32Array(1536).fill(0.1)))
        ),
    })),
    MockEmbeddingService: vi.fn().mockImplementation(() => ({
      generateEmbedding: vi
        .fn()
        .mockResolvedValue(new Float32Array(1536).fill(0.1)),
      generateEmbeddings: vi
        .fn()
        .mockImplementation((texts: string[]) =>
          Promise.resolve(texts.map(() => new Float32Array(1536).fill(0.1)))
        ),
      getCallCount: vi.fn().mockReturnValue(0),
      reset: vi.fn(),
    })),
  };
});

// Mock the LLM provider module
vi.mock('../../core/llm-provider.ts', () => {
  const mockLLMProvider = {
    generateText: vi.fn().mockResolvedValue({
      content: 'Mock LLM response',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    }),
    generateStructuredResponse: vi.fn().mockResolvedValue({
      content: { mockData: 'Mock structured response' },
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    }),
    streamText: vi.fn().mockImplementation(async function* () {
      yield 'Mock';
      yield ' streaming';
      yield ' response';
    }),
  };

  return {
    AISDKLLMProvider: vi.fn().mockImplementation(() => mockLLMProvider),
    createLLMProvider: vi.fn().mockReturnValue(mockLLMProvider),
    getLLMConfig: vi.fn().mockReturnValue({
      provider: 'openai',
      apiKey: 'mock-api-key',
      model: 'gpt-4o-mini',
      temperature: 0.1,
      maxTokens: 2000,
    }),
  };
});

// Mock the OpenAI package itself for lower-level mocking if needed
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      embeddings: {
        create: vi.fn().mockResolvedValue({
          data: [{ embedding: new Array(1536).fill(0.1) }],
        }),
      },
    })),
  };
});

// Mock the @ai-sdk/openai package
vi.mock('@ai-sdk/openai', () => {
  return {
    openai: vi.fn().mockImplementation(() => ({
      // Mock language model implementation
      name: 'mock-openai-model',
      provider: 'mock-openai',
    })),
  };
});

// Mock the 'ai' package functions
vi.mock('ai', () => {
  return {
    generateText: vi.fn().mockResolvedValue({
      text: 'Mock generated text',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    }),
    generateObject: vi.fn().mockResolvedValue({
      object: { mockData: 'Mock structured response' },
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    }),
    streamText: vi.fn().mockResolvedValue({
      textStream: (async function* () {
        yield 'Mock';
        yield ' streaming';
        yield ' response';
      })(),
    }),
  };
});

export {};
