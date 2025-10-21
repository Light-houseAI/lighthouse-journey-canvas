/**
 * PgVector GraphRAG Repository Tests
 *
 * Unit tests for the pgvector-based GraphRAG repository layer
 * Tests vector search, graph expansion, and combined scoring
 */

import type { GraphRAGSearchOptions } from '@journey/schema';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { PgVectorGraphRAGRepository } from '../pgvector-graphrag.repository.js';

describe('PgVectorGraphRAGRepository', () => {
  let repository: PgVectorGraphRAGRepository;
  let mockPool: any;
  let mockDb: any;

  beforeEach(() => {
    // Mock database pool
    mockPool = {
      query: vi.fn(),
      end: vi.fn(),
    };

    // Mock Drizzle database
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      execute: vi.fn(),
    };

    repository = new PgVectorGraphRAGRepository(mockPool, mockDb);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('vectorSearch', () => {
    test('should find chunks by vector similarity', async () => {
      const embedding = new Float32Array(1536).fill(0.1);
      const options: GraphRAGSearchOptions = {
        limit: 10,
        tenantId: 'default',
      };

      const mockChunks = [
        {
          id: '1',
          user_id: 1,
          node_id: 'node-1',
          chunk_text: 'Software engineer with distributed systems experience',
          embedding: '[0.1, 0.2, ...]',
          node_type: 'job',
          meta: { company: 'TechCorp' } as any,
          similarity: 0.95,
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockChunks } as any);

      const result = await repository.vectorSearch(embedding, options);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.any(Array)
      );
      expect(result).toHaveLength(1);
      expect(result[0].similarity).toBe(0.95);
    });

    test('should filter by tenant_id', async () => {
      const embedding = new Float32Array(1536);
      const options: GraphRAGSearchOptions = {
        limit: 5,
        tenantId: 'acme-corp',
      };

      mockPool.query.mockResolvedValue({ rows: [] } as any);

      await repository.vectorSearch(embedding, options);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('tenant_id = $2'),
        expect.any(Array)
      );
    });

    test('should handle empty results', async () => {
      const embedding = new Float32Array(1536);
      mockPool.query.mockResolvedValue({ rows: [] } as any);

      const result = await repository.vectorSearch(embedding, {
        limit: 10,
      } as any);

      expect(result).toEqual([]);
    });

    test('should apply recency filter when provided', async () => {
      const embedding = new Float32Array(1536);
      const since = new Date('2024-01-01');
      const options: GraphRAGSearchOptions = {
        limit: 10,
        since,
      };

      mockPool.query.mockResolvedValue({ rows: [] } as any);

      await repository.vectorSearch(embedding, options);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('updated_at >= $3'),
        expect.any(Array)
      );
    });

    test('should apply permission filtering when requestingUserId provided', async () => {
      const embedding = new Float32Array(1536).fill(0.1);
      const options: GraphRAGSearchOptions = {
        limit: 10,
        tenantId: 'default',
        requestingUserId: 5, // Key addition - permission filtering
      };

      const mockChunks = [
        {
          id: '1',
          user_id: 5,
          node_id: 'allowed-node-1',
          chunk_text: 'Authorized content',
          embedding: '[0.1, 0.2, ...]',
          node_type: 'job',
          meta: { company: 'AllowedCorp' },
          similarity: 0.95,
        },
        {
          id: '2',
          user_id: 3,
          node_id: 'shared-node',
          chunk_text: 'Shared authorized content',
          embedding: '[0.2, 0.3, ...]',
          node_type: 'project',
          meta: { title: 'Shared Project' },
          similarity: 0.87,
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockChunks });

      const result = await repository.vectorSearch(embedding, options);

      // Verify permission CTE was used in query
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WITH subject_keys AS'),
        expect.any(Array)
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'LEFT JOIN authorized_nodes an ON an.node_id = gc.node_id'
        ),
        expect.any(Array)
      );
      expect(result).toHaveLength(2);
    });

    test('should include user own chunks and null node_id chunks with permission filtering', async () => {
      const embedding = new Float32Array(1536);
      const options: GraphRAGSearchOptions = {
        limit: 5,
        requestingUserId: 7,
      };

      const mockChunks = [
        {
          id: '1',
          user_id: 7, // Own chunk
          node_id: 'my-node',
          chunk_text: 'My content',
          similarity: 0.9,
        },
        {
          id: '2',
          user_id: 3, // Other user but null node_id (general knowledge)
          node_id: null,
          chunk_text: 'General knowledge',
          similarity: 0.8,
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockChunks });

      await repository.vectorSearch(embedding, options);

      // Verify the permission logic includes user's own chunks and null node_id chunks
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('gc.user_id = 7'),
        expect.any(Array)
      );
    });

    test('should work without permission filtering when no requestingUserId', async () => {
      const embedding = new Float32Array(1536);
      const options: GraphRAGSearchOptions = {
        limit: 5,
        tenantId: 'test-tenant',
        // No requestingUserId - should use original query without permissions
      };

      mockPool.query.mockResolvedValue({ rows: [] });

      await repository.vectorSearch(embedding, options);

      // Verify original query structure without CTE
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.not.stringContaining('WITH subject_keys AS'),
        expect.any(Array)
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM graphrag_chunks'),
        expect.any(Array)
      );
    });
  });

  describe('graphExpansion', () => {
    test('should expand 1-hop relationships', async () => {
      const seedChunkIds = ['chunk-1', 'chunk-2'];
      const seedSimilarities = [0.9, 0.85];
      const options = {
        maxDepth: 1,
        tenantId: 'default',
      };

      const mockExpanded = [
        {
          chunk_id: 'chunk-3',
          best_seed_sim: 0.9,
          best_path_w: 0.8,
          graph_aware_score: 0.86,
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockExpanded } as any);

      const result = await repository.graphExpansion(
        seedChunkIds,
        seedSimilarities,
        options
      );

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WITH RECURSIVE'),
        expect.any(Array)
      );
      expect(result).toHaveLength(1);
      expect(result[0].graph_aware_score).toBe(0.86);
    });

    test('should expand 2-hop relationships', async () => {
      const seedChunkIds = ['chunk-1'];
      const seedSimilarities = [0.95];
      const options = {
        maxDepth: 2,
        tenantId: 'default',
      };

      const mockExpanded = [
        {
          chunk_id: 'chunk-2',
          best_seed_sim: 0.95,
          best_path_w: 0.9,
          graph_aware_score: 0.93,
        },
        {
          chunk_id: 'chunk-3',
          best_seed_sim: 0.95,
          best_path_w: 0.7,
          graph_aware_score: 0.85,
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockExpanded } as any);

      const result = await repository.graphExpansion(
        seedChunkIds,
        seedSimilarities,
        options
      );

      expect(result).toHaveLength(2);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array)
      );
    });

    test('should handle circular references', async () => {
      const seedChunkIds = ['chunk-1'];
      const seedSimilarities = [0.9];

      // Mock response with potential circular reference handled by CTE
      mockPool.query.mockResolvedValue({
        rows: [
          {
            chunk_id: 'chunk-2',
            best_seed_sim: 0.9,
            best_path_w: 0.8,
            graph_aware_score: 0.86,
          },
        ],
      });

      const result = await repository.graphExpansion(
        seedChunkIds,
        seedSimilarities,
        { maxDepth: 2 } as any
      );

      expect(result).toHaveLength(1);
    });

    test('should return empty array for no expansions', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as any);

      const result = await repository.graphExpansion(['chunk-1'], [0.9], {
        maxDepth: 1,
      });

      expect(result).toEqual([]);
    });
  });

  describe('combinedScoring', () => {
    test('should combine vector and graph scores with default weights', async () => {
      const candidateIds = ['chunk-1', 'chunk-2'];
      const vectorScores = new Map([
        ['chunk-1', 0.9],
        ['chunk-2', 0.8],
      ]);
      const graphScores = new Map([
        ['chunk-1', 0.7],
        ['chunk-2', 0.85],
      ]);

      const mockScored = [
        {
          id: 'chunk-1',
          final_score: 0.81, // 0.6 * 0.9 + 0.3 * 0.7 + 0.1 * recency
          chunk_text: 'Test chunk 1',
          node_id: 'node-1',
          user_id: 1,
        },
        {
          id: 'chunk-2',
          final_score: 0.775, // 0.6 * 0.8 + 0.3 * 0.85 + 0.1 * recency
          chunk_text: 'Test chunk 2',
          node_id: 'node-2',
          user_id: 1,
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockScored } as any);

      const result = await repository.combinedScoring(
        candidateIds,
        vectorScores,
        graphScores
      );

      expect(result).toHaveLength(2);
      expect(result[0].final_score!).toBeGreaterThan(result[1].final_score!);
    });

    test('should apply custom scoring weights', async () => {
      const candidateIds = ['chunk-1'];
      const vectorScores = new Map([['chunk-1', 0.9]]);
      const graphScores = new Map([['chunk-1', 0.7]]);
      const weights = {
        vectorSimilarity: 0.5,
        graphDistance: 0.4,
        recency: 0.1,
      };

      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: 'chunk-1',
            final_score: 0.77, // 0.5 * 0.9 + 0.4 * 0.7 + 0.1 * recency
            chunk_text: 'Test',
            node_id: 'node-1',
            user_id: 1,
          },
        ],
      });

      await repository.combinedScoring(
        candidateIds,
        vectorScores,
        graphScores,
        weights
      );

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array)
      );
    });

    test('should handle missing scores gracefully', async () => {
      const candidateIds = ['chunk-1', 'chunk-2'];
      const vectorScores = new Map([['chunk-1', 0.9]]); // chunk-2 missing
      const graphScores = new Map([['chunk-2', 0.8]]); // chunk-1 missing

      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: 'chunk-1',
            final_score: 0.54,
            chunk_text: 'Test 1',
            node_id: 'n1',
            user_id: 1,
          },
          {
            id: 'chunk-2',
            final_score: 0.24,
            chunk_text: 'Test 2',
            node_id: 'n2',
            user_id: 1,
          },
        ],
      });

      const result = await repository.combinedScoring(
        candidateIds,
        vectorScores,
        graphScores
      );

      expect(result).toHaveLength(2);
    });

    test('should maintain deterministic ordering', async () => {
      const candidateIds = ['chunk-1', 'chunk-2', 'chunk-3'];
      const vectorScores = new Map([
        ['chunk-1', 0.8],
        ['chunk-2', 0.8],
        ['chunk-3', 0.8],
      ]);
      const graphScores = new Map([
        ['chunk-1', 0.7],
        ['chunk-2', 0.7],
        ['chunk-3', 0.7],
      ]);

      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: 'chunk-1',
            final_score: 0.75,
            chunk_text: 'A',
            node_id: 'n1',
            user_id: 1,
          },
          {
            id: 'chunk-2',
            final_score: 0.75,
            chunk_text: 'B',
            node_id: 'n2',
            user_id: 1,
          },
          {
            id: 'chunk-3',
            final_score: 0.75,
            chunk_text: 'C',
            node_id: 'n3',
            user_id: 1,
          },
        ],
      });

      const result = await repository.combinedScoring(
        candidateIds,
        vectorScores,
        graphScores
      );

      // Should maintain order by ID when scores are equal
      expect(result[0].id).toBe('chunk-1');
      expect(result[1].id).toBe('chunk-2');
      expect(result[2].id).toBe('chunk-3');
    });
  });

  describe('createChunk', () => {
    test('should create a new chunk with embedding', async () => {
      const chunkData = {
        userId: 1,
        nodeId: 'node-123',
        chunkText: 'Software engineer with 5 years experience',
        embedding: new Float32Array(1536).fill(0.1),
        nodeType: 'job',
        meta: { company: 'TechCorp', role: 'Senior Engineer' } as any,
      };

      const mockCreated = {
        id: 'chunk-new',
        user_id: chunkData.userId,
        node_id: chunkData.nodeId,
        chunk_text: chunkData.chunkText,
        embedding: `[${Array.from(chunkData.embedding).join(',')}]`,
        node_type: chunkData.nodeType,
        meta: JSON.stringify(chunkData.meta || {}),
        tenant_id: 'default',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValue({ rows: [mockCreated] } as any);

      const result = await repository.createChunk(chunkData);

      expect(result.id).toBe('chunk-new');
      expect(result.chunk_text).toBe(chunkData.chunkText);
    });
  });

  describe('createEdge', () => {
    test('should create an edge between chunks', async () => {
      const edgeData = {
        srcChunkId: 'chunk-1',
        dstChunkId: 'chunk-2',
        relType: 'parent_child' as const,
        weight: 1.0,
        directed: true,
      };

      const mockEdge = {
        id: 'edge-1',
        src_chunk_id: edgeData.srcChunkId,
        dst_chunk_id: edgeData.dstChunkId,
        rel_type: edgeData.relType,
        weight: edgeData.weight,
        directed: edgeData.directed,
        meta: JSON.stringify({}),
        created_at: new Date(),
      };

      mockPool.query.mockResolvedValue({ rows: [mockEdge] } as any);

      const result = await repository.createEdge(edgeData);

      expect(result.id).toBe('edge-1');
      expect(result.rel_type).toBe('parent_child');
    });
  });

  describe('getChunksByNodeId', () => {
    test('should retrieve all chunks for a node', async () => {
      const nodeId = 'node-123';

      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'chunk-1', node_id: nodeId, chunk_text: 'Part 1' } as any,
          { id: 'chunk-2', node_id: nodeId, chunk_text: 'Part 2' } as any,
        ],
      });

      const result = await repository.getChunksByNodeId(nodeId);

      expect(result).toHaveLength(2);
      expect(result[0].node_id).toBe(nodeId);
    });
  });

  describe('getChunksByUserId', () => {
    test('should retrieve all chunks for a user', async () => {
      const userId = 1;

      mockPool.query.mockResolvedValue({
        rows: [
          { id: 'chunk-1', user_id: userId, chunk_text: 'User chunk 1' } as any,
          { id: 'chunk-2', user_id: userId, chunk_text: 'User chunk 2' } as any,
        ],
      });

      const result = await repository.getChunksByUserId(userId);

      expect(result).toHaveLength(2);
      expect(result[0].user_id).toBe(userId);
    });
  });

  describe('removeChunksByNodeId', () => {
    test('should delete chunks for a specific node ID', async () => {
      const nodeId = 'node-123';

      mockPool.query.mockResolvedValue({
        rowCount: 3,
        rows: [],
      });

      await repository.removeChunksByNodeId(nodeId);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM graphrag_chunks'),
        [nodeId]
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE node_id = $1'),
        [nodeId]
      );
    });

    test('should handle deletion when no chunks exist for node', async () => {
      const nodeId = 'non-existent-node';

      mockPool.query.mockResolvedValue({
        rowCount: 0,
        rows: [],
      });

      await repository.removeChunksByNodeId(nodeId);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM graphrag_chunks'),
        [nodeId]
      );
    });

    test('should handle database errors gracefully', async () => {
      const nodeId = 'node-456';
      const error = new Error('Database connection failed');

      mockPool.query.mockRejectedValue(error);

      await expect(repository.removeChunksByNodeId(nodeId)).rejects.toThrow(
        'Database connection failed'
      );

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM graphrag_chunks'),
        [nodeId]
      );
    });

    test('should delete only chunks matching the specific node ID', async () => {
      const nodeId = 'target-node';

      mockPool.query.mockResolvedValue({
        rowCount: 1,
        rows: [],
      });

      await repository.removeChunksByNodeId(nodeId);

      // Verify the query uses parameterized nodeId to prevent SQL injection
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('node_id = $1'),
        [nodeId]
      );

      // Verify only one query was made
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });
  });
});
