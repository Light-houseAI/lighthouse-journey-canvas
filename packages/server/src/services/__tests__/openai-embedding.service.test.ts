import OpenAI from 'openai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

import type { Logger } from '../../core/logger';
import { OpenAIEmbeddingService } from '../openai-embedding.service';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn(),
  };
});

describe('OpenAIEmbeddingService', () => {
  const mockLogger = mockDeep<Logger>();
  const mockOpenAI = mockDeep<OpenAI>();

  let openAIEmbeddingService: OpenAIEmbeddingService;

  beforeEach(() => {
    mockReset(mockLogger);
    mockReset(mockOpenAI);

    // Set up environment variable
    process.env.OPENAI_API_KEY = 'test-api-key';

    // Mock the OpenAI constructor
    (OpenAI as any).mockImplementation(() => mockOpenAI);

    openAIEmbeddingService = new OpenAIEmbeddingService({ logger: mockLogger });
  });

  describe('generateEmbedding', () => {
    it('should successfully generate embedding for text', async () => {
      // Arrange
      const inputText = 'This is a test text for embedding';
      const mockEmbedding = new Array(1536).fill(0.1); // Mock 1536-dimensional embedding
      const mockResponse = {
        data: [{ embedding: mockEmbedding }],
      };

      mockOpenAI.embeddings = {
        create: vi.fn().mockResolvedValue(mockResponse),
      } as any;

      // Act
      const result = await openAIEmbeddingService.generateEmbedding(inputText);

      // Assert
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(1536);
      // Check first few values instead of exact equality due to Float32Array precision
      expect(result[0]).toBeCloseTo(0.1, 5);
      expect(result[100]).toBeCloseTo(0.1, 5);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: inputText,
        dimensions: 1536,
      });
    });

    it('should handle API errors and log them', async () => {
      // Arrange
      const inputText = 'Test text for error scenario';
      const apiError = new Error('API rate limit exceeded');

      mockOpenAI.embeddings = {
        create: vi.fn().mockRejectedValue(apiError),
      } as any;

      // Act & Assert
      await expect(
        openAIEmbeddingService.generateEmbedding(inputText)
      ).rejects.toThrow('Embedding generation failed: API rate limit exceeded');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to generate embedding',
        expect.objectContaining({ error: apiError })
      );
    });
  });
});
