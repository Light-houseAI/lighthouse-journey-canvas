/**
 * PgVector GraphRAG Service Tests
 * 
 * Unit tests for the pgvector-based GraphRAG service layer
 * Tests search orchestration, result formatting, and API contract
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';
import { PgVectorGraphRAGService } from '../pgvector-graphrag.service';
import type { IPgVectorGraphRAGRepository, EmbeddingService, GraphRAGSearchRequest, GraphRAGSearchResponse } from '../types/graphrag.types';
import type { IUserRepository } from '../repositories/interfaces/user.repository.interface';

describe('PgVectorGraphRAGService', () => {
  let service: PgVectorGraphRAGService;
  let mockRepository: MockProxy<IPgVectorGraphRAGRepository>;
  let mockEmbeddingService: MockProxy<EmbeddingService>;
  let mockUsersRepository: MockProxy<IUserRepository>;

  beforeEach(() => {
    // Create typed mocks using vitest-mock-extended
    mockRepository = mock<IPgVectorGraphRAGRepository>();
    mockEmbeddingService = mock<EmbeddingService>();
    mockUsersRepository = mock<IUserRepository>();

    // Mock logger
    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    service = new PgVectorGraphRAGService({
      pgVectorGraphRAGRepository: mockRepository,
      openAIEmbeddingService: mockEmbeddingService,
      llmProvider: null as any, // Mock LLM provider 
      userRepository: mockUsersRepository,
      logger: mockLogger
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockRepository.mockReset();
    mockEmbeddingService.mockReset();
    mockUsersRepository.mockReset();
  });

  describe('searchProfiles', () => {
    test('should return profiles matching search query', async () => {
      const request: GraphRAGSearchRequest = {
        query: 'distributed systems',
        limit: 10,
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
          node_type: 'job',
          meta: { company: 'TechCorp', role: 'Senior Engineer' },
          similarity: 0.95,
          tenant_id: 'default',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockRepository.vectorSearch.mockResolvedValue(mockVectorResults);

      // Mock user data
      mockUsersRepository.findById.mockResolvedValue({
        id: 1,
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe'
      });

      const result = await service.searchProfiles(request);

      expect(result.query).toBe('distributed systems');
      expect(result.profiles).toHaveLength(1);
      expect(result.profiles[0].name).toBe('John Doe');
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalled();
      expect(mockRepository.vectorSearch).toHaveBeenCalled();
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
      expect(result.profiles).toHaveLength(0);
      expect(result.totalResults).toBe(0);
    });

    test('should handle multi-tenant searches', async () => {
      const request: GraphRAGSearchRequest = {
        query: 'frontend developer',
        limit: 5,
        tenantId: 'acme-corp'
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
          tenantId: 'acme-corp'
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

      await expect(service.searchProfiles(request)).rejects.toThrow('OpenAI API error');
    });
  });

  describe('formatProfileResult', () => {
    test('should format profile with user data', async () => {
      const userId = 1;
      const matchedNodes = [
        {
          id: 'node-1',
          type: 'job',
          meta: { company: 'TechCorp', role: 'Engineer' },
          score: 0.9,
          insights: []
        }
      ];
      const matchScore = 85.5;
      const whyMatched = ['Software engineering experience', 'Tech industry background'];
      const skills = ['JavaScript', 'React', 'Node.js'];

      mockUsersRepository.findById.mockResolvedValue({
        id: 1,
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe'
      });

      const result = await service.formatProfileResult(
        userId,
        matchedNodes,
        matchScore,
        whyMatched,
        skills
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
      const matchedNodes = [];
      const matchScore = 50.0;
      const whyMatched = [];
      const skills = [];

      mockUsersRepository.findById.mockResolvedValue(null);

      await expect(service.formatProfileResult(
        userId,
        matchedNodes,
        matchScore,
        whyMatched,
        skills
      )).rejects.toThrow('User 999 not found');
    });
  });
});