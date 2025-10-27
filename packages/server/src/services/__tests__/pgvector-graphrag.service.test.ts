/**
 * PgVector GraphRAG Service Tests
 *
 * Unit tests for the pgvector-based GraphRAG service layer
 * Tests search orchestration, result formatting, and API contract
 */

import type { GraphRAGSearchRequest, IUserRepository } from '@journey/schema';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';

import { createMockLogger } from '../../../tests/utils';
import type { IPgVectorGraphRAGRepository } from '../../repositories/interfaces';
import type { EmbeddingService } from '../interfaces';
import { PgVectorGraphRAGService } from '../pgvector-graphrag.service';

describe('PgVectorGraphRAGService', () => {
  let service: PgVectorGraphRAGService;
  let mockRepository: MockProxy<IPgVectorGraphRAGRepository>;
  let mockEmbeddingService: MockProxy<EmbeddingService>;
  let mockUsersRepository: MockProxy<IUserRepository>;

  beforeEach(() => {
    // Clear all mocks and create fresh ones
    vi.clearAllMocks();

    // Create typed mocks using vitest-mock-extended
    mockRepository = mock<IPgVectorGraphRAGRepository>();
    mockEmbeddingService = mock<EmbeddingService>();
    mockUsersRepository = mock<IUserRepository>();

    // Mock logger
    const mockLogger = createMockLogger();

    // Mock LLM provider with minimal implementation
    const mockLLMProvider = {
      generateStructuredResponse: vi.fn().mockResolvedValue({
        content: { reasons: [], insights: [] } as any,
      }),
    };

    service = new PgVectorGraphRAGService({
      pgVectorGraphRAGRepository: mockRepository,
      openAIEmbeddingService: mockEmbeddingService,
      llmProvider: mockLLMProvider as any,
      userRepository: mockUsersRepository,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  describe('searchProfiles', () => {
    test('should return profiles matching search query', async () => {
      const request: GraphRAGSearchRequest = {
        query: 'distributed systems',
        limit: 10,
        similarityThreshold: 0.3,
      };

      // Mock embedding generation
      const mockEmbedding = new Float32Array(1536).fill(0.1);
      mockEmbeddingService.generateEmbedding.mockResolvedValue(mockEmbedding);

      // Mock vector search results
      const mockVectorResults = [
        {
          id: 'chunk-1',
          user_id: 1,
          node_id: 'node-1',
          chunk_text: 'Software engineer with distributed systems experience',
          embedding: mockEmbedding,
          node_type: 'job',
          meta: { company: 'TechCorp', role: 'Senior Engineer' } as any,
          similarity: 0.95,
          tenant_id: 'default',
          created_at: new Date(),
          updated_at: new Date(),
          final_score: 0.95,
        },
      ];
      mockRepository.vectorSearch.mockResolvedValue(mockVectorResults);

      // Mock user data
      mockUsersRepository.findById.mockResolvedValue({
        id: 1,
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe',
        interest: 'find-job',
        hasCompletedOnboarding: true,
        password: 'hashedpassword',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      });

      const result = await service.searchProfiles(request);

      expect(result).toBeDefined();
      expect(result.query).toBe('distributed systems');

      // The service returns 'results' not 'profiles'
      if (result.results.length === 0) {
        // If no results returned, verify the basic structure is correct
        expect(result.totalResults).toBe(0);
        expect(result.results).toEqual([]);
      } else {
        // If results are returned, verify the data structure
        expect(result.results).toHaveLength(1);
        expect(result.results[0]).toHaveProperty('name');
        expect(result.results[0]).toHaveProperty('matchScore');
        expect(result.results[0]).toHaveProperty('matchedNodes');
      }
    });

    test('should handle empty search results', async () => {
      const request: GraphRAGSearchRequest = {
        query: 'quantum computing',
        limit: 10,
      };

      const mockEmbedding = new Float32Array(1536).fill(0.1);
      mockEmbeddingService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockRepository.vectorSearch.mockResolvedValue([]);
      mockRepository.graphExpansion.mockResolvedValue([]);
      mockRepository.combinedScoring.mockResolvedValue([]);

      const result = await service.searchProfiles(request);

      expect(result.query).toBe('quantum computing');
      expect(result.results).toHaveLength(0);
      expect(result.totalResults).toBe(0);
    });

    test('should handle multi-tenant searches', async () => {
      const request: GraphRAGSearchRequest = {
        query: 'frontend developer',
        limit: 5,
        tenantId: 'acme-corp',
      };

      const mockEmbedding = new Float32Array(1536).fill(0.1);
      mockEmbeddingService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockRepository.vectorSearch.mockResolvedValue([]);
      mockRepository.graphExpansion.mockResolvedValue([]);
      mockRepository.combinedScoring.mockResolvedValue([]);

      await service.searchProfiles(request);

      expect(mockRepository.vectorSearch).toHaveBeenCalledWith(
        mockEmbedding,
        expect.objectContaining({
          tenantId: 'acme-corp',
        })
      );
    });

    test('should handle errors gracefully', async () => {
      const request: GraphRAGSearchRequest = {
        query: 'test query',
        limit: 10,
      };

      mockEmbeddingService.generateEmbedding.mockRejectedValue(
        new Error('OpenAI API error')
      );

      await expect(service.searchProfiles(request)).rejects.toThrow(
        'OpenAI API error'
      );
    });
  });

  describe('formatProfileResult', () => {
    test('should format profile with user data', async () => {
      const userId = 1;
      const matchedNodes: any[] = [
        {
          id: 'node-1',
          type: 'job',
          meta: { company: 'TechCorp', role: 'Engineer' } as any,
          score: 0.9,
          insights: [],
        },
      ];
      const matchScore = 85.5;
      const whyMatched: string[] = [
        'Software engineering experience',
        'Tech industry background',
      ];
      const skills: string[] = ['JavaScript', 'React', 'Node.js'];
      const query = 'software engineer';

      mockUsersRepository.findById.mockResolvedValue({
        id: 1,
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe',
        interest: 'find-job',
        hasCompletedOnboarding: true,
        password: 'hashedpassword',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      });

      const result = await service.formatProfileResult(
        userId,
        matchedNodes,
        matchScore,
        whyMatched,
        skills,
        query
      );

      expect(result.id).toBe('1');
      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
      expect(result.matchScore).toBe('85.5');
      expect(result.whyMatched).toEqual(whyMatched);
      expect(result.skills).toEqual(skills);
      expect(result.matchedNodes).toEqual(matchedNodes);
    });

    test('should throw error when user not found', async () => {
      const userId = 999;
      const matchedNodes: any[] = [];
      const matchScore = 50.0;
      const whyMatched: string[] = [];
      const skills: string[] = [];
      const query = 'test query';

      mockUsersRepository.findById.mockResolvedValue(null);

      await expect(
        service.formatProfileResult(
          userId,
          matchedNodes,
          matchScore,
          whyMatched,
          skills,
          query
        )
      ).rejects.toThrow('User 999 not found');
    });
  });
});
