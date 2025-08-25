/**
 * Advanced Hierarchy Service Tests
 *
 * Comprehensive test coverage for service layer including:
 * - Complex permission workflows
 * - User lookup and caching scenarios
 * - Batch authorization service integration
 * - Error handling and recovery
 * - Performance and scalability scenarios
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HierarchyService } from '../hierarchy-service';
import { NodeFilter } from '../../repositories/filters/node-filter';
import { TimelineNodeType } from '@shared/schema';
import type { TimelineNode, NodeInsight } from '@shared/schema';
import type { BatchAuthorizationResult } from '../../repositories/interfaces/hierarchy.repository.interface';

describe('Advanced Hierarchy Service Tests', () => {
  let service: HierarchyService;
  let mockRepository: any;
  let mockInsightRepository: any;
  let mockNodePermissionService: any;
  let mockStorage: any;
  let mockLogger: any;

  const createTestNode = (
    overrides: Partial<TimelineNode> = {}
  ): TimelineNode => ({
    id: `test-node-${Math.random().toString(36).substr(2, 9)}`,
    type: TimelineNodeType.Project,
    parentId: null,
    userId: 1,
    meta: { title: 'Test Node', description: 'Test Description' },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockRepository = {
      createNode: vi.fn(),
      getById: vi.fn(),
      updateNode: vi.fn(),
      deleteNode: vi.fn(),
      getAllNodes: vi.fn(),
      checkBatchAuthorization: vi.fn(),
    };

    mockInsightRepository = {
      findByNodeId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findById: vi.fn(),
    };

    mockNodePermissionService = {
      setNodePermissions: vi.fn(),
      checkNodeAccess: vi.fn(),
    };

    mockStorage = {
      getUserByUsername: vi.fn(),
    };

    service = new HierarchyService({
      hierarchyRepository: mockRepository,
      insightRepository: mockInsightRepository,
      nodePermissionService: mockNodePermissionService,
      storage: mockStorage,
      logger: mockLogger,
    });
  });

  describe('Advanced Node Management', () => {
    it('should handle node creation with permission setup failure gracefully', async () => {
      // Arrange
      const createDTO = {
        type: 'project' as const,
        parentId: null,
        meta: { title: 'Test Project', description: 'Test Description' },
      };

      const createdNode = createTestNode();
      mockRepository.createNode.mockResolvedValue(createdNode);
      mockRepository.getById.mockResolvedValue(null); // No parent
      mockNodePermissionService.setNodePermissions.mockRejectedValue(
        new Error('Permission service unavailable')
      );

      // Act
      const result = await service.createNode(createDTO, 1);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(createdNode.id);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to establish default permissions for new node',
        expect.objectContaining({
          nodeId: createdNode.id,
          userId: 1,
          error: 'Permission service unavailable',
        })
      );
    });

    it('should enrich nodes with parent information across multiple levels', async () => {
      // Arrange
      const grandParent = createTestNode({
        id: 'grandparent',
        type: TimelineNodeType.Job,
      });
      const parent = createTestNode({
        id: 'parent',
        type: TimelineNodeType.Event,
        parentId: 'grandparent',
      });
      const child = createTestNode({
        id: 'child',
        type: TimelineNodeType.Project,
        parentId: 'parent',
      });

      mockRepository.getById
        .mockResolvedValueOnce(parent) // First call for child's parent
        .mockResolvedValueOnce(grandParent); // Second call for parent's parent

      // Act
      const enriched = await (service as any).enrichWithParentInfo(child, 1);

      // Assert
      expect(enriched.parent).toBeDefined();
      expect(enriched.parent?.id).toBe('parent');
      expect(enriched.parent?.type).toBe('event');
      expect(enriched.parent?.title).toBe('Test Node');
    });

    it('should handle node deletion with orphan management', async () => {
      // Arrange
      const nodeId = 'test-node-id';
      mockRepository.deleteNode.mockResolvedValue(true);

      // Act
      const result = await service.deleteNode(nodeId, 1);

      // Assert
      expect(result).toBe(true);
      expect(mockRepository.deleteNode).toHaveBeenCalledWith(nodeId, 1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Deleting node via service',
        {
          nodeId,
          userId: 1,
        }
      );
    });
  });

  describe('Advanced Permission-based Node Retrieval', () => {
    it('should handle getAllNodes with username lookup and caching behavior', async () => {
      // Arrange
      const requestingUserId = 1;
      const username = 'testuser';
      const targetUser = { id: 2, username: 'testuser' };
      const nodes = [
        createTestNode({ userId: 2 }),
        createTestNode({ userId: 2 }),
      ];

      mockStorage.getUserByUsername.mockResolvedValue(targetUser);
      mockRepository.getAllNodes.mockResolvedValue(nodes);
      mockRepository.getById.mockResolvedValue(null); // No parents

      // Act - First call
      const result1 = await service.getAllNodes(
        requestingUserId,
        username,
        'view',
        'overview'
      );

      // Act - Second call with same username (should use same lookup)
      const result2 = await service.getAllNodes(
        requestingUserId,
        username,
        'edit',
        'full'
      );

      // Assert
      expect(result1).toHaveLength(2);
      expect(result2).toHaveLength(2);
      expect(mockStorage.getUserByUsername).toHaveBeenCalledTimes(2); // Called each time
      expect(mockRepository.getAllNodes).toHaveBeenCalledTimes(2);

      // Verify different filter parameters were used
      const firstCall = mockRepository.getAllNodes.mock.calls[0][0];
      const secondCall = mockRepository.getAllNodes.mock.calls[1][0];

      expect(firstCall.action).toBe('view');
      expect(firstCall.level).toBe('overview');
      expect(secondCall.action).toBe('edit');
      expect(secondCall.level).toBe('full');
    });

    it('should handle getAllNodes with non-existent username', async () => {
      // Arrange
      mockStorage.getUserByUsername.mockResolvedValue(null);

      // Act
      const result = await service.getAllNodes(1, 'nonexistent-user');

      // Assert
      expect(result).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'User not found for username',
        {
          username: 'nonexistent-user',
        }
      );
    });

    it('should handle getAllNodes for self without username', async () => {
      // Arrange
      const nodes = [
        createTestNode({ userId: 1 }),
        createTestNode({ userId: 1 }),
      ];
      mockRepository.getAllNodes.mockResolvedValue(nodes);
      mockRepository.getById.mockResolvedValue(null);

      // Act
      const result = await service.getAllNodes(1); // No username = self

      // Assert
      expect(result).toHaveLength(2);
      expect(mockStorage.getUserByUsername).not.toHaveBeenCalled();

      const filterCall = mockRepository.getAllNodes.mock.calls[0][0];
      expect(filterCall.currentUserId).toBe(1);
      expect(filterCall.targetUserId).toBe(1); // Same user
    });

    it('should handle getAllNodes with complex permission scenarios', async () => {
      // Arrange - Mix of authorized and unauthorized nodes
      const username = 'colleague';
      const targetUser = { id: 3, username: 'colleague' };

      const authorizedNodes = [
        createTestNode({ id: 'public-node', userId: 3 }),
        createTestNode({ id: 'shared-node', userId: 3 }),
      ];

      mockStorage.getUserByUsername.mockResolvedValue(targetUser);
      mockRepository.getAllNodes.mockResolvedValue(authorizedNodes);
      mockRepository.getById.mockResolvedValue(null);

      // Act
      const result = await service.getAllNodes(1, username, 'view', 'overview');

      // Assert
      expect(result).toHaveLength(2);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Fetching nodes with permission filter',
        expect.objectContaining({
          currentUserId: 1,
          targetUserId: 3,
          username: 'colleague',
          action: 'view',
          level: 'overview',
        })
      );
    });
  });

  describe('Batch Authorization Service Integration', () => {
    it('should handle batch authorization with mixed results', async () => {
      // Arrange
      const nodeIds = ['node1', 'node2', 'node3', 'node4'];
      const batchResult: BatchAuthorizationResult = {
        authorized: ['node1', 'node3'],
        unauthorized: ['node2'],
        notFound: ['node4'],
      };

      mockRepository.checkBatchAuthorization.mockResolvedValue(batchResult);

      // Act
      const result = await service.checkBatchAuthorization(
        1,
        nodeIds,
        2,
        'view',
        'overview'
      );

      // Assert
      expect(result).toEqual(batchResult);
      expect(mockRepository.checkBatchAuthorization).toHaveBeenCalledWith(
        expect.objectContaining({
          currentUserId: 1,
          targetUserId: 2,
          action: 'view',
          level: 'overview',
          nodeIds: nodeIds,
        })
      );
    });

    it('should handle batch authorization for self (no targetUserId)', async () => {
      // Arrange
      const nodeIds = ['own-node1', 'own-node2'];
      const batchResult: BatchAuthorizationResult = {
        authorized: nodeIds,
        unauthorized: [],
        notFound: [],
      };

      mockRepository.checkBatchAuthorization.mockResolvedValue(batchResult);

      // Act
      const result = await service.checkBatchAuthorization(
        1,
        nodeIds,
        undefined,
        'edit',
        'full'
      );

      // Assert
      expect(result).toEqual(batchResult);

      const filterArg = mockRepository.checkBatchAuthorization.mock.calls[0][0];
      expect(filterArg.currentUserId).toBe(1);
      expect(filterArg.targetUserId).toBe(1); // Defaults to current user
    });

    it('should handle empty batch authorization gracefully', async () => {
      // Act
      const result = await service.checkBatchAuthorization(1, [], 2);

      // Assert
      expect(result).toEqual({
        authorized: [],
        unauthorized: [],
        notFound: [],
      });
      expect(mockRepository.checkBatchAuthorization).not.toHaveBeenCalled();
    });

    it('should handle batch authorization with large datasets', async () => {
      // Arrange - Test with 1000 nodes
      const nodeIds = Array.from({ length: 1000 }, (_, i) => `node-${i}`);
      const batchResult: BatchAuthorizationResult = {
        authorized: nodeIds.slice(0, 800),
        unauthorized: nodeIds.slice(800, 950),
        notFound: nodeIds.slice(950),
      };

      mockRepository.checkBatchAuthorization.mockResolvedValue(batchResult);

      // Act
      const result = await service.checkBatchAuthorization(
        1,
        nodeIds,
        2,
        'view',
        'overview'
      );

      // Assert
      expect(result.authorized).toHaveLength(800);
      expect(result.unauthorized).toHaveLength(150);
      expect(result.notFound).toHaveLength(50);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Checking batch authorization',
        {
          requestingUserId: 1,
          targetUserId: 2,
          nodeCount: 1000,
          action: 'view',
          level: 'overview',
        }
      );
    });

    it('should handle batch authorization with different permission actions', async () => {
      // Test each permission action type
      const nodeIds = ['test-node'];
      const actions: Array<'view' | 'edit' | 'share' | 'delete'> = [
        'view',
        'edit',
        'share',
        'delete',
      ];

      for (const action of actions) {
        mockRepository.checkBatchAuthorization.mockResolvedValue({
          authorized: action === 'view' ? nodeIds : [],
          unauthorized: action !== 'view' ? nodeIds : [],
          notFound: [],
        });

        // Act
        const result = await service.checkBatchAuthorization(
          1,
          nodeIds,
          2,
          action
        );

        // Assert
        if (action === 'view') {
          expect(result.authorized).toEqual(nodeIds);
        } else {
          expect(result.unauthorized).toEqual(nodeIds);
        }
      }
    });
  });

  describe('Insights Management with Permissions', () => {
    it('should handle insight creation with node ownership verification', async () => {
      // Arrange
      const nodeId = 'test-node';
      const insightData = {
        description: 'Test insight',
        resources: ['http://example.com'],
      };
      const node = createTestNode({ id: nodeId, userId: 1 });
      const insight = { id: 'insight-1', nodeId, ...insightData };

      mockRepository.getById.mockResolvedValue(node);
      mockInsightRepository.create.mockResolvedValue(insight);

      // Act
      const result = await service.createInsight(nodeId, insightData, 1);

      // Assert
      expect(result).toEqual(insight);
      expect(mockRepository.getById).toHaveBeenCalledWith(nodeId, 1);
      expect(mockInsightRepository.create).toHaveBeenCalledWith({
        nodeId,
        ...insightData,
      });
    });

    it('should handle insight operations with access denied scenarios', async () => {
      // Arrange
      const nodeId = 'unauthorized-node';
      const insightData = { description: 'Unauthorized insight' };

      mockRepository.getById.mockResolvedValue(null); // Node not found/no access

      // Act & Assert
      await expect(
        service.createInsight(nodeId, insightData, 1)
      ).rejects.toThrow('Node not found or access denied');
    });

    it('should handle insight deletion with proper ownership checks', async () => {
      // Arrange
      const insightId = 'insight-1';
      const insight = { id: insightId, nodeId: 'node-1', description: 'Test' };
      const node = createTestNode({ id: 'node-1', userId: 1 });

      mockInsightRepository.findById.mockResolvedValue(insight);
      mockRepository.getById.mockResolvedValue(node);
      mockInsightRepository.delete.mockResolvedValue(true);

      // Act
      const result = await service.deleteInsight(insightId, 1);

      // Assert
      expect(result).toBe(true);
      expect(mockRepository.getById).toHaveBeenCalledWith('node-1', 1);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle repository errors gracefully', async () => {
      // Arrange
      mockRepository.getAllNodes.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act & Assert
      await expect(service.getAllNodes(1)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle user lookup service errors', async () => {
      // Arrange
      mockStorage.getUserByUsername.mockRejectedValue(
        new Error('User service unavailable')
      );

      // Act & Assert
      await expect(service.getAllNodes(1, 'testuser')).rejects.toThrow(
        'User service unavailable'
      );
    });

    it('should handle permission service errors during node creation', async () => {
      // Arrange
      const createDTO = { type: 'project' as const, meta: { title: 'Test' } };
      const node = createTestNode();

      mockRepository.createNode.mockResolvedValue(node);
      mockRepository.getById.mockResolvedValue(null);
      mockNodePermissionService.setNodePermissions.mockRejectedValue(
        new Error('Permission service error')
      );

      // Act
      const result = await service.createNode(createDTO, 1);

      // Assert - Node creation should succeed despite permission service error
      expect(result).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to establish default permissions'),
        expect.any(Object)
      );
    });

    it('should handle batch authorization repository errors', async () => {
      // Arrange
      mockRepository.checkBatchAuthorization.mockRejectedValue(
        new Error('Batch authorization failed')
      );

      // Act & Assert
      await expect(
        service.checkBatchAuthorization(1, ['node1'], 2)
      ).rejects.toThrow('Batch authorization failed');
    });
  });

  describe('Performance and Scalability Scenarios', () => {
    it('should handle large node lists with parent enrichment efficiently', async () => {
      // Arrange - 100 nodes with various parent relationships
      const nodes = Array.from({ length: 100 }, (_, i) =>
        createTestNode({
          id: `node-${i}`,
          parentId: i > 50 ? `node-${i - 1}` : null,
        })
      );

      mockRepository.getAllNodes.mockResolvedValue(nodes);

      // Mock parent lookups - some exist, some don't
      mockRepository.getById.mockImplementation((nodeId) => {
        const parentIndex = parseInt(nodeId.split('-')[1]);
        return parentIndex < 50
          ? Promise.resolve(nodes[parentIndex])
          : Promise.resolve(null);
      });

      // Act
      const result = await service.getAllNodes(1);

      // Assert
      expect(result).toHaveLength(100);
      expect(mockRepository.getById).toHaveBeenCalledTimes(50); // Only nodes with parents
    });

    it('should log performance metrics for large operations', async () => {
      // Arrange
      const largeNodeSet = Array.from({ length: 500 }, (_, i) =>
        createTestNode({ id: `node-${i}` })
      );

      mockRepository.getAllNodes.mockResolvedValue(largeNodeSet);
      mockRepository.getById.mockResolvedValue(null);

      // Act
      await service.getAllNodes(1);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith('Retrieved nodes', {
        count: 500,
        currentUserId: 1,
        targetUserId: 1,
        action: 'view',
        level: 'overview',
      });
    });
  });
});
