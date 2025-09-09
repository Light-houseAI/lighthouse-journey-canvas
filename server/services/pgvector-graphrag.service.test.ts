/**
 * PgVector GraphRAG Service Tests
 * 
 * Unit tests for the pgvector-based GraphRAG service layer
 * Tests search orchestration, result formatting, and API contract
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { PgVectorGraphRAGService } from './pgvector-graphrag.service';
import type { PgVectorGraphRAGRepository } from '../repositories/pgvector-graphrag.repository';
import type { GraphRAGSearchRequest, GraphRAGSearchResponse } from '../types/graphrag.types';

describe('PgVectorGraphRAGService', () => {
  let service: PgVectorGraphRAGService;
  let mockRepository: any;
  let mockEmbeddingService: any;
  let mockUsersRepository: any;

  beforeEach(() => {
    // Mock repository
    mockRepository = {
      vectorSearch: vi.fn(),
      graphExpansion: vi.fn(),
      combinedScoring: vi.fn(),
      getChunksByNodeId: vi.fn(),
      getChunksByUserId: vi.fn(),
      createChunk: vi.fn(),
      createEdge: vi.fn(),
    };

    // Mock embedding service
    mockEmbeddingService = {
      generateEmbedding: vi.fn(),
    };

    // Mock users repository
    mockUsersRepository = {
      findById: vi.fn(),
      getUserById: vi.fn(),
    };

    // Mock logger
    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    service = new PgVectorGraphRAGService(
      mockRepository,
      mockEmbeddingService,
      mockUsersRepository,
      mockLogger
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
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

      // Mock graph expansion
      const mockExpandedResults = [
        {
          chunk_id: 'chunk-1',
          best_seed_sim: 0.95,
          best_path_w: 1.0,
          graph_aware_score: 0.95,
        }
      ];

      mockRepository.graphExpansion.mockResolvedValue(mockExpandedResults);

      // Mock combined scoring
      const mockScoredResults = [
        {
          id: 'chunk-1',
          user_id: 1,
          node_id: 'node-1',
          chunk_text: 'Software engineer with distributed systems experience',
          node_type: 'job',
          meta: { company: 'TechCorp', role: 'Senior Engineer' },
          final_score: 0.90,
          tenant_id: 'default',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      mockRepository.combinedScoring.mockResolvedValue(mockScoredResults);

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
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('distributed systems');
      expect(mockRepository.vectorSearch).toHaveBeenCalled();
      expect(mockRepository.graphExpansion).toHaveBeenCalled();
      expect(mockRepository.combinedScoring).toHaveBeenCalled();
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