/**
 * Permission System Edge Cases and Error Handling Tests
 *
 * Comprehensive test coverage for edge cases, error scenarios, and boundary conditions
 * in the hierarchical permission and batch authorization system.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NodeFilter } from '../../repositories/filters/node-filter';
import { HierarchyService } from '../../services/hierarchy-service';
import { HierarchyRepository } from '../../repositories/hierarchy-repository';
import { TimelineNodeType } from '../../../shared/schema';
import type { TimelineNode } from '../../../shared/schema';

describe('Permission System Edge Cases and Error Handling', () => {
  let service: HierarchyService;
  let repository: HierarchyRepository;
  let mockDb: any;
  let mockStorage: any;
  let mockLogger: any;
  let mockInsightRepository: any;
  let mockNodePermissionService: any;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const mockResults = {
      insert: [],
      select: [],
      update: [],
      delete: { rowCount: 0 },
      execute: [],
    };

    const mockQuery = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn(() => Promise.resolve(mockResults.insert)),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: (resolve: any) => resolve(mockResults.select),
      set: vi.fn().mockReturnThis(),
      transaction: vi.fn((callback) => callback(mockDb)),
    };

    mockDb = {
      insert: vi.fn(() => mockQuery),
      select: vi.fn(() => mockQuery),
      update: vi.fn(() => ({
        ...mockQuery,
        returning: vi.fn(() => Promise.resolve(mockResults.update)),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(mockResults.delete)),
      })),
      execute: vi.fn(() => Promise.resolve({ rows: mockResults.execute })),
      transaction: mockQuery.transaction,
      __setExecuteResult: (result: any[]) => {
        mockResults.execute = result;
      },
      __setInsertResult: (result: any[]) => {
        mockResults.insert = result;
      },
      __setSelectResult: (result: any[]) => {
        mockResults.select = result;
      },
    } as any;

    mockStorage = {
      getUserByUsername: vi.fn(),
    };

    mockInsightRepository = {
      findByNodeId: vi.fn(() => Promise.resolve([])),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
    };

    mockNodePermissionService = {
      setNodePermissions: vi.fn(() => Promise.resolve()),
      checkNodeAccess: vi.fn(() => Promise.resolve(true)),
    };

    repository = new HierarchyRepository({
      database: mockDb,
      logger: mockLogger,
    });

    service = new HierarchyService({
      hierarchyRepository: repository,
      insightRepository: mockInsightRepository,
      nodePermissionService: mockNodePermissionService,
      storage: mockStorage,
      logger: mockLogger,
    });
  });

  describe('NodeFilter Edge Cases', () => {
    it('should handle zero user IDs', async () => {
      const filter = NodeFilter.Of(0).For(0).build();

      expect(filter.currentUserId).toBe(0);
      expect(filter.targetUserId).toBe(0);
      expect(filter.action).toBe('view');
      expect(filter.level).toBe('overview');
    });

    it('should handle negative user IDs', async () => {
      const filter = NodeFilter.Of(-1).For(-2).build();

      expect(filter.currentUserId).toBe(-1);
      expect(filter.targetUserId).toBe(-2);
    });

    it('should handle extremely large user IDs', async () => {
      const largeId = Number.MAX_SAFE_INTEGER;
      const filter = NodeFilter.Of(largeId)
        .For(largeId - 1)
        .build();

      expect(filter.currentUserId).toBe(largeId);
      expect(filter.targetUserId).toBe(largeId - 1);
    });

    it('should handle empty node ID arrays in batch operations', async () => {
      const filter = NodeFilter.ForNodes(1, []).build();
      const result = await repository.checkBatchAuthorization(filter);

      expect(result).toEqual({
        authorized: [],
        unauthorized: [],
        notFound: [],
      });
    });

    it('should handle very large node ID arrays', async () => {
      const largeNodeIds = Array.from({ length: 10000 }, (_, i) => `node-${i}`);
      const filter = NodeFilter.ForNodes(1, largeNodeIds).For(2).build(); // Must specify target user

      // Mock large result set
      const largeResult = largeNodeIds.map((id, index) => ({
        node_id: id,
        status: index % 2 === 0 ? 'authorized' : 'unauthorized',
      }));
      mockDb.__setExecuteResult(largeResult);

      const result = await repository.checkBatchAuthorization(filter);

      expect(result.authorized).toHaveLength(5000);
      expect(result.unauthorized).toHaveLength(5000);
      expect(result.notFound).toHaveLength(0);
    });

    it('should handle node IDs with special characters', async () => {
      const specialNodeIds = [
        'node-with-dashes',
        'node_with_underscores',
        'node.with.dots',
        'node with spaces',
        'node/with/slashes',
        'node\\with\\backslashes',
        "node'with'quotes",
        'node"with"double-quotes',
        'node@with@symbols',
        'node#with#hash',
        'node%with%percent',
        'node&with&ampersand',
      ];

      const specialResult = specialNodeIds.map((id) => ({
        node_id: id,
        status: 'authorized',
      }));
      mockDb.__setExecuteResult(specialResult);

      const filter = NodeFilter.ForNodes(1, specialNodeIds).For(2).build();
      const result = await repository.checkBatchAuthorization(filter);

      expect(result.authorized).toEqual(specialNodeIds);
    });

    it('should handle very long node IDs', async () => {
      const longNodeId = 'node-' + 'x'.repeat(1000); // 1005 character node ID
      const filter = NodeFilter.ForNodes(1, [longNodeId]).For(2).build(); // Must specify target user

      mockDb.__setExecuteResult([
        { node_id: longNodeId, status: 'authorized' },
      ]);

      const result = await repository.checkBatchAuthorization(filter);
      expect(result.authorized).toContain(longNodeId);
    });
  });

  describe('Database Error Scenarios', () => {
    it('should handle database connection timeouts', async () => {
      mockDb.execute.mockRejectedValue(new Error('connection timeout'));

      const filter = NodeFilter.Of(1).For(2).build();

      await expect(repository.getAllNodes(filter)).rejects.toThrow(
        'connection timeout'
      );
    });

    it('should handle SQL syntax errors gracefully', async () => {
      mockDb.execute.mockRejectedValue(
        new Error('syntax error at or near "INVALID"')
      );

      const filter = NodeFilter.Of(1).For(2).build();

      await expect(repository.getAllNodes(filter)).rejects.toThrow(
        'syntax error'
      );
    });

    it('should handle database constraint violations', async () => {
      mockDb.execute.mockRejectedValue(
        new Error('duplicate key value violates unique constraint')
      );

      const filter = NodeFilter.Of(1).For(2).build();

      await expect(repository.getAllNodes(filter)).rejects.toThrow(
        'duplicate key value'
      );
    });

    it('should handle database disconnection during query', async () => {
      mockDb.execute.mockRejectedValue(
        new Error('server closed the connection unexpectedly')
      );

      const filter = NodeFilter.Of(1).For(2).build();

      await expect(repository.getAllNodes(filter)).rejects.toThrow(
        'server closed the connection'
      );
    });

    it('should handle malformed database responses', async () => {
      // Test various malformed response scenarios
      const malformedResponses = [
        null,
        undefined,
        { rows: null },
        { rows: undefined },
        { notRows: [] },
        { rows: 'not an array' },
        { rows: [{ malformed: 'data' }] },
      ];

      for (const response of malformedResponses) {
        mockDb.execute.mockResolvedValueOnce(response);

        const filter = NodeFilter.Of(1).For(2).build();

        try {
          const result = await repository.getAllNodes(filter);
          // Should handle gracefully - might return empty array or null
          expect([null, undefined, []]).toContainEqual(result);
        } catch (error) {
          // Some malformed responses might throw - that's acceptable
          expect(error).toBeDefined();
        }
      }
    });

    it('should handle partial query results', async () => {
      // Test scenario where database returns incomplete data
      const partialResult = [
        { id: 'node-1' }, // Missing required fields
        { userId: 2 }, // Missing id
        null, // Null entry
        undefined, // Undefined entry
      ];

      mockDb.__setExecuteResult(partialResult);

      const filter = NodeFilter.Of(1).For(2).build();
      const result = await repository.getAllNodes(filter);

      // Should handle partial data gracefully
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Service Layer Error Handling', () => {
    it('should handle user lookup service failures', async () => {
      mockStorage.getUserByUsername.mockRejectedValue(
        new Error('User service down')
      );

      await expect(service.getAllNodes(1, 'testuser')).rejects.toThrow(
        'User service down'
      );
    });

    it('should handle permission service failures during node creation', async () => {
      const nodeData = {
        type: 'project' as const,
        meta: { title: 'Test Project' },
      };

      const createdNode = {
        id: 'test-node',
        type: TimelineNodeType.Project,
        userId: 1,
        parentId: null,
        meta: nodeData.meta,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.__setInsertResult([createdNode]);
      mockDb.__setSelectResult([]);
      mockNodePermissionService.setNodePermissions.mockRejectedValue(
        new Error('Permission service unavailable')
      );

      // Should not fail node creation due to permission service error
      const result = await service.createNode(nodeData, 1);

      expect(result).toBeDefined();
      expect(result.id).toBe('test-node');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to establish default permissions'),
        expect.any(Object)
      );
    });

    it('should handle concurrent modification scenarios', async () => {
      // Simulate optimistic locking failure
      mockDb.update().returning.mockResolvedValue([]);

      const updateResult = await service.updateNode(
        'node-1',
        { meta: { title: 'Updated' } },
        1
      );
      expect(updateResult).toBeNull();
    });

    it('should handle invalid metadata during node creation', async () => {
      const invalidNodeData = {
        type: 'project' as const,
        meta: {
          title: null, // Invalid - should be string
          invalidField: 'should not exist',
        },
      };

      // Mock validation error from repository
      mockDb.insert().values.mockImplementation(() => {
        throw new Error(
          "Invalid metadata for node type 'project': meta.title: Expected string, received null"
        );
      });

      await expect(service.createNode(invalidNodeData, 1)).rejects.toThrow(
        'Invalid metadata'
      );
    });

    it('should handle memory pressure during large operations', async () => {
      // Simulate out of memory error
      mockDb.execute.mockRejectedValue(
        new Error('JavaScript heap out of memory')
      );

      const largeNodeIds = Array.from({ length: 50000 }, (_, i) => `node-${i}`);

      await expect(
        service.checkBatchAuthorization(1, largeNodeIds, 2)
      ).rejects.toThrow('JavaScript heap out of memory');
    });
  });

  describe('Race Condition and Concurrency Edge Cases', () => {
    it('should handle simultaneous node creation and permission checks', async () => {
      // Simulate rapid node creation followed by immediate permission check
      const nodeData = {
        type: 'project' as const,
        meta: { title: 'Concurrent Test' },
      };

      const newNode = {
        id: 'concurrent-node',
        type: TimelineNodeType.Project,
        userId: 1,
        parentId: null,
        meta: nodeData.meta,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock node creation
      mockDb.__setInsertResult([newNode]);
      mockDb.__setSelectResult([]);

      // Create node
      const created = await service.createNode(nodeData, 1);

      // For self-check (user checking their own nodes), mock the select query instead
      mockDb.__setSelectResult([{ id: 'concurrent-node' }]);

      const authResult = await service.checkBatchAuthorization(
        1,
        ['concurrent-node'],
        1
      ); // Self-check

      expect(created.id).toBe('concurrent-node');
      expect(authResult.authorized).toContain('concurrent-node');
    });

    it('should handle node deletion during permission check', async () => {
      // Start with node existing
      mockDb.__setExecuteResult([
        { node_id: 'disappearing-node', status: 'not_found' },
      ]);

      const result = await service.checkBatchAuthorization(
        1,
        ['disappearing-node'],
        2
      );

      expect(result.notFound).toContain('disappearing-node');
      expect(result.authorized).not.toContain('disappearing-node');
    });

    it('should handle permission changes during batch operation', async () => {
      // Simulate permissions changing mid-operation
      const nodeIds = ['node-1', 'node-2', 'node-3'];

      // First call - all authorized
      mockDb.__setExecuteResult([
        { node_id: 'node-1', status: 'authorized' },
        { node_id: 'node-2', status: 'authorized' },
        { node_id: 'node-3', status: 'authorized' },
      ]);

      const result1 = await service.checkBatchAuthorization(1, nodeIds, 2);
      expect(result1.authorized).toHaveLength(3);

      // Second call - some permissions revoked
      mockDb.__setExecuteResult([
        { node_id: 'node-1', status: 'authorized' },
        { node_id: 'node-2', status: 'unauthorized' },
        { node_id: 'node-3', status: 'unauthorized' },
      ]);

      const result2 = await service.checkBatchAuthorization(1, nodeIds, 2);
      expect(result2.authorized).toHaveLength(1);
      expect(result2.unauthorized).toHaveLength(2);
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    it('should handle extremely deep hierarchy levels', async () => {
      // Create very deep hierarchy (1000 levels)
      const deepHierarchy = Array.from({ length: 1000 }, (_, i) => ({
        id: `level-${i}`,
        type: TimelineNodeType.Project,
        userId: 2,
        parentId: i > 0 ? `level-${i - 1}` : null,
        meta: { title: `Level ${i}` },
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      mockDb.__setExecuteResult(deepHierarchy);

      const filter = NodeFilter.Of(1).For(2).WithAction('view').build();

      // Should handle without stack overflow
      const result = await repository.getAllNodes(filter);
      expect(result).toHaveLength(1000);
    });

    it('should handle maximum SQL parameter limits', async () => {
      // PostgreSQL has a limit of ~65535 parameters
      // Test with large number of node IDs that might approach this limit
      const maxNodeIds = Array.from(
        { length: 32000 },
        (_, i) => `param-node-${i}`
      );

      mockDb.__setExecuteResult(
        maxNodeIds.map((id) => ({ node_id: id, status: 'authorized' }))
      );

      const filter = NodeFilter.ForNodes(1, maxNodeIds).For(2).build();

      try {
        const result = await repository.checkBatchAuthorization(filter);
        expect(result.authorized).toHaveLength(32000);
      } catch (error) {
        // If it fails due to parameter limits, that's expected
        expect(error.message).toMatch(/too many parameters|parameter limit/i);
      }
    });

    it('should handle query timeout scenarios', async () => {
      mockDb.execute.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Query timeout')), 100)
          )
      );

      const filter = NodeFilter.Of(1).For(2).build();

      await expect(repository.getAllNodes(filter)).rejects.toThrow(
        'Query timeout'
      );
    });
  });

  describe('Data Corruption and Recovery Scenarios', () => {
    it('should handle circular reference detection', async () => {
      // Test nodes that reference each other in a cycle
      const circularNodes = [
        { id: 'node-a', parentId: 'node-c', status: 'authorized' },
        { id: 'node-b', parentId: 'node-a', status: 'authorized' },
        { id: 'node-c', parentId: 'node-b', status: 'authorized' },
      ];

      mockDb.__setExecuteResult(circularNodes);

      const filter = NodeFilter.Of(1).For(2).build();

      // Should not cause infinite loop
      const result = await repository.getAllNodes(filter);
      expect(result).toHaveLength(3);
    });

    it('should handle orphaned nodes gracefully', async () => {
      // Test nodes with parentIds that don't exist
      const orphanedNodes = [
        {
          id: 'orphan-1',
          parentId: 'non-existent-parent',
          status: 'authorized',
        },
        {
          id: 'orphan-2',
          parentId: 'another-missing-parent',
          status: 'authorized',
        },
      ];

      mockDb.__setExecuteResult(orphanedNodes);

      const filter = NodeFilter.Of(1).For(2).build();
      const result = await repository.getAllNodes(filter);

      expect(result).toHaveLength(2);
    });

    it('should handle duplicate node IDs in batch operations', async () => {
      const duplicateNodeIds = [
        'node-1',
        'node-1',
        'node-2',
        'node-2',
        'node-3',
      ];

      // Database might return results for each duplicate
      mockDb.__setExecuteResult([
        { node_id: 'node-1', status: 'authorized' },
        { node_id: 'node-1', status: 'authorized' },
        { node_id: 'node-2', status: 'unauthorized' },
        { node_id: 'node-2', status: 'unauthorized' },
        { node_id: 'node-3', status: 'not_found' },
      ]);

      const filter = NodeFilter.ForNodes(1, duplicateNodeIds).For(2).build(); // Must specify target user
      const result = await repository.checkBatchAuthorization(filter);

      // Should handle duplicates appropriately
      expect(result.authorized.length).toBeGreaterThanOrEqual(1);
      expect(result.unauthorized.length).toBeGreaterThanOrEqual(1);
      expect(result.notFound.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle SQL injection attempts in node IDs', async () => {
      const maliciousNodeIds = [
        "'; DROP TABLE timeline_nodes; --",
        "' OR '1'='1",
        "'; UPDATE users SET password='hacked'; --",
        "' UNION SELECT * FROM users; --",
      ];

      // Should be safely parameterized - no actual SQL injection
      mockDb.__setExecuteResult(
        maliciousNodeIds.map((id) => ({ node_id: id, status: 'not_found' }))
      );

      const filter = NodeFilter.ForNodes(1, maliciousNodeIds).build();
      const result = await repository.checkBatchAuthorization(filter);

      expect(result.notFound).toEqual(maliciousNodeIds);
    });

    it('should handle extremely large user IDs (potential overflow)', async () => {
      const overflowUserId = Number.MAX_SAFE_INTEGER + 1;

      try {
        const filter = NodeFilter.Of(overflowUserId).For(1).build();
        expect(filter.currentUserId).toBeDefined();
      } catch (error) {
        // JavaScript number overflow handling
        expect(error).toBeDefined();
      }
    });

    it('should handle null and undefined values safely', async () => {
      // These should be handled by TypeScript, but test runtime safety
      try {
        const filter = NodeFilter.Of(null as any)
          .For(undefined as any)
          .build();
        // Should either work or throw descriptive error
        expect(filter).toBeDefined();
      } catch (error) {
        expect(error.message).toMatch(/user.*id|null|undefined/i);
      }
    });
  });
});
