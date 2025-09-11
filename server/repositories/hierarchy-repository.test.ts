/**
 * HierarchyRepository Unit Tests
 *
 * Tests for the hierarchical timeline repository with NodeFilter integration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { HierarchyRepository } from '../hierarchy-repository';
import type {
  CreateNodeRequest,
  UpdateNodeRequest,
} from '../interfaces/hierarchy.repository.interface';
import type { TimelineNode } from '../../../shared/schema';
import { NodeFilter } from '../filters/node-filter';

// Test data constants
const TEST_USER_ID = 123;
const TEST_NODE_ID = 'test-node-123';
const TEST_PARENT_ID = 'test-parent-456';

// Mock randomUUID generation
vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    randomUUID: () => TEST_NODE_ID,
  };
});

// Mock Drizzle ORM functions
vi.mock('drizzle-orm/pg-core', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
  isNotNull: vi.fn(),
  alias: vi.fn(),
  sql: vi.fn(),
}));

// Mock logger
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock database factory
function createMockDatabase() {
  const mockResults = {
    insert: [] as any[],
    select: [] as any[],
    update: [] as any[],
    delete: { rowCount: 0 },
    execute: [] as any[],
  };

  const mockQuery = {
    // Insert methods
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(() => Promise.resolve(mockResults.insert)),

    // Select methods
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve(mockResults.select),

    // Update methods
    set: vi.fn().mockReturnThis(),

    // Transaction methods
    transaction: vi.fn((callback) =>
      callback({
        update: vi.fn(() => mockQuery),
        delete: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve(mockResults.delete)),
        })),
      })
    ),
  };

  const mockDb = {
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

    // Test helpers to set expected results
    __setInsertResult: (result: any[]) => {
      mockResults.insert = result;
    },
    __setSelectResult: (result: any[]) => {
      mockResults.select = result;
    },
    __setUpdateResult: (result: any[]) => {
      mockResults.update = result;
    },
    __setDeleteResult: (rowCount: number) => {
      mockResults.delete = { rowCount };
    },
    __setExecuteResult: (result: any[]) => {
      mockResults.execute = result;
    },
  } as any;

  return mockDb;
}

// Test data factory
const createTestNode = (
  overrides: Partial<TimelineNode> = {}
): TimelineNode => ({
  id: TEST_NODE_ID,
  type: 'project',
  parentId: null,
  meta: { title: 'Test Project', description: 'Test description' },
  userId: TEST_USER_ID,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

describe('HierarchyRepository', () => {
  let mockDb: any;
  let repository: HierarchyRepository;

  beforeEach(() => {
    mockDb = createMockDatabase();
    repository = new HierarchyRepository({
      database: mockDb,
      logger: mockLogger,
    });
    vi.clearAllMocks();
  });

  describe('createNode', () => {
    const createRequest: CreateNodeRequest = {
      type: 'project',
      parentId: TEST_PARENT_ID,
      meta: { title: 'Test Project', description: 'A test project' },
      userId: TEST_USER_ID,
    };

    it('should create a new node successfully', async () => {
      // Arrange
      const expectedNode = createTestNode();
      mockDb.__setInsertResult([expectedNode]);

      // Act
      const result = await repository.createNode(createRequest);

      // Assert
      expect(result).toEqual(expectedNode);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Node created successfully',
        { nodeId: TEST_NODE_ID, userId: TEST_USER_ID }
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      mockDb.insert = vi.fn(() => {
        throw new Error('Database connection failed');
      });

      // Act & Assert
      await expect(repository.createNode(createRequest)).rejects.toThrow(
        'Database connection failed'
      );
    });
  });

  describe('getById', () => {
    it('should return node when found', async () => {
      // Arrange
      const expectedNode = createTestNode();
      mockDb.__setSelectResult([expectedNode]);

      // Act
      const result = await repository.getById(TEST_NODE_ID, TEST_USER_ID);

      // Assert
      expect(result).toEqual(expectedNode);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should return null when node not found', async () => {
      // Arrange
      mockDb.__setSelectResult([]);

      // Act
      const result = await repository.getById('nonexistent', TEST_USER_ID);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('updateNode', () => {
    const updateRequest: UpdateNodeRequest = {
      id: TEST_NODE_ID,
      meta: { title: 'Updated Project', updated: true },
      userId: TEST_USER_ID,
    };

    it('should update node successfully', async () => {
      // Arrange
      const updatedNode = createTestNode({
        meta: { updated: true },
        updatedAt: new Date('2024-02-01T00:00:00Z'),
      });
      mockDb.__setUpdateResult([updatedNode]);

      // Act
      const result = await repository.updateNode(updateRequest);

      // Assert
      expect(result).toEqual(updatedNode);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Node updated successfully',
        { nodeId: TEST_NODE_ID, userId: TEST_USER_ID }
      );
    });

    it('should return null when node not found', async () => {
      // Arrange
      mockDb.__setUpdateResult([]);

      // Act
      const result = await repository.updateNode(updateRequest);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('deleteNode', () => {
    it('should delete node successfully', async () => {
      // Arrange
      mockDb.__setDeleteResult(1);

      // Act
      const result = await repository.deleteNode(TEST_NODE_ID, TEST_USER_ID);

      // Assert
      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Node deleted successfully',
        { nodeId: TEST_NODE_ID, userId: TEST_USER_ID }
      );
    });

    it('should return false when node not found', async () => {
      // Arrange
      mockDb.__setDeleteResult(0);

      // Act
      const result = await repository.deleteNode('nonexistent', TEST_USER_ID);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getAllNodes', () => {
    it('should return all nodes for same user', async () => {
      // Arrange
      const nodes = [createTestNode(), createTestNode({ id: 'node-2' })];
      mockDb.__setSelectResult(nodes);
      const filter = NodeFilter.Of(TEST_USER_ID).build();

      // Act
      const result = await repository.getAllNodes(filter);

      // Assert
      expect(result).toEqual(nodes);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should apply permission filtering for different users', async () => {
      // Arrange
      const permittedNodes = [createTestNode()];
      mockDb.__setExecuteResult(permittedNodes);
      const filter = NodeFilter.Of(TEST_USER_ID).For(999);

      // Act
      const result = await repository.getAllNodes(filter);

      // Assert
      expect(result).toEqual(permittedNodes);
      expect(mockDb.execute).toHaveBeenCalled(); // Raw SQL for recursive permissions
    });

    it('should return empty array when no permissions exist', async () => {
      // Arrange
      mockDb.__setExecuteResult([]);
      const filter = NodeFilter.Of(TEST_USER_ID).For(999);

      // Act
      const result = await repository.getAllNodes(filter);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle database errors in permission queries', async () => {
      // Arrange
      mockDb.execute = vi.fn(() => {
        throw new Error('SQL execution failed');
      });

      const filter = NodeFilter.Of(TEST_USER_ID).For(999);

      // Act & Assert
      await expect(repository.getAllNodes(filter)).rejects.toThrow(
        'SQL execution failed'
      );
    });
  });
});
