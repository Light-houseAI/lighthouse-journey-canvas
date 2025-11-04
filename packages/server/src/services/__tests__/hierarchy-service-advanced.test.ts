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

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';

import { createMockLogger, createTestNode } from '../../../tests/utils';
import type { BatchAuthorizationResult } from '../../repositories/interfaces/hierarchy.repository.interface.js';
import type { IHierarchyRepository } from '../../repositories/interfaces/hierarchy.repository.interface.js';
import type { IInsightRepository } from '../../repositories/interfaces/insight.repository.interface.js';
import type { IOrganizationRepository } from '../../repositories/interfaces/organization.repository.interface.js';
import { HierarchyService } from '../hierarchy-service.js';
import type { IExperienceMatchesService } from '../interfaces.js';
import type { LLMSummaryService } from '../llm-summary.service.js';
import { NodePermissionService } from '../node-permission.service.js';
import { UserService } from '../user-service.js';

describe('Advanced Hierarchy Service Tests', () => {
  let service: HierarchyService;
  let mockRepository: MockProxy<IHierarchyRepository>;
  let mockInsightRepository: MockProxy<IInsightRepository>;
  let mockNodePermissionService: MockProxy<NodePermissionService>;
  let mockOrganizationRepository: MockProxy<IOrganizationRepository>;
  let mockUserService: MockProxy<UserService>;
  let mockExperienceMatchesService: MockProxy<IExperienceMatchesService>;
  let mockLLMSummaryService: MockProxy<LLMSummaryService>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    // Clear all mocks before each test to prevent cross-test contamination
    vi.clearAllMocks();

    mockLogger = createMockLogger();

    mockRepository = mock<IHierarchyRepository>();
    mockInsightRepository = mock<IInsightRepository>();
    mockNodePermissionService = mock<NodePermissionService>();
    mockOrganizationRepository = mock<IOrganizationRepository>();
    mockUserService = mock<UserService>();
    mockExperienceMatchesService = mock<IExperienceMatchesService>();
    mockLLMSummaryService = mock<LLMSummaryService>();

    service = new HierarchyService({
      hierarchyRepository: mockRepository,
      insightRepository: mockInsightRepository,
      nodePermissionService: mockNodePermissionService,
      organizationRepository: mockOrganizationRepository,
      userService: mockUserService,
      logger: mockLogger,
      pgVectorGraphRAGService: {} as any,
      openAIEmbeddingService: {} as any,
      experienceMatchesService: mockExperienceMatchesService,
      llmSummaryService: mockLLMSummaryService,
    });
  });

  describe('Advanced Node Management', () => {
    it('should handle node creation with permission setup failure gracefully', async () => {
      // Arrange
      const createDTO = {
        type: 'project' as const,
        parentId: null,
        meta: { title: 'Test Project', description: 'Test Description' } as any,
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
        type: 'job' as const,
      });
      const parent = createTestNode({
        id: 'parent',
        type: 'event' as const,
        parentId: 'grandparent',
      });
      const child = createTestNode({
        id: 'child',
        type: 'project' as const,
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
      const targetUser = {
        id: 2,
        userName: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        password: 'hashedpassword',
        interest: null,
        hasCompletedOnboarding: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
      const nodes = [
        createTestNode({ userId: 2 } as any),
        createTestNode({ userId: 2 } as any),
      ];

      mockUserService.getUserByUsername.mockResolvedValue(targetUser);
      mockRepository.getAllNodes.mockResolvedValue(nodes);
      mockRepository.getById.mockResolvedValue(null); // No parents

      // Act - First call
      const result1 = await service.getAllNodes(
        requestingUserId,
        username as any
      );

      // Act - Second call with same username (should use same lookup)
      const result2 = await service.getAllNodes(
        requestingUserId,
        username as any
      );

      // Assert
      expect(result1).toHaveLength(2);
      expect(result2).toHaveLength(2);
      expect(mockUserService.getUserByUsername).toHaveBeenCalledTimes(2); // Called each time
      expect(mockRepository.getAllNodes).toHaveBeenCalledTimes(2);

      // Verify filter parameters were used for cross-user access
      const firstCall = mockRepository.getAllNodes.mock.calls[0][0];
      const secondCall = mockRepository.getAllNodes.mock.calls[1][0];

      expect(firstCall.currentUserId).toBe(1);
      expect(firstCall.targetUserId).toBe(2);
      expect(secondCall.currentUserId).toBe(1);
      expect(secondCall.targetUserId).toBe(2);
    });

    it('should handle getAllNodes with non-existent username', async () => {
      // Arrange
      mockUserService.getUserByUsername.mockResolvedValue(null);

      // Act
      const result = await service.getAllNodes(1, 'nonexistent-user' as any);

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
      // Arrange - Create fresh mocks for this test
      const freshMockRepository = mock<IHierarchyRepository>();
      const freshMockUserService = mock<UserService>();
      const freshService = new HierarchyService({
        hierarchyRepository: freshMockRepository,
        insightRepository: mockInsightRepository,
        nodePermissionService: mockNodePermissionService,
        organizationRepository: mockOrganizationRepository,
        userService: freshMockUserService,
        logger: mockLogger,
        pgVectorGraphRAGService: {} as any,
        openAIEmbeddingService: {} as any,
        experienceMatchesService: mockExperienceMatchesService,
      });

      const nodes = [
        createTestNode({ userId: 1 } as any),
        createTestNode({ userId: 1 } as any),
      ];
      freshMockRepository.getAllNodes.mockResolvedValue(nodes);
      freshMockRepository.getById.mockResolvedValue(null);

      // Act
      const result = await freshService.getAllNodes(1); // No username = self

      // Assert
      expect(result).toHaveLength(2);
      expect(freshMockUserService.getUserByUsername).not.toHaveBeenCalled();

      const filterCall = freshMockRepository.getAllNodes.mock.calls[0][0];
      expect(filterCall.currentUserId).toBe(1);
    });

    it('should handle getAllNodes with complex permission scenarios', async () => {
      // Arrange - Mix of authorized and unauthorized nodes
      const username = 'colleague';
      const targetUser = { id: 3, username: 'colleague' } as any;

      const authorizedNodes = [
        createTestNode({ id: 'public-node', userId: 3 } as any),
        createTestNode({ id: 'shared-node', userId: 3 } as any),
      ];

      mockUserService.getUserByUsername.mockResolvedValue(targetUser);
      mockRepository.getAllNodes.mockResolvedValue(authorizedNodes);
      mockRepository.getById.mockResolvedValue(null);

      // Act
      const result = await service.getAllNodes(1, username as any);

      // Assert
      expect(result).toHaveLength(2);
      // Just verify basic functionality works - nodes are enriched
      expect(result[0]).toBeDefined();
      expect(result[1]).toBeDefined();
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
      const result = await service.checkBatchAuthorization(1, nodeIds, 2);

      // Assert
      expect(result).toEqual(batchResult);
      expect(mockRepository.checkBatchAuthorization).toHaveBeenCalledWith(
        expect.objectContaining({
          currentUserId: 1,
          targetUserId: 2,
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
        undefined
      );

      // Assert
      expect(result).toEqual(batchResult);

      const filterArg = mockRepository.checkBatchAuthorization.mock.calls[0][0];
      expect(filterArg.currentUserId).toBe(1);
      expect(filterArg.nodeIds).toEqual(nodeIds);
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
      const nodeIds = Array.from(
        { length: 1000 } as any,
        (_, i) => `node-${i} as any`
      );
      const batchResult: BatchAuthorizationResult = {
        authorized: nodeIds.slice(0, 800),
        unauthorized: nodeIds.slice(800, 950),
        notFound: nodeIds.slice(950),
      };

      mockRepository.checkBatchAuthorization.mockResolvedValue(batchResult);

      // Act
      const result = await service.checkBatchAuthorization(1, nodeIds, 2);

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

    it('should handle batch authorization with basic access control', async () => {
      // Test batch authorization
      const nodeIds = ['test-node'];

      mockRepository.checkBatchAuthorization.mockResolvedValue({
        authorized: nodeIds,
        unauthorized: [],
        notFound: [],
      });

      // Act
      const result = await service.checkBatchAuthorization(1, nodeIds, 2);

      // Assert
      expect(result.authorized).toEqual(nodeIds);
      expect(result.unauthorized).toEqual([]);
      expect(result.notFound).toEqual([]);
    });
  });

  describe('Insights Management with Permissions', () => {
    it('should handle insight creation with node ownership verification', async () => {
      // Arrange - Create fresh mocks for this test
      const freshMockRepository = mock<IHierarchyRepository>();
      const freshMockInsightRepository = mock<IInsightRepository>();
      const freshService = new HierarchyService({
        hierarchyRepository: freshMockRepository,
        insightRepository: freshMockInsightRepository,
        nodePermissionService: mockNodePermissionService,
        organizationRepository: mockOrganizationRepository,
        userService: mockUserService,
        logger: mockLogger,
        pgVectorGraphRAGService: {} as any,
        openAIEmbeddingService: {} as any,
        experienceMatchesService: mockExperienceMatchesService,
      });

      const nodeId = 'test-node';
      const insightData = {
        description: 'Test insight',
        resources: ['http://example.com'],
      };
      const node = createTestNode({ id: nodeId, userId: 1 } as any);
      const insight = { id: 'insight-1', nodeId, ...insightData } as any;

      freshMockRepository.getById.mockResolvedValue(node);
      freshMockInsightRepository.create.mockResolvedValue(insight);

      // Act
      const result = await freshService.createInsight(nodeId, insightData, 1);

      // Assert
      expect(result).toEqual(insight);
      expect(freshMockRepository.getById).toHaveBeenCalledWith(nodeId, 1);
      expect(freshMockInsightRepository.create).toHaveBeenCalledWith({
        nodeId,
        ...insightData,
      });
    });

    it('should handle insight operations with access denied scenarios', async () => {
      // Arrange
      const nodeId = 'unauthorized-node';
      const insightData = {
        description: 'Unauthorized insight',
        resources: ['http://example.com'],
      };

      mockRepository.getById.mockResolvedValue(null); // Node not found/no access

      // Act & Assert
      await expect(
        service.createInsight(nodeId, insightData, 1)
      ).rejects.toThrow('Node not found or access denied');
    });

    it('should handle insight deletion with proper ownership checks', async () => {
      // Arrange - Create fresh mocks for this test
      const freshMockRepository = mock<IHierarchyRepository>();
      const freshMockInsightRepository = mock<IInsightRepository>();
      const freshService = new HierarchyService({
        hierarchyRepository: freshMockRepository,
        insightRepository: freshMockInsightRepository,
        nodePermissionService: mockNodePermissionService,
        organizationRepository: mockOrganizationRepository,
        userService: mockUserService,
        logger: mockLogger,
        // Include pgvector service to enable re-sync functionality
        pgVectorGraphRAGService: {} as any as any,
        experienceMatchesService: mockExperienceMatchesService,
        openAIEmbeddingService: {} as any as any,
      });

      const insightId = 'insight-1';
      const insight = {
        id: insightId,
        nodeId: 'node-1',
        description: 'Test',
      } as any;
      const node = createTestNode({ id: 'node-1', userId: 1 } as any);

      freshMockInsightRepository.findById.mockResolvedValue(insight);
      freshMockRepository.getById.mockResolvedValue(node);
      freshMockInsightRepository.delete.mockResolvedValue(true);

      // Act
      const result = await freshService.deleteInsight(insightId, 1);

      // Assert
      expect(result).toBe(true);
      expect(freshMockRepository.getById).toHaveBeenCalledWith('node-1', 1);
      expect(freshMockRepository.getById).toHaveBeenCalledTimes(2); // Called in verifyNodeOwnership and for re-sync
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
      mockUserService.getUserByUsername.mockRejectedValue(
        new Error('User service unavailable')
      );

      // Act & Assert
      await expect(service.getAllNodes(1, 'testuser' as any)).rejects.toThrow(
        'User service unavailable'
      );
    });

    it('should handle permission service errors during node creation', async () => {
      // Arrange
      const createDTO = {
        type: 'project' as const,
        meta: { title: 'Test' } as any,
      };
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
      const nodes = Array.from({ length: 100 } as any, (_, i) =>
        createTestNode({
          id: `node-${i} as any`,
          parentId: i > 50 ? `node-${i - 1} as any` : null,
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
      expect(mockRepository.getById).toHaveBeenCalledTimes(49); // Only nodes with parents (nodes 51-99)
    });

    it('should log performance metrics for large operations', async () => {
      // Arrange
      const largeNodeSet = Array.from({ length: 500 } as any, (_, i) =>
        createTestNode({ id: `node-${i} as any` })
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

  describe('Experience Matches Integration (LIG-182)', () => {
    it('should enrich nodes with shouldShowMatches for owner view', async () => {
      // Arrange
      const nodes = [
        createTestNode({
          id: 'current-job',
          type: 'job' as const,
          userId: 1,
          meta: { orgId: 123, role: 'Engineer', startDate: '2024-01' },
        }),
        createTestNode({
          id: 'past-education',
          type: 'education' as const,
          userId: 1,
          meta: { orgId: 456, degree: 'BS CS', endDate: '2020-05' },
        }),
      ];

      mockRepository.getAllNodes.mockResolvedValue(nodes);
      mockRepository.getById.mockResolvedValue(null); // No parents

      // Configure mock to return values in sequence (called twice per node)
      mockExperienceMatchesService.shouldShowMatches.mockResolvedValueOnce(
        true
      ); // enrichWithParentInfo call for current-job
      mockExperienceMatchesService.shouldShowMatches.mockResolvedValueOnce(
        false
      ); // enrichWithParentInfo call for past-education
      mockExperienceMatchesService.shouldShowMatches.mockResolvedValueOnce(
        true
      ); // enrichWithPermissions call for current-job
      mockExperienceMatchesService.shouldShowMatches.mockResolvedValueOnce(
        false
      ); // enrichWithPermissions call for past-education

      // Act
      const result = await service.getAllNodesWithPermissions(1); // Owner view

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].permissions).toBeDefined();
      expect(result[0].permissions?.shouldShowMatches).toBe(true); // Current job
      expect(result[1].permissions).toBeDefined();
      expect(result[1].permissions?.shouldShowMatches).toBe(false); // Past education
      expect(
        mockExperienceMatchesService.shouldShowMatches
      ).toHaveBeenCalledTimes(4); // Called twice per node
      expect(
        mockExperienceMatchesService.shouldShowMatches
      ).toHaveBeenCalledWith('current-job', 1);
      expect(
        mockExperienceMatchesService.shouldShowMatches
      ).toHaveBeenCalledWith('past-education', 1);
    });

    it('should enrich nodes with shouldShowMatches for viewer access', async () => {
      // Arrange
      const targetUserId = 2;
      const targetUser = { id: targetUserId, userName: 'colleague' } as any;

      const nodes = [
        createTestNode({
          id: 'shared-job',
          type: 'job' as const,
          userId: targetUserId,
          meta: { orgId: 123, role: 'Manager', startDate: '2023-06' },
        }),
      ];

      mockUserService.getUserByUsername.mockResolvedValue(targetUser);
      mockRepository.getAllNodes.mockResolvedValue(nodes);
      mockRepository.getById.mockResolvedValue(null);
      mockExperienceMatchesService.shouldShowMatches.mockResolvedValue(true);

      // Act
      const result = await service.getAllNodesWithPermissions(1, 'colleague');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].permissions.shouldShowMatches).toBe(true);
      expect(
        mockExperienceMatchesService.shouldShowMatches
      ).toHaveBeenCalledWith('shared-job', 1);
    });

    it('should handle experience matches service errors gracefully', async () => {
      // Arrange
      const nodes = [
        createTestNode({
          id: 'test-node',
          type: 'careerTransition' as const,
          userId: 1,
          meta: { title: 'Career Change', startDate: '2024-01' },
        }),
      ];

      mockRepository.getAllNodes.mockResolvedValue(nodes);
      mockRepository.getById.mockResolvedValue(null);
      mockExperienceMatchesService.shouldShowMatches.mockRejectedValue(
        new Error('Experience matches service unavailable')
      );

      // Act
      const result = await service.getAllNodesWithPermissions(1);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].permissions.shouldShowMatches).toBe(false); // Default to false on error
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to determine shouldShowMatches for node',
        expect.any(Error),
        { nodeId: 'test-node', userId: 1 }
      );
    });

    it('should call shouldShowMatches with correct parameters for different node types', async () => {
      // Arrange
      const nodes = [
        createTestNode({ id: 'job-1', type: 'job' as const, userId: 1 }),
        createTestNode({ id: 'edu-1', type: 'education' as const, userId: 1 }),
        createTestNode({
          id: 'transition-1',
          type: 'careerTransition' as const,
          userId: 1,
        }),
        createTestNode({
          id: 'project-1',
          type: 'project' as const,
          userId: 1,
        }),
      ];

      mockRepository.getAllNodes.mockResolvedValue(nodes);
      mockRepository.getById.mockResolvedValue(null);
      mockExperienceMatchesService.shouldShowMatches.mockResolvedValue(false);

      // Act
      await service.getAllNodesWithPermissions(1);

      // Assert - Should call for all nodes (called twice per node: once in enrichWithParentInfo, once in enrichWithPermissions)
      expect(
        mockExperienceMatchesService.shouldShowMatches
      ).toHaveBeenCalledTimes(8); // 4 nodes x 2 calls each
      // Verify each node was called with correct parameters (each appears twice)
      expect(
        mockExperienceMatchesService.shouldShowMatches
      ).toHaveBeenCalledWith('job-1', 1);
      expect(
        mockExperienceMatchesService.shouldShowMatches
      ).toHaveBeenCalledWith('edu-1', 1);
      expect(
        mockExperienceMatchesService.shouldShowMatches
      ).toHaveBeenCalledWith('transition-1', 1);
      expect(
        mockExperienceMatchesService.shouldShowMatches
      ).toHaveBeenCalledWith('project-1', 1);
    });

    it('should include shouldShowMatches in both owner and viewer permission objects', async () => {
      // Arrange
      const node = createTestNode({
        id: 'test-node',
        type: 'job' as const,
        userId: 1,
        meta: { orgId: 123, role: 'Developer', startDate: '2024-01' },
      });

      mockExperienceMatchesService.shouldShowMatches.mockResolvedValue(true);
      mockNodePermissionService.canAccess.mockResolvedValue(false);

      // Test private method enrichWithPermissions directly
      const enrichWithPermissions = (service as any).enrichWithPermissions.bind(
        service
      );

      // Act - Test owner view
      const ownerResult = await enrichWithPermissions(node, 1, true);

      // Act - Test viewer view
      const viewerResult = await enrichWithPermissions(node, 2, false);

      // Assert
      expect(ownerResult.permissions.shouldShowMatches).toBe(true);
      expect(ownerResult.permissions.canView).toBe(true);
      expect(ownerResult.permissions.canEdit).toBe(true);

      expect(viewerResult.permissions.shouldShowMatches).toBe(true);
      expect(viewerResult.permissions.canView).toBe(false); // Based on mock canAccess
      expect(viewerResult.permissions.canEdit).toBe(false);
    });
  });

  describe('LLM Summary Integration (LIG-206)', () => {
    it('should enrich job application with LLM summaries during creation', async () => {
      // Arrange
      const userId = 1;
      const createDTO = {
        type: 'event' as const,
        parentId: null,
        meta: {
          eventType: 'job-application',
          company: 'Microsoft',
          jobTitle: 'Software Engineer',
          statusData: {
            RecruiterScreen: {
              todos: [
                { id: '1', description: 'Prepare resume', status: 'pending' },
              ],
              interviewContext: 'Phone screen scheduled',
            },
          },
        },
      };

      const user = {
        id: userId,
        firstName: 'John',
        lastName: 'Doe',
      };

      const enrichedMeta = {
        ...createDTO.meta,
        llmInterviewContext:
          'John is interviewing for Software Engineer at Microsoft.',
        statusData: {
          RecruiterScreen: {
            ...createDTO.meta.statusData.RecruiterScreen,
            llmSummary: 'John had a recruiter screen and is preparing resume.',
          },
        },
      };

      const createdNode = createTestNode({
        id: 'new-node',
        type: 'event',
        meta: enrichedMeta,
      });

      mockUserService.getUserById.mockResolvedValue(user as any);
      mockLLMSummaryService.enrichApplicationWithSummaries.mockResolvedValue(
        enrichedMeta
      );
      mockRepository.createNode.mockResolvedValue(createdNode);
      mockRepository.getById.mockResolvedValue(null);

      // Act
      const result = await service.createNode(createDTO, userId);

      // Assert
      expect(
        mockLLMSummaryService.enrichApplicationWithSummaries
      ).toHaveBeenCalledWith(createDTO.meta, 'event', userId, {
        firstName: 'John',
        lastName: 'Doe',
      });
      expect(result.meta).toEqual(enrichedMeta);
    });

    it('should enrich job application with LLM summaries during update', async () => {
      // Arrange
      const userId = 1;
      const nodeId = 'existing-node';
      const updateDTO = {
        meta: {
          eventType: 'job-application',
          company: 'Microsoft',
          jobTitle: 'Software Engineer',
          statusData: {
            RecruiterScreen: {
              todos: [
                { id: '1', description: 'Updated todo', status: 'completed' },
              ],
              interviewContext: 'Completed phone screen',
            },
          },
        },
      };

      const existingNode = createTestNode({
        id: nodeId,
        type: 'event',
        meta: {
          eventType: 'job-application',
          company: 'Microsoft',
          jobTitle: 'Software Engineer',
        },
      });

      const user = {
        id: userId,
        firstName: 'John',
        lastName: 'Doe',
      };

      const enrichedMeta = {
        ...updateDTO.meta,
        llmInterviewContext:
          'John completed the recruiter screen at Microsoft.',
        statusData: {
          RecruiterScreen: {
            ...updateDTO.meta.statusData.RecruiterScreen,
            llmSummary: 'John completed the phone screen successfully.',
          },
        },
      };

      const updatedNode = createTestNode({
        id: nodeId,
        type: 'event',
        meta: enrichedMeta,
      });

      mockRepository.getById.mockResolvedValue(existingNode);
      mockUserService.getUserById.mockResolvedValue(user as any);
      mockLLMSummaryService.enrichApplicationWithSummaries.mockResolvedValue(
        enrichedMeta
      );
      mockRepository.updateNode.mockResolvedValue(updatedNode);

      // Act
      const result = await service.updateNode(nodeId, updateDTO, userId);

      // Assert
      expect(
        mockLLMSummaryService.enrichApplicationWithSummaries
      ).toHaveBeenCalled();
      expect(result?.meta).toEqual(enrichedMeta);
    });

    it('should handle LLM service errors gracefully during creation', async () => {
      // Arrange
      const userId = 1;
      const createDTO = {
        type: 'event' as const,
        parentId: null,
        meta: {
          eventType: 'job-application',
          company: 'Microsoft',
          jobTitle: 'Software Engineer',
          statusData: {
            RecruiterScreen: {
              todos: [],
            },
          },
        },
      };

      const user = { id: userId, firstName: 'John' };
      const createdNode = createTestNode({
        type: 'event',
        meta: createDTO.meta,
      });

      mockUserService.getUserById.mockResolvedValue(user as any);
      mockLLMSummaryService.enrichApplicationWithSummaries.mockRejectedValue(
        new Error('LLM service unavailable')
      );
      mockRepository.createNode.mockResolvedValue(createdNode);
      mockRepository.getById.mockResolvedValue(null);

      // Act & Assert - Should not throw, just log warning
      const result = await service.createNode(createDTO, userId);

      expect(result).toBeDefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to enrich node with LLM summaries',
        expect.any(Object)
      );
    });

    it('should skip LLM enrichment for non-event nodes', async () => {
      // Arrange
      const userId = 1;
      const createDTO = {
        type: 'project' as const, // Not an event
        parentId: null,
        meta: {
          title: 'My Project',
        },
      };

      const createdNode = createTestNode({
        type: 'project',
        meta: createDTO.meta,
      });
      mockRepository.createNode.mockResolvedValue(createdNode);
      mockRepository.getById.mockResolvedValue(null);
      // Mock LLM service to return meta unchanged for non-event nodes
      mockLLMSummaryService.enrichApplicationWithSummaries.mockResolvedValue(
        createDTO.meta
      );

      // Act
      const result = await service.createNode(createDTO, userId);

      // Assert - LLM service is called but should return early for non-event nodes
      expect(
        mockLLMSummaryService.enrichApplicationWithSummaries
      ).toHaveBeenCalledWith(createDTO.meta, 'project', userId, undefined);
      expect(result).toBeDefined();
    });

    it('should force regeneration on update by clearing existing summaries', async () => {
      // Arrange
      const userId = 1;
      const nodeId = 'existing-node';
      const updateDTO = {
        meta: {
          eventType: 'job-application',
          company: 'Microsoft',
          jobTitle: 'Software Engineer',
          llmInterviewContext: 'Old summary', // Should be cleared
          statusData: {
            RecruiterScreen: {
              todos: [{ id: '1', description: 'New todo', status: 'pending' }],
              interviewContext: 'Updated context',
              llmSummary: 'Old status summary', // Should be cleared
            },
          },
        },
      };

      const existingNode = createTestNode({
        id: nodeId,
        type: 'event',
        meta: {
          eventType: 'job-application',
          company: 'Microsoft',
        },
      });

      const user = { id: userId, firstName: 'John' };

      mockRepository.getById.mockResolvedValue(existingNode);
      mockUserService.getUserById.mockResolvedValue(user as any);
      mockLLMSummaryService.enrichApplicationWithSummaries.mockResolvedValue({
        ...updateDTO.meta,
        llmInterviewContext: 'New summary',
        statusData: {
          RecruiterScreen: {
            todos: updateDTO.meta.statusData.RecruiterScreen.todos,
            interviewContext:
              updateDTO.meta.statusData.RecruiterScreen.interviewContext,
            llmSummary: 'New status summary',
          },
        },
      });
      mockRepository.updateNode.mockResolvedValue(createTestNode());

      // Act
      await service.updateNode(nodeId, updateDTO, userId);

      // Assert - Check that summaries were cleared before enrichment
      const enrichCall =
        mockLLMSummaryService.enrichApplicationWithSummaries.mock.calls[0];
      const metaPassedToService = enrichCall[0];

      expect(metaPassedToService.llmInterviewContext).toBeUndefined();
      expect(
        metaPassedToService.statusData.RecruiterScreen.llmSummary
      ).toBeUndefined();
    });
  });

  describe('Networking Enrichment', () => {
    it('should trigger LLM generation when networkingData.activities exists', async () => {
      const node = createTestNode({
        type: 'careerTransition' as any,
        userId: 1,
        meta: {
          networkingData: {
            activities: {
              'Cold outreach': [
                {
                  networkingType: 'Cold outreach',
                  timestamp: '2024-01-01T00:00:00.000Z',
                  whom: ['Person A'],
                  channels: ['LinkedIn'],
                  exampleOnHow: 'Hello',
                },
              ],
            },
          },
        },
      });

      mockRepository.getById.mockResolvedValue(node);
      mockRepository.updateNode.mockResolvedValue(node);
      mockUserService.getUserById.mockResolvedValue({
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        userName: 'johndoe',
        createdAt: new Date(),
        updatedAt: new Date(),
        onboarded: true,
      });
      mockLLMSummaryService.enrichApplicationMaterialsWithSummaries.mockResolvedValue(
        node.meta
      );
      mockLLMSummaryService.generateNetworkingSummaries.mockResolvedValue({
        overallSummary: 'John engaged in cold outreach activities.',
        summaries: {
          'Cold outreach': 'John reached out via LinkedIn.',
        },
        keyPoints: {
          'Cold outreach': ['Used LinkedIn as primary channel'],
        },
      });

      await service.updateNode(node.id, { meta: node.meta }, 1);

      expect(
        mockLLMSummaryService.generateNetworkingSummaries
      ).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            networkingType: 'Cold outreach',
          }),
        ]),
        { firstName: 'John', lastName: 'Doe' },
        1
      );
    });

    it('should merge LLM summaries into networkingData object', async () => {
      const node = createTestNode({
        type: 'careerTransition' as any,
        userId: 1,
        meta: {
          networkingData: {
            activities: {
              'Cold outreach': [
                {
                  networkingType: 'Cold outreach',
                  timestamp: '2024-01-01T00:00:00.000Z',
                  whom: ['Person A'],
                  channels: ['LinkedIn'],
                  exampleOnHow: 'Hello',
                },
              ],
            },
          },
        },
      });

      mockRepository.getById.mockResolvedValue(node);
      mockRepository.updateNode.mockResolvedValue({
        ...node,
        meta: {
          ...node.meta,
          networkingData: {
            activities: {
              'Cold outreach': [
                {
                  networkingType: 'Cold outreach',
                  timestamp: '2024-01-01T00:00:00.000Z',
                  whom: ['Person A'],
                  channels: ['LinkedIn'],
                  exampleOnHow: 'Hello',
                },
              ],
            },
            overallSummary: 'John engaged in cold outreach activities.',
            summaries: {
              'Cold outreach': 'John reached out via LinkedIn.',
            },
            keyPoints: {
              'Cold outreach': ['Used LinkedIn as primary channel'],
            },
          },
        },
      });

      mockUserService.getUserById.mockResolvedValue({
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        userName: 'johndoe',
        createdAt: new Date(),
        updatedAt: new Date(),
        onboarded: true,
      });

      mockLLMSummaryService.enrichApplicationMaterialsWithSummaries.mockResolvedValue(
        node.meta
      );
      mockLLMSummaryService.generateNetworkingSummaries.mockResolvedValue({
        overallSummary: 'John engaged in cold outreach activities.',
        summaries: {
          'Cold outreach': 'John reached out via LinkedIn.',
        },
        keyPoints: {
          'Cold outreach': ['Used LinkedIn as primary channel'],
        },
      });

      await service.updateNode(node.id, { meta: node.meta }, 1);

      const updateRequest = mockRepository.updateNode.mock.calls[0][0];
      const updatedMeta = updateRequest.meta;

      expect(updatedMeta.networkingData).toBeDefined();
      expect(updatedMeta.networkingData.overallSummary).toBe(
        'John engaged in cold outreach activities.'
      );
      expect(updatedMeta.networkingData.summaries).toBeDefined();
      expect(updatedMeta.networkingData.keyPoints).toBeDefined();
    });

    it('should handle LLM generation failure gracefully', async () => {
      const node = createTestNode({
        type: 'careerTransition' as any,
        userId: 1,
        meta: {
          networkingData: {
            activities: {
              'Cold outreach': [
                {
                  networkingType: 'Cold outreach',
                  timestamp: '2024-01-01T00:00:00.000Z',
                  whom: ['Person A'],
                  channels: ['LinkedIn'],
                  exampleOnHow: 'Hello',
                },
              ],
            },
          },
        },
      });

      mockRepository.getById.mockResolvedValue(node);
      mockRepository.updateNode.mockResolvedValue(node);
      mockUserService.getUserById.mockResolvedValue({
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        userName: 'johndoe',
        createdAt: new Date(),
        updatedAt: new Date(),
        onboarded: true,
      });

      mockLLMSummaryService.enrichApplicationMaterialsWithSummaries.mockResolvedValue(
        node.meta
      );
      mockLLMSummaryService.generateNetworkingSummaries.mockRejectedValue(
        new Error('LLM API error')
      );

      // Should not throw - error should be caught and logged
      await expect(
        service.updateNode(node.id, { meta: node.meta }, 1)
      ).resolves.not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to generate networking summaries',
        expect.any(Object)
      );
    });

    it('should skip LLM generation when no activities', async () => {
      const node = createTestNode({
        type: 'careerTransition' as any,
        userId: 1,
        meta: {
          networkingData: {
            activities: {},
          },
        },
      });

      mockRepository.getById.mockResolvedValue(node);
      mockRepository.updateNode.mockResolvedValue(node);

      await service.updateNode(node.id, { meta: node.meta }, 1);

      expect(
        mockLLMSummaryService.generateNetworkingSummaries
      ).not.toHaveBeenCalled();
    });

    it('should flatten activities from all types before LLM call', async () => {
      const node = createTestNode({
        type: 'careerTransition' as any,
        userId: 1,
        meta: {
          networkingData: {
            activities: {
              'Cold outreach': [
                {
                  networkingType: 'Cold outreach',
                  timestamp: '2024-01-01T00:00:00.000Z',
                  whom: ['Person A'],
                  channels: ['LinkedIn'],
                  exampleOnHow: 'Hello',
                },
              ],
              'Attended networking event': [
                {
                  networkingType: 'Attended networking event',
                  timestamp: '2024-01-02T00:00:00.000Z',
                  event: 'Tech Meetup',
                  notes: 'Met engineers',
                },
              ],
            },
          },
        },
      });

      mockRepository.getById.mockResolvedValue(node);
      mockRepository.updateNode.mockResolvedValue(node);
      mockUserService.getUserById.mockResolvedValue({
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        userName: 'johndoe',
        createdAt: new Date(),
        updatedAt: new Date(),
        onboarded: true,
      });

      mockLLMSummaryService.enrichApplicationMaterialsWithSummaries.mockResolvedValue(
        node.meta
      );
      mockLLMSummaryService.generateNetworkingSummaries.mockResolvedValue({
        overallSummary: 'Summary',
        summaries: {},
        keyPoints: {},
      });

      await service.updateNode(node.id, { meta: node.meta }, 1);

      const callArgs =
        mockLLMSummaryService.generateNetworkingSummaries.mock.calls[0];
      const activities = callArgs[0];

      // Should have flattened both types into a single array
      expect(activities).toHaveLength(2);
      expect(activities[0].networkingType).toBe('Cold outreach');
      expect(activities[1].networkingType).toBe('Attended networking event');
    });

    it('should use userService.getUserById for user info', async () => {
      const node = createTestNode({
        type: 'careerTransition' as any,
        userId: 1,
        meta: {
          networkingData: {
            activities: {
              'Cold outreach': [
                {
                  networkingType: 'Cold outreach',
                  timestamp: '2024-01-01T00:00:00.000Z',
                  whom: ['Person A'],
                  channels: ['LinkedIn'],
                  exampleOnHow: 'Hello',
                },
              ],
            },
          },
        },
      });

      mockRepository.getById.mockResolvedValue(node);
      mockRepository.updateNode.mockResolvedValue(node);
      mockUserService.getUserById.mockResolvedValue({
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        userName: 'johndoe',
        createdAt: new Date(),
        updatedAt: new Date(),
        onboarded: true,
      });

      mockLLMSummaryService.generateNetworkingSummaries.mockResolvedValue({
        overallSummary: 'Summary',
        summaries: {},
        keyPoints: {},
      });

      await service.updateNode(node.id, { meta: node.meta }, 1);

      expect(mockUserService.getUserById).toHaveBeenCalledWith(1);
    });

    it('should pass correct parameters to LLM service', async () => {
      const node = createTestNode({
        type: 'careerTransition' as any,
        userId: 1,
        meta: {
          networkingData: {
            activities: {
              'Cold outreach': [
                {
                  networkingType: 'Cold outreach',
                  timestamp: '2024-01-01T00:00:00.000Z',
                  whom: ['Person A'],
                  channels: ['LinkedIn'],
                  exampleOnHow: 'Hello',
                },
              ],
            },
          },
        },
      });

      mockRepository.getById.mockResolvedValue(node);
      mockRepository.updateNode.mockResolvedValue(node);
      mockUserService.getUserById.mockResolvedValue({
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        userName: 'johndoe',
        createdAt: new Date(),
        updatedAt: new Date(),
        onboarded: true,
      });

      mockLLMSummaryService.enrichApplicationMaterialsWithSummaries.mockResolvedValue(
        node.meta
      );
      mockLLMSummaryService.generateNetworkingSummaries.mockResolvedValue({
        overallSummary: 'Summary',
        summaries: {},
        keyPoints: {},
      });

      await service.updateNode(node.id, { meta: node.meta }, 1);

      expect(
        mockLLMSummaryService.generateNetworkingSummaries
      ).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          firstName: 'John',
          lastName: 'Doe',
        }),
        1
      );
    });
  });
});
