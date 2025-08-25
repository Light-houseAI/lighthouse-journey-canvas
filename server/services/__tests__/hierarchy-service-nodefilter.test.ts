import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { DatabaseFactory } from '../../config/database-factory';
import { TestDatabaseCreator } from '../../config/test-database-creator';
import { Container } from '../../core/container-setup';
import { SERVICE_TOKENS } from '../../core/container-tokens';
// Import types and service
import type { CreateNodeDTO } from '../hierarchy-service';
import { HierarchyService } from '../hierarchy-service';
import type { DatabaseStorage } from '../storage.service';

// Test constants
const TEST_USER_ID = 123;
const TARGET_USER_ID = 456;

describe('HierarchyService with NodeFilter', () => {
  let container: any;
  let hierarchyService: HierarchyService;
  let storage: DatabaseStorage;
  let testDatabaseName: string;
  let pool: Pool;

  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeAll(async () => {
    // Create test-specific database
    const testId = `hierarchy_filter_${Date.now()}`;
    const dbConfig = await DatabaseFactory.createConfig({
      environment: 'test',
      testId,
    });

    testDatabaseName = (dbConfig as any).testDatabaseName;
    pool = new Pool({ connectionString: dbConfig.connectionString });
    const database = drizzle(pool);

    // Configure production container with test database
    container = await Container.configure(database, mockLogger);
    hierarchyService = container.resolve(SERVICE_TOKENS.HIERARCHY_SERVICE);
    storage = container.resolve('storage');
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
    if (testDatabaseName) {
      await TestDatabaseCreator.dropTestDatabase(testDatabaseName);
    }
    Container.reset();
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Clean up any nodes from previous tests
    await pool.query('DELETE FROM timeline_nodes WHERE user_id IN ($1, $2)', [
      TEST_USER_ID,
      TARGET_USER_ID,
    ]);
  });

  afterEach(() => {
    vi.resetAllMocks();
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
      // Arrange - Create a node for target user
      const nodeDTO: CreateNodeDTO = {
        type: 'project',
        meta: { title: 'Shared Project' },
      };

      const createdNode = await hierarchyService.createNode(
        nodeDTO,
        TARGET_USER_ID
      );

      // Create a permission policy allowing TEST_USER_ID to view TARGET_USER_ID's node
      await pool.query(
        `
        INSERT INTO node_policies (node_id, granted_by, subject_type, subject_id, effect, action, level)
        VALUES ($1, $2, 'user', $3, 'ALLOW', 'view', 'full')
      `,
        [createdNode.id, TARGET_USER_ID, TEST_USER_ID]
      );

      // Act
      const result = await hierarchyService.getAllNodes(
        TEST_USER_ID,
        'target_user'
      );

      // Assert - Should now return the node because we added permission
      expect(result).toHaveLength(1);
      expect(result[0].meta?.title).toBe('Shared Project');
      expect(result[0].userId).toBe(TARGET_USER_ID);
    });

    it('should handle viewing own nodes via username', async () => {
      // Arrange - Create nodes for current user
      const nodeDTO: CreateNodeDTO = {
        type: 'job',
        meta: {
          orgId: 1,
          role: 'Software Engineer',
          description: 'My Job Description',
        },
      };

      await hierarchyService.createNode(nodeDTO, TEST_USER_ID);

      // Act - View own nodes via username (should still work like viewing own nodes)
      const result = await hierarchyService.getAllNodes(
        TEST_USER_ID,
        'current_user'
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].meta?.role).toBe('Software Engineer');
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
