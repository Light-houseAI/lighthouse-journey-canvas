import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import types and service
import type { CreateNodeDTO } from '../hierarchy-service';
import { HierarchyService } from '../hierarchy-service';
import { TestContainer } from '../../core/test-container-setup';
import { SERVICE_TOKENS } from '../../core/container-tokens';
import type { MockStorageService } from '../../__tests__/mocks/mock-storage.service';

// Test constants
const TEST_USER_ID = 123;
const TARGET_USER_ID = 456;

describe('HierarchyService with NodeFilter', () => {
  let container: any;
  let hierarchyService: HierarchyService;
  let mockStorage: MockStorageService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up test container with in-memory repositories
    const mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    container = TestContainer.configure(mockLogger);
    hierarchyService = container.resolve(SERVICE_TOKENS.HIERARCHY_SERVICE);
    mockStorage = container.resolve('storage');

    // Add test users to storage
    mockStorage.addTestUser({
      id: TEST_USER_ID,
      username: 'current_user',
      email: 'current@example.com',
    });

    mockStorage.addTestUser({
      id: TARGET_USER_ID,
      username: 'target_user',
      email: 'target@example.com',
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
    TestContainer.reset();
  });

  describe('getAllNodes with NodeFilter', () => {
    it("should return user's own nodes when no username provided", async () => {
      // Arrange - Create nodes for the current user
      const nodeDTO: CreateNodeDTO = {
        type: 'project',
        meta: { title: 'My Project' },
      };

      await hierarchyService.createNode(nodeDTO, TEST_USER_ID);

      // Act - Get nodes without username (should use NodeFilter.Of(userId).build())
      const result = await hierarchyService.getAllNodes(TEST_USER_ID);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].meta?.title).toBe('My Project');
      expect(result[0].userId).toBe(TEST_USER_ID);
    });

    it('should return empty array when viewing another user with no permissions', async () => {
      // Arrange - Create nodes for target user
      const nodeDTO: CreateNodeDTO = {
        type: 'project',
        meta: { title: 'Target User Project' },
      };

      await hierarchyService.createNode(nodeDTO, TARGET_USER_ID);

      // Act - Try to view target user's nodes (should use NodeFilter.Of(currentUserId).For(targetUserId))
      const result = await hierarchyService.getAllNodes(
        TEST_USER_ID,
        'target_user'
      );

      // Assert - Should be empty because in-memory repo returns no permissions by default
      expect(result).toHaveLength(0);
    });

    it('should return empty array when username does not exist', async () => {
      // Act - Try to view non-existent user's nodes
      const result = await hierarchyService.getAllNodes(
        TEST_USER_ID,
        'nonexistent_user'
      );

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should return target user nodes when current user has permission', async () => {
      // This test would require setting up permissions in the in-memory repository
      // For now, we'll test that the filter is created correctly

      // Arrange - Create nodes for target user
      const nodeDTO: CreateNodeDTO = {
        type: 'project',
        meta: { title: 'Shared Project' },
      };

      await hierarchyService.createNode(nodeDTO, TARGET_USER_ID);

      // Override the permission check in the in-memory repository to return true
      const hierarchyRepo = container.resolve('hierarchyRepository');
      const originalHasPermission = hierarchyRepo.hasPermissionOnNode;
      hierarchyRepo.hasPermissionOnNode = vi.fn().mockReturnValue(true);

      // Act
      const result = await hierarchyService.getAllNodes(
        TEST_USER_ID,
        'target_user'
      );

      // Assert - Should now return the node because we mocked permission as true
      expect(result).toHaveLength(1);
      expect(result[0].meta?.title).toBe('Shared Project');
      expect(result[0].userId).toBe(TARGET_USER_ID);

      // Restore original method
      hierarchyRepo.hasPermissionOnNode = originalHasPermission;
    });

    it('should handle viewing own nodes via username', async () => {
      // Arrange - Create nodes for current user
      const nodeDTO: CreateNodeDTO = {
        type: 'job',
        meta: { title: 'My Job' },
      };

      await hierarchyService.createNode(nodeDTO, TEST_USER_ID);

      // Act - View own nodes via username (should still work like viewing own nodes)
      const result = await hierarchyService.getAllNodes(
        TEST_USER_ID,
        'current_user'
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].meta?.title).toBe('My Job');
      expect(result[0].userId).toBe(TEST_USER_ID);
    });
  });

  describe('NodeFilter integration', () => {
    it('should log correct filter information', async () => {
      // Arrange
      const mockLogger = container.resolve('logger');

      // Act - View another user's timeline
      await hierarchyService.getAllNodes(TEST_USER_ID, 'target_user');

      // Assert - Check that debug logs contain filter information
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Fetching nodes with permission filter',
        expect.objectContaining({
          currentUserId: TEST_USER_ID,
          targetUserId: TARGET_USER_ID,
          username: 'target_user',
        })
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Retrieved nodes',
        expect.objectContaining({
          count: 0, // No permissions by default
          currentUserId: TEST_USER_ID,
          targetUserId: TARGET_USER_ID,
        })
      );
    });
  });
});
