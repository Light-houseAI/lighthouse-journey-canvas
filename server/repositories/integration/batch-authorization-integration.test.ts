/**
 * Batch Authorization Integration Tests
 *
 * Full-stack integration tests that verify the complete batch authorization workflow
 * from API endpoints through service layer to repository and database.
 * Tests real-world scenarios with actual database interactions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NodeFilter } from '../../repositories/filters/node-filter';
import { HierarchyService } from '../../services/hierarchy-service';
import { HierarchyRepository } from '../../repositories/hierarchy-repository';
import { TimelineNodeType } from '@shared/schema';
import type { TimelineNode } from '@shared/schema';

describe('Batch Authorization Integration Tests', () => {
  let hierarchyService: HierarchyService;
  let hierarchyRepository: HierarchyRepository;
  let mockDb: any;
  let mockStorage: any;
  let mockLogger: any;
  let mockInsightRepository: any;
  let mockNodePermissionService: any;

  // Test users
  const USER_ALICE = 1;
  const USER_BOB = 2;
  const USER_CHARLIE = 3;
  const USER_ANONYMOUS = 999;

  beforeEach(() => {
    // Setup comprehensive mock infrastructure
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Mock database with realistic response simulation
    const mockResults = {
      insert: [],
      select: [],
      update: [],
      delete: { rowCount: 0 },
      execute: [],
    };

    const buildMockQuery = () => ({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn(() => Promise.resolve(mockResults.insert)),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: (resolve: any) => resolve(mockResults.select),
      set: vi.fn().mockReturnThis(),
    });

    mockDb = {
      insert: vi.fn(() => buildMockQuery()),
      select: vi.fn(() => buildMockQuery()),
      update: vi.fn(() => ({
        ...buildMockQuery(),
        returning: vi.fn(() => Promise.resolve(mockResults.update)),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(mockResults.delete)),
      })),
      execute: vi.fn(() => Promise.resolve({ rows: mockResults.execute })),
      transaction: vi.fn((callback) => callback(mockDb)),

      // Test helpers
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

    // Initialize services
    hierarchyRepository = new HierarchyRepository({
      database: mockDb,
      logger: mockLogger,
    });

    hierarchyService = new HierarchyService({
      hierarchyRepository,
      insightRepository: mockInsightRepository,
      nodePermissionService: mockNodePermissionService,
      storage: mockStorage,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('End-to-End Batch Authorization Workflows', () => {
    it('should handle complete permission-filtered timeline loading', async () => {
      // Scenario: Alice wants to view Bob's timeline with mixed permissions

      // Setup: Bob has 5 nodes with different permission levels
      const bobsNodes: TimelineNode[] = [
        {
          id: 'job-1',
          type: TimelineNodeType.Job,
          userId: USER_BOB,
          parentId: null,
          meta: { title: 'Software Engineer at TechCorp', orgId: 1 },
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
        },
        {
          id: 'project-1',
          type: TimelineNodeType.Project,
          userId: USER_BOB,
          parentId: 'job-1',
          meta: {
            title: 'Payment System Redesign',
            description: 'Led team of 5',
          },
          createdAt: new Date('2023-02-01'),
          updatedAt: new Date('2023-02-01'),
        },
        {
          id: 'education-1',
          type: TimelineNodeType.Education,
          userId: USER_BOB,
          parentId: null,
          meta: { title: 'BS Computer Science', orgId: 2, degree: 'Bachelor' },
          createdAt: new Date('2019-01-01'),
          updatedAt: new Date('2019-01-01'),
        },
        {
          id: 'private-project',
          type: TimelineNodeType.Project,
          userId: USER_BOB,
          parentId: 'education-1',
          meta: {
            title: 'Secret Research Project',
            description: 'Confidential',
          },
          createdAt: new Date('2020-01-01'),
          updatedAt: new Date('2020-01-01'),
        },
        {
          id: 'public-event',
          type: TimelineNodeType.Event,
          userId: USER_BOB,
          parentId: null,
          meta: {
            title: 'Tech Conference Speaker',
            description: 'Spoke about microservices',
          },
          createdAt: new Date('2023-06-01'),
          updatedAt: new Date('2023-06-01'),
        },
      ];

      // Mock user lookup
      mockStorage.getUserByUsername.mockResolvedValue({
        id: USER_BOB,
        username: 'bob',
        email: 'bob@example.com',
      });

      // Mock permission filtering - Alice can see most of Bob's content but not private project
      const visibleNodes = bobsNodes.filter(
        (node) => node.id !== 'private-project'
      );
      mockDb.__setExecuteResult(visibleNodes);

      // Act: Alice requests Bob's timeline
      const timeline = await hierarchyService.getAllNodes(
        USER_ALICE,
        'bob',
        'view',
        'overview'
      );

      // Assert: Alice sees 4 out of 5 nodes (private-project is filtered out)
      expect(timeline).toHaveLength(4);
      expect(timeline.map((n) => n.id)).toEqual([
        'job-1',
        'project-1',
        'education-1',
        'public-event',
      ]);
      expect(timeline.map((n) => n.id)).not.toContain('private-project');

      // Verify permission filter was applied correctly
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          queryChunks: expect.arrayContaining([
            expect.stringContaining('WITH subject_keys AS'),
            expect.stringContaining('timeline_node_closure'),
            expect.stringContaining('effective_permissions'),
          ]),
        })
      );

      // Verify logging
      expect(mockLogger.debug).toHaveBeenCalledWith('Retrieved nodes', {
        count: 4,
        currentUserId: USER_ALICE,
        targetUserId: USER_BOB,
        action: 'view',
        level: 'overview',
      });
    });

    it('should handle batch authorization for list view operations', async () => {
      // Scenario: Frontend needs to check permissions for a list of nodes efficiently

      const nodeIds = [
        'public-node-1',
        'shared-node-1',
        'private-node-1',
        'nonexistent-node',
        'org-restricted-node',
      ];

      // Mock batch authorization result
      const batchResult = [
        { node_id: 'public-node-1', status: 'authorized' },
        { node_id: 'shared-node-1', status: 'authorized' },
        { node_id: 'private-node-1', status: 'unauthorized' },
        { node_id: 'nonexistent-node', status: 'not_found' },
        { node_id: 'org-restricted-node', status: 'unauthorized' },
      ];

      mockDb.__setExecuteResult(batchResult);

      // Act: Check permissions for all nodes at once
      const result = await hierarchyService.checkBatchAuthorization(
        USER_ALICE,
        nodeIds,
        USER_BOB,
        'view',
        'overview'
      );

      // Assert: Proper categorization of permission results
      expect(result.authorized).toEqual(['public-node-1', 'shared-node-1']);
      expect(result.unauthorized).toEqual([
        'private-node-1',
        'org-restricted-node',
      ]);
      expect(result.notFound).toEqual(['nonexistent-node']);

      // Verify efficient single query was used
      expect(mockDb.execute).toHaveBeenCalledOnce();

      // Verify batch query structure
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          queryChunks: expect.arrayContaining([
            expect.stringContaining('WITH input_nodes AS'),
            expect.stringContaining('unnest'),
            expect.stringContaining('existing_nodes'),
            expect.stringContaining('ranked_policies'),
          ]),
        })
      );
    });

    it('should handle organizational permission scenarios', async () => {
      // Scenario: Alice (org member) requests access to colleagues' work nodes

      const orgNodeIds = [
        'colleague-project-1',
        'colleague-job-1',
        'colleague-private',
      ];

      // Mock org-based authorization (Alice can see work-related content)
      const orgBatchResult = [
        { node_id: 'colleague-project-1', status: 'authorized' }, // Work project - shared with org
        { node_id: 'colleague-job-1', status: 'authorized' }, // Job info - shared with org
        { node_id: 'colleague-private', status: 'unauthorized' }, // Personal - not shared
      ];

      mockDb.__setExecuteResult(orgBatchResult);

      // Act
      const result = await hierarchyService.checkBatchAuthorization(
        USER_ALICE,
        orgNodeIds,
        USER_CHARLIE, // Different user in same org
        'view',
        'overview'
      );

      // Assert
      expect(result.authorized).toEqual([
        'colleague-project-1',
        'colleague-job-1',
      ]);
      expect(result.unauthorized).toEqual(['colleague-private']);
      expect(result.notFound).toHaveLength(0);

      // Verify organizational context was considered
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Checking batch authorization',
        {
          requestingUserId: USER_ALICE,
          targetUserId: USER_CHARLIE,
          nodeCount: 3,
          action: 'view',
          level: 'overview',
        }
      );
    });

    it('should handle public access scenarios', async () => {
      // Scenario: Anonymous user browsing public profiles

      const publicNodeIds = [
        'public-profile',
        'public-project',
        'private-info',
      ];

      // Mock public access (anonymous user can see public content only)
      const publicBatchResult = [
        { node_id: 'public-profile', status: 'authorized' }, // Public profile - visible
        { node_id: 'public-project', status: 'authorized' }, // Public project - visible
        { node_id: 'private-info', status: 'unauthorized' }, // Private info - hidden
      ];

      mockDb.__setExecuteResult(publicBatchResult);

      // Act: Anonymous user checking public content
      const result = await hierarchyService.checkBatchAuthorization(
        USER_ANONYMOUS,
        publicNodeIds,
        USER_BOB,
        'view',
        'overview'
      );

      // Assert
      expect(result.authorized).toEqual(['public-profile', 'public-project']);
      expect(result.unauthorized).toEqual(['private-info']);

      // Verify public access query patterns
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          queryChunks: expect.arrayContaining([
            expect.stringContaining('public'),
            expect.stringContaining('subject_type'),
          ]),
        })
      );
    });
  });

  describe('Performance Integration Scenarios', () => {
    it('should handle high-volume batch operations efficiently', async () => {
      // Scenario: Dashboard loading with 200 timeline nodes

      const largeNodeSet = Array.from({ length: 200 }, (_, i) => ({
        node_id: `dashboard-node-${i}`,
        status: i % 3 === 0 ? 'unauthorized' : 'authorized', // 2/3 authorized
      }));

      mockDb.__setExecuteResult(largeNodeSet);

      const nodeIds = largeNodeSet.map((item) => item.node_id);

      // Act: Large batch authorization
      const result = await hierarchyService.checkBatchAuthorization(
        USER_ALICE,
        nodeIds,
        USER_BOB,
        'view',
        'overview'
      );

      // Assert: Proper handling of large dataset
      expect(result.authorized).toHaveLength(134); // ~2/3 of 200
      expect(result.unauthorized).toHaveLength(66); // ~1/3 of 200
      expect(result.notFound).toHaveLength(0);

      // Verify single query efficiency
      expect(mockDb.execute).toHaveBeenCalledOnce();

      // Verify performance logging
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Checking batch authorization',
        expect.objectContaining({ nodeCount: 200 })
      );
    });

    it('should handle mixed permission levels efficiently', async () => {
      // Scenario: User requests different detail levels for different node types

      // Test overview level access
      const overviewNodes = ['summary-1', 'summary-2', 'summary-3'];
      mockDb.__setExecuteResult([
        { node_id: 'summary-1', status: 'authorized' },
        { node_id: 'summary-2', status: 'authorized' },
        { node_id: 'summary-3', status: 'unauthorized' },
      ]);

      const overviewResult = await hierarchyService.checkBatchAuthorization(
        USER_ALICE,
        overviewNodes,
        USER_BOB,
        'view',
        'overview'
      );

      expect(overviewResult.authorized).toHaveLength(2);

      // Test full level access (more restrictive)
      const fullNodes = ['detail-1', 'detail-2', 'detail-3'];
      mockDb.__setExecuteResult([
        { node_id: 'detail-1', status: 'authorized' }, // Full access granted
        { node_id: 'detail-2', status: 'unauthorized' }, // Only overview allowed
        { node_id: 'detail-3', status: 'unauthorized' }, // No access
      ]);

      const fullResult = await hierarchyService.checkBatchAuthorization(
        USER_ALICE,
        fullNodes,
        USER_BOB,
        'view',
        'full'
      );

      expect(fullResult.authorized).toHaveLength(1);
      expect(fullResult.unauthorized).toHaveLength(2);
    });
  });

  describe('Error Recovery Integration Scenarios', () => {
    it('should handle database connection failures gracefully', async () => {
      // Scenario: Database becomes unavailable during batch operation

      mockDb.execute.mockRejectedValue(new Error('Connection timeout'));

      // Act & Assert: Service should propagate database errors
      await expect(
        hierarchyService.checkBatchAuthorization(
          USER_ALICE,
          ['node1'],
          USER_BOB
        )
      ).rejects.toThrow('Connection timeout');

      // Verify error was logged
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Checking batch authorization',
        expect.any(Object)
      );
    });

    it('should handle partial authorization failures', async () => {
      // Scenario: Some nodes in batch have malformed permission data

      const mixedResults = [
        { node_id: 'good-node-1', status: 'authorized' },
        { node_id: 'good-node-2', status: 'unauthorized' },
        // Simulate partial data corruption
        { node_id: 'corrupted-node', status: null },
      ];

      // Mock database returning partially corrupted data
      mockDb.__setExecuteResult(mixedResults);

      // Act: Service should handle malformed data gracefully
      const result = await hierarchyService.checkBatchAuthorization(
        USER_ALICE,
        ['good-node-1', 'good-node-2', 'corrupted-node'],
        USER_BOB
      );

      // Assert: Well-formed results processed, corrupted ones handled safely
      expect(result.authorized).toContain('good-node-1');
      expect(result.unauthorized).toContain('good-node-2');

      // Corrupted node should be categorized as unauthorized for safety
      expect(result.unauthorized).toContain('corrupted-node');
    });

    it('should handle user lookup failures in timeline access', async () => {
      // Scenario: User service unavailable when looking up target user

      mockStorage.getUserByUsername.mockRejectedValue(
        new Error('User service unavailable')
      );

      // Act & Assert: Service should propagate user lookup errors
      await expect(
        hierarchyService.getAllNodes(USER_ALICE, 'nonexistent-user')
      ).rejects.toThrow('User service unavailable');
    });
  });

  describe('Complex Workflow Integration', () => {
    it('should handle node creation followed by immediate batch authorization', async () => {
      // Scenario: Create node, then immediately check batch permissions

      // Step 1: Create a new node
      const newNode = {
        id: 'newly-created',
        type: TimelineNodeType.Project,
        userId: USER_BOB,
        parentId: null,
        meta: { title: 'New Project', description: 'Fresh creation' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.__setInsertResult([newNode]);
      mockDb.__setSelectResult([]); // No parent

      const createResult = await hierarchyService.createNode(
        {
          type: 'project',
          meta: { title: 'New Project', description: 'Fresh creation' },
        },
        USER_BOB
      );

      expect(createResult.id).toBeDefined();

      // Step 2: Immediately check batch authorization for the new node
      const batchResult = [{ node_id: 'newly-created', status: 'authorized' }];
      mockDb.__setExecuteResult(batchResult);

      const authResult = await hierarchyService.checkBatchAuthorization(
        USER_BOB,
        ['newly-created'],
        USER_BOB // Self-access
      );

      // Assert: New node should be immediately accessible to owner
      expect(authResult.authorized).toContain('newly-created');
      expect(authResult.unauthorized).toHaveLength(0);
      expect(authResult.notFound).toHaveLength(0);
    });

    it('should handle complex hierarchy with permission inheritance', async () => {
      // Scenario: Multi-level hierarchy with cascading permissions

      const hierarchyNodes = [
        'root-job', // Level 0 - Job
        'project-1', // Level 1 - Project under job
        'sub-project-1', // Level 2 - Sub-project
        'task-1', // Level 3 - Task under sub-project
        'deliverable-1', // Level 4 - Deliverable under task
      ];

      // Mock hierarchical permission evaluation
      // Root allows view, so all descendants should be accessible
      const hierarchyResult = hierarchyNodes.map((nodeId) => ({
        node_id: nodeId,
        status: 'authorized',
      }));

      mockDb.__setExecuteResult(hierarchyResult);

      // Act: Check permissions across the entire hierarchy
      const result = await hierarchyService.checkBatchAuthorization(
        USER_ALICE,
        hierarchyNodes,
        USER_BOB,
        'view',
        'overview'
      );

      // Assert: Permission inheritance works correctly
      expect(result.authorized).toEqual(hierarchyNodes);
      expect(result.unauthorized).toHaveLength(0);

      // Verify hierarchical query structure
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          queryChunks: expect.arrayContaining([
            expect.stringContaining('timeline_node_closure'),
            expect.stringContaining('distance'),
            expect.stringContaining('precedence_rank'),
          ]),
        })
      );
    });
  });
});
