/**
 * HierarchyRepository Unit Tests
 * 
 * Comprehensive test suite following TDD methodology for the hierarchical timeline system.
 * Tests all repository operations with proper isolation and mocking.
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { HierarchyRepository, type CreateNodeRequest, type UpdateNodeRequest, type MoveNodeRequest } from '../infrastructure/hierarchy-repository';
import type { TimelineNode } from '../../../shared/schema';
import { HIERARCHY_RULES } from '../../../shared/schema';

// Test data constants
const TEST_USER_ID = 123;
const TEST_NODE_ID = 'test-node-123';
const TEST_PARENT_ID = 'test-parent-456';
const TEST_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Mock nanoid generation
vi.mock('nanoid', () => ({
  nanoid: () => TEST_NODE_ID
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
    execute: { rows: [] as any[] },
  };

  const mockQuery = {
    // Insert methods
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(() => Promise.resolve(mockResults.insert)),
    
    // Select methods  
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve(mockResults.select),
    
    // Update methods
    set: vi.fn().mockReturnThis(),
    
    // Generic promise resolution
    ...mockResults
  };

  const mockDb = {
    insert: vi.fn(() => mockQuery),
    select: vi.fn(() => mockQuery),
    update: vi.fn(() => ({
      ...mockQuery,
      returning: vi.fn(() => Promise.resolve(mockResults.update))
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve(mockResults.delete))
    })),
    execute: vi.fn(() => Promise.resolve(mockResults.execute)),
    
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
    __setExecuteResult: (rows: any[]) => {
      mockResults.execute = { rows };
    },
  } as any;

  return mockDb;
}

// Test data factory
const createTestNode = (overrides: Partial<TimelineNode> = {}): TimelineNode => ({
  id: TEST_NODE_ID,
  type: 'project',
  label: 'Test Project',
  parentId: null,
  meta: { description: 'Test description' },
  userId: TEST_USER_ID,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

const createCareerTransitionNode = (): TimelineNode => createTestNode({
  id: TEST_PARENT_ID,
  type: 'careerTransition',
  label: 'Career Transition',
  meta: { fromRole: 'Developer', toRole: 'Senior Developer' }
});

describe('HierarchyRepository', () => {
  let mockDb: any;
  let repository: HierarchyRepository;

  beforeEach(() => {
    mockDb = createMockDatabase();
    repository = new HierarchyRepository(mockDb, mockLogger);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createNode', () => {
    const createRequest: CreateNodeRequest = {
      type: 'project',
      label: 'Test Project',
      parentId: TEST_PARENT_ID,
      meta: { description: 'A test project' },
      userId: TEST_USER_ID,
    };

    it('should create a new root node successfully', async () => {
      // Arrange
      const rootRequest = { ...createRequest, parentId: null };
      const expectedNode = createTestNode();
      mockDb.__setInsertResult([expectedNode]);

      // Act
      const result = await repository.createNode(rootRequest);

      // Assert
      expect(result).toEqual(expectedNode);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Node created successfully', 
        { nodeId: TEST_NODE_ID, userId: TEST_USER_ID }
      );
    });

    it('should create a child node with valid parent-child relationship', async () => {
      // Arrange
      const parentNode = createCareerTransitionNode();
      const childNode = createTestNode({ parentId: TEST_PARENT_ID });
      
      mockDb.__setSelectResult([parentNode]);
      mockDb.__setInsertResult([childNode]);

      // Act
      const result = await repository.createNode(createRequest);

      // Assert
      expect(result).toEqual(childNode);
      expect(mockDb.select).toHaveBeenCalled(); // Parent validation query
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should throw error for invalid parent-child relationship', async () => {
      // Arrange
      const parentNode = createTestNode({ type: 'project' }); // projects cannot have children
      const invalidRequest = { ...createRequest, type: 'action' };
      
      mockDb.__setSelectResult([parentNode]);

      // Act & Assert
      await expect(repository.createNode(invalidRequest))
        .rejects.toThrow("Node type 'action' cannot be child of 'project'");
    });

    it('should throw error if parent node does not exist', async () => {
      // Arrange
      mockDb.__setSelectResult([]);

      // Act & Assert
      await expect(repository.createNode(createRequest))
        .rejects.toThrow('Parent node not found');
    });

    it('should validate user ownership of parent node', async () => {
      // Arrange
      const differentUserRequest = { ...createRequest, userId: 999 };
      mockDb.__setSelectResult([]); // No parent found for different user

      // Act & Assert
      await expect(repository.createNode(differentUserRequest))
        .rejects.toThrow('Parent node not found');
    });

    it('should generate unique node IDs', async () => {
      // Arrange
      const expectedNode = createTestNode();
      mockDb.__setInsertResult([expectedNode]);

      // Act
      const result = await repository.createNode({ ...createRequest, parentId: null });

      // Assert
      expect(result.id).toBe(TEST_NODE_ID); // Mocked UUID
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should set correct timestamps and metadata', async () => {
      // Arrange
      const nodeWithMeta = createTestNode({
        meta: { custom: 'metadata', projectType: 'professional' }
      });
      const requestWithMeta = {
        ...createRequest,
        parentId: null,
        meta: { custom: 'metadata', projectType: 'professional' }
      };
      mockDb.__setInsertResult([nodeWithMeta]);

      // Act
      const result = await repository.createNode(requestWithMeta);

      // Assert
      expect(result.meta).toEqual({ custom: 'metadata', projectType: 'professional' });
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
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

    it('should enforce user isolation', async () => {
      // Arrange
      mockDb.__setSelectResult([]); // No results for different user

      // Act
      const result = await repository.getById(TEST_NODE_ID, 999);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('updateNode', () => {
    const updateRequest: UpdateNodeRequest = {
      id: TEST_NODE_ID,
      label: 'Updated Label',
      meta: { updated: true },
      userId: TEST_USER_ID,
    };

    it('should update node successfully', async () => {
      // Arrange
      const updatedNode = createTestNode({
        label: 'Updated Label',
        meta: { updated: true },
        updatedAt: new Date('2024-02-01T00:00:00Z')
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

    it('should update only provided fields', async () => {
      // Arrange
      const partialUpdate = { ...updateRequest, meta: undefined };
      const updatedNode = createTestNode({ label: 'Updated Label' });
      mockDb.__setUpdateResult([updatedNode]);

      // Act
      const result = await repository.updateNode(partialUpdate);

      // Assert
      expect(result).toEqual(updatedNode);
    });

    it('should enforce user isolation', async () => {
      // Arrange
      const wrongUserRequest = { ...updateRequest, userId: 999 };
      mockDb.__setUpdateResult([]);

      // Act
      const result = await repository.updateNode(wrongUserRequest);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('deleteNode', () => {
    it('should delete node and orphan children successfully', async () => {
      // Arrange
      mockDb.__setDeleteResult(1); // 1 row affected

      // Act
      const result = await repository.deleteNode(TEST_NODE_ID, TEST_USER_ID);

      // Assert
      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalled(); // Children parentId set to null
      expect(mockDb.delete).toHaveBeenCalled(); // Node deleted
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Node deleted successfully',
        { nodeId: TEST_NODE_ID, userId: TEST_USER_ID }
      );
    });

    it('should return false when node not found', async () => {
      // Arrange
      mockDb.__setDeleteResult(0); // 0 rows affected

      // Act
      const result = await repository.deleteNode('nonexistent', TEST_USER_ID);

      // Assert
      expect(result).toBe(false);
    });

    it('should enforce user isolation', async () => {
      // Arrange
      mockDb.__setDeleteResult(0); // No rows affected for different user

      // Act
      const result = await repository.deleteNode(TEST_NODE_ID, 999);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('getChildren', () => {
    it('should return direct children of a node', async () => {
      // Arrange
      const child1 = createTestNode({ id: 'child-1', parentId: TEST_NODE_ID });
      const child2 = createTestNode({ id: 'child-2', parentId: TEST_NODE_ID });
      mockDb.__setSelectResult([child1, child2]);

      // Act
      const result = await repository.getChildren(TEST_NODE_ID, TEST_USER_ID);

      // Assert
      expect(result).toHaveLength(2);
      expect(result).toEqual([child1, child2]);
    });

    it('should return empty array when no children exist', async () => {
      // Arrange
      mockDb.__setSelectResult([]);

      // Act
      const result = await repository.getChildren(TEST_NODE_ID, TEST_USER_ID);

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should enforce user isolation', async () => {
      // Arrange
      mockDb.__setSelectResult([]); // No children for different user

      // Act
      const result = await repository.getChildren(TEST_NODE_ID, 999);

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('getAncestors', () => {
    it('should return ancestor chain', async () => {
      // Arrange
      const node = createTestNode();
      const parent = createTestNode({ id: 'parent', parentId: null });
      mockDb.__setExecuteResult([node, parent]);

      // Act
      const result = await repository.getAncestors(TEST_NODE_ID, TEST_USER_ID);

      // Assert
      expect(result).toHaveLength(2);
      expect(result).toEqual([node, parent]);
    });

    it('should return empty array for root node', async () => {
      // Arrange
      const rootNode = createTestNode({ parentId: null });
      mockDb.__setExecuteResult([rootNode]);

      // Act
      const result = await repository.getAncestors(TEST_NODE_ID, TEST_USER_ID);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(rootNode);
    });

    it('should enforce user isolation in recursive query', async () => {
      // Arrange
      mockDb.__setExecuteResult([]);

      // Act
      const result = await repository.getAncestors(TEST_NODE_ID, 999);

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('getSubtree', () => {
    it('should return complete subtree with depth information', async () => {
      // Arrange
      const root = createTestNode();
      const child = createTestNode({ id: 'child', parentId: TEST_NODE_ID });
      const grandchild = createTestNode({ id: 'grandchild', parentId: 'child' });
      mockDb.__setExecuteResult([root, child, grandchild]);

      // Act
      const result = await repository.getSubtree(TEST_NODE_ID, TEST_USER_ID);

      // Assert
      expect(result).toHaveLength(3);
      expect(result).toEqual([root, child, grandchild]);
    });

    it('should respect max depth parameter', async () => {
      // Arrange
      const root = createTestNode();
      const child = createTestNode({ id: 'child', parentId: TEST_NODE_ID });
      mockDb.__setExecuteResult([root, child]);

      // Act
      const result = await repository.getSubtree(TEST_NODE_ID, TEST_USER_ID, 1);

      // Assert
      expect(result).toHaveLength(2);
      expect(mockDb.execute).toHaveBeenCalled();
    });

    it('should enforce user isolation in recursive query', async () => {
      // Arrange
      mockDb.__setExecuteResult([]);

      // Act
      const result = await repository.getSubtree(TEST_NODE_ID, 999);

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('getRootNodes', () => {
    it('should return all root nodes for user', async () => {
      // Arrange
      const root1 = createTestNode({ id: 'root-1', parentId: null });
      const root2 = createTestNode({ id: 'root-2', parentId: null });
      mockDb.__setSelectResult([root1, root2]);

      // Act
      const result = await repository.getRootNodes(TEST_USER_ID);

      // Assert
      expect(result).toHaveLength(2);
      expect(result).toEqual([root1, root2]);
    });

    it('should return empty array when no root nodes exist', async () => {
      // Arrange
      mockDb.__setSelectResult([]);

      // Act
      const result = await repository.getRootNodes(TEST_USER_ID);

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('getFullTree', () => {
    it('should build complete hierarchical tree structure', async () => {
      // Arrange
      const root = createTestNode({ id: 'root', parentId: null });
      const child1 = createTestNode({ id: 'child-1', parentId: 'root' });
      const child2 = createTestNode({ id: 'child-2', parentId: 'root' });
      const grandchild = createTestNode({ id: 'grandchild', parentId: 'child-1' });
      
      mockDb.__setSelectResult([root, child1, child2, grandchild]);

      // Act
      const result = await repository.getFullTree(TEST_USER_ID);

      // Assert
      expect(result).toHaveLength(1); // One root node
      expect(result[0]).toMatchObject({ 
        id: 'root',
        children: expect.any(Array)
      });
      expect(result[0].children).toHaveLength(2); // Two direct children
      expect(result[0].children[0].children).toHaveLength(1); // One grandchild
    });

    it('should handle orphaned nodes gracefully', async () => {
      // Arrange - child with non-existent parent
      const orphanedChild = createTestNode({ id: 'orphaned', parentId: 'nonexistent' });
      mockDb.__setSelectResult([orphanedChild]);

      // Act
      const result = await repository.getFullTree(TEST_USER_ID);

      // Assert
      expect(result).toHaveLength(1); // Orphaned node becomes root
      expect(result[0].id).toBe('orphaned');
    });

    it('should return empty array for user with no nodes', async () => {
      // Arrange
      mockDb.__setSelectResult([]);

      // Act
      const result = await repository.getFullTree(TEST_USER_ID);

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('moveNode', () => {
    const moveRequest: MoveNodeRequest = {
      nodeId: TEST_NODE_ID,
      newParentId: TEST_PARENT_ID,
      userId: TEST_USER_ID,
    };

    it('should move node to new parent successfully', async () => {
      // Arrange
      const parent = createCareerTransitionNode();
      const node = createTestNode(); // project node (which can be child of careerTransition)
      const movedNode = createTestNode({ parentId: TEST_PARENT_ID });
      
      // Mock getById calls for both parent and node validation
      let selectCallCount = 0;
      const originalSelect = mockDb.select;
      mockDb.select = vi.fn(() => {
        selectCallCount++;
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          then: (resolve: any) => {
            if (selectCallCount === 1) {
              // First call for parent validation
              return resolve([parent]);
            } else if (selectCallCount === 2) {
              // Second call for node validation  
              return resolve([node]);
            }
            return resolve([]);
          }
        };
      });
      
      mockDb.__setExecuteResult([]); // No cycle detected
      mockDb.__setUpdateResult([movedNode]);

      // Act
      const result = await repository.moveNode(moveRequest);

      // Assert
      expect(result).toEqual(movedNode);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Node moved successfully',
        { nodeId: TEST_NODE_ID, newParentId: TEST_PARENT_ID, userId: TEST_USER_ID }
      );
      
      // Restore
      mockDb.select = originalSelect;
    });

    it('should allow moving node to root (newParentId: null)', async () => {
      // Arrange
      const rootMoveRequest = { ...moveRequest, newParentId: null };
      const movedNode = createTestNode({ parentId: null });
      
      mockDb.__setUpdateResult([movedNode]);

      // Act
      const result = await repository.moveNode(rootMoveRequest);

      // Assert
      expect(result).toEqual(movedNode);
    });

    it('should throw error when move would create cycle', async () => {
      // Arrange - simulate cycle: nodeA -> nodeB -> nodeA
      const ancestor = createTestNode({ id: TEST_NODE_ID });
      mockDb.__setExecuteResult([ancestor]); // Node appears in ancestor chain
      
      const parent = createCareerTransitionNode();
      const node = createTestNode();
      mockDb.__setSelectResult([parent, node]);

      // Act & Assert
      await expect(repository.moveNode(moveRequest))
        .rejects.toThrow('Cannot move node: would create cycle in hierarchy');
    });

    it('should throw error for invalid parent-child type relationship', async () => {
      // Arrange
      const projectParent = createTestNode({ id: TEST_PARENT_ID, type: 'project' });
      const actionNode = createTestNode({ type: 'action' });
      
      // Mock getById calls for both parent and node validation
      let selectCallCount = 0;
      const originalSelect = mockDb.select;
      mockDb.select = vi.fn(() => {
        selectCallCount++;
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          then: (resolve: any) => {
            if (selectCallCount === 1) {
              // First call for parent validation
              return resolve([projectParent]);
            } else if (selectCallCount === 2) {
              // Second call for node validation  
              return resolve([actionNode]);
            }
            return resolve([]);
          }
        };
      });
      mockDb.__setExecuteResult([]); // No cycle

      // Act & Assert
      await expect(repository.moveNode(moveRequest))
        .rejects.toThrow("Node type 'action' cannot be child of 'project'");
        
      // Restore
      mockDb.select = originalSelect;
    });

    it('should throw error when parent node not found', async () => {
      // Arrange
      mockDb.__setSelectResult([]); // No parent found

      // Act & Assert
      await expect(repository.moveNode(moveRequest))
        .rejects.toThrow('Node or parent not found');
    });

    it('should throw error when node to move not found', async () => {
      // Arrange
      const parent = createCareerTransitionNode();
      
      // Mock getById calls for both parent and node validation
      let selectCallCount = 0;
      const originalSelect = mockDb.select;
      mockDb.select = vi.fn(() => {
        selectCallCount++;
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          then: (resolve: any) => {
            if (selectCallCount === 1) {
              // First call for parent validation - parent exists
              return resolve([parent]);
            } else if (selectCallCount === 2) {
              // Second call for node validation - node not found
              return resolve([]);
            }
            return resolve([]);
          }
        };
      });
      mockDb.__setExecuteResult([]); // No cycle

      // Act & Assert
      await expect(repository.moveNode(moveRequest))
        .rejects.toThrow('Node or parent not found');
        
      // Restore
      mockDb.select = originalSelect;
    });
  });

  describe('getNodesByType', () => {
    it('should return all nodes of specified type', async () => {
      // Arrange
      const project1 = createTestNode({ id: 'proj-1', type: 'project' });
      const project2 = createTestNode({ id: 'proj-2', type: 'project' });
      mockDb.__setSelectResult([project1, project2]);

      // Act
      const result = await repository.getNodesByType('project', TEST_USER_ID);

      // Assert
      expect(result).toHaveLength(2);
      expect(result).toEqual([project1, project2]);
    });

    it('should filter by parent when specified', async () => {
      // Arrange
      const childProject = createTestNode({ parentId: TEST_PARENT_ID });
      mockDb.__setSelectResult([childProject]);

      // Act
      const result = await repository.getNodesByType('project', TEST_USER_ID, { parentId: TEST_PARENT_ID });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].parentId).toBe(TEST_PARENT_ID);
    });

    it('should return empty array for non-existent type', async () => {
      // Arrange
      mockDb.__setSelectResult([]);

      // Act
      const result = await repository.getNodesByType('nonexistent', TEST_USER_ID);

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('getHierarchyStats', () => {
    it('should return comprehensive hierarchy statistics', async () => {
      // Arrange
      const nodes = [
        createTestNode({ id: 'root-1', type: 'careerTransition', parentId: null }),
        createTestNode({ id: 'action-1', type: 'action', parentId: 'root-1' }),
        createTestNode({ id: 'project-1', type: 'project', parentId: 'action-1' }),
        createTestNode({ id: 'project-2', type: 'project', parentId: 'action-1' }),
      ];
      mockDb.__setSelectResult(nodes);

      // Act
      const result = await repository.getHierarchyStats(TEST_USER_ID);

      // Assert
      expect(result).toEqual({
        totalNodes: 4,
        nodesByType: {
          careerTransition: 1,
          action: 1,
          project: 2
        },
        maxDepth: 2, // root -> action -> project
        rootNodes: 1
      });
    });

    it('should handle empty hierarchy', async () => {
      // Arrange
      mockDb.__setSelectResult([]);

      // Act
      const result = await repository.getHierarchyStats(TEST_USER_ID);

      // Assert
      expect(result).toEqual({
        totalNodes: 0,
        nodesByType: {},
        maxDepth: 0,
        rootNodes: 0
      });
    });

    it('should calculate correct depth for complex hierarchies', async () => {
      // Arrange - Deep hierarchy: root -> level1 -> level2 -> level3
      const nodes = [
        createTestNode({ id: 'root', type: 'careerTransition', parentId: null }),
        createTestNode({ id: 'level1', type: 'action', parentId: 'root' }),
        createTestNode({ id: 'level2', type: 'project', parentId: 'level1' }),
      ];
      mockDb.__setSelectResult(nodes);

      // Act
      const result = await repository.getHierarchyStats(TEST_USER_ID);

      // Assert
      expect(result.maxDepth).toBe(2); // 0-indexed depth
      expect(result.totalNodes).toBe(3);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully in createNode', async () => {
      // Arrange
      mockDb.insert = vi.fn(() => {
        throw new Error('Database connection failed');
      });

      // Act & Assert
      await expect(repository.createNode({
        type: 'project',
        label: 'Test',
        meta: {},
        userId: TEST_USER_ID,
      })).rejects.toThrow('Database connection failed');
    });

    it('should handle database errors gracefully in complex queries', async () => {
      // Arrange
      mockDb.execute = vi.fn(() => {
        throw new Error('SQL execution failed');
      });

      // Act & Assert
      await expect(repository.getAncestors(TEST_NODE_ID, TEST_USER_ID))
        .rejects.toThrow('SQL execution failed');
    });
  });

  describe('hierarchy rules validation', () => {
    it('should validate all defined hierarchy rules', async () => {
      // Test each parent-child relationship defined in HIERARCHY_RULES
      
      // careerTransition -> action (valid)
      const careerTransition = createTestNode({ 
        id: 'ct-1', 
        type: 'careerTransition' 
      });
      mockDb.__setSelectResult([careerTransition]);
      mockDb.__setInsertResult([createTestNode({ type: 'action' })]);

      const actionRequest: CreateNodeRequest = {
        type: 'action',
        label: 'Test Action',
        parentId: 'ct-1',
        meta: {},
        userId: TEST_USER_ID,
      };

      await expect(repository.createNode(actionRequest)).resolves.toBeDefined();

      // project -> any (invalid - projects are leaf nodes)
      const project = createTestNode({ id: 'proj-1', type: 'project' });
      mockDb.__setSelectResult([project]);

      const invalidRequest: CreateNodeRequest = {
        type: 'action',
        label: 'Invalid',
        parentId: 'proj-1',
        meta: {},
        userId: TEST_USER_ID,
      };

      await expect(repository.createNode(invalidRequest))
        .rejects.toThrow("Node type 'action' cannot be child of 'project'");
    });

    it('should allow all valid parent-child combinations', () => {
      // Verify HIERARCHY_RULES constant matches PRD requirements
      expect(HIERARCHY_RULES).toEqual({
        careerTransition: ['action', 'event', 'project'],
        job: ['project', 'event', 'action'],
        education: ['project', 'event', 'action'],
        action: ['project'],
        event: ['project', 'action'],
        project: [] // Leaf nodes
      });
    });
  });

  describe('concurrency and edge cases', () => {
    it('should handle concurrent node creation', async () => {
      // Arrange
      const node1 = createTestNode({ id: 'node-1' });
      const node2 = createTestNode({ id: 'node-2' });
      
      mockDb.__setInsertResult([node1, node2]);

      const request1: CreateNodeRequest = {
        type: 'project',
        label: 'Project 1',
        meta: {},
        userId: TEST_USER_ID,
      };

      const request2: CreateNodeRequest = {
        type: 'project', 
        label: 'Project 2',
        meta: {},
        userId: TEST_USER_ID,
      };

      // Act
      const [result1, result2] = await Promise.all([
        repository.createNode(request1),
        repository.createNode(request2),
      ]);

      // Assert
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it('should handle nodes with special characters in labels', async () => {
      // Arrange
      const nodeWithSpecialChars = createTestNode({ 
        label: 'Project: "Special" & <Complex> €€€ 中文' 
      });
      mockDb.__setInsertResult([nodeWithSpecialChars]);

      // Act
      const result = await repository.createNode({
        type: 'project',
        label: 'Project: "Special" & <Complex> €€€ 中文',
        meta: {},
        userId: TEST_USER_ID,
      });

      // Assert
      expect(result.label).toBe('Project: "Special" & <Complex> €€€ 中文');
    });

    it('should handle large metadata objects', async () => {
      // Arrange
      const largeMeta = {
        description: 'A'.repeat(1000), // Very long description
        technologies: Array.from({ length: 100 }, (_, i) => `tech-${i}`),
        complexObject: {
          nested: {
            deeply: {
              value: 'test'
            }
          }
        }
      };

      const nodeWithLargeMeta = createTestNode({ meta: largeMeta });
      mockDb.__setInsertResult([nodeWithLargeMeta]);

      // Act
      const result = await repository.createNode({
        type: 'project',
        label: 'Large Meta Project',
        meta: largeMeta,
        userId: TEST_USER_ID,
      });

      // Assert
      expect(result.meta).toEqual(largeMeta);
    });
  });

  describe('user isolation', () => {
    it('should strictly enforce user isolation across all operations', async () => {
      // Arrange
      const user1Id = 100;
      const user2Id = 200;
      
      // User 1's node
      const user1Node = createTestNode({ userId: user1Id });
      
      // User 2 tries to access user 1's node
      mockDb.__setSelectResult([]);

      // Act & Assert - User 2 cannot see user 1's nodes
      const result = await repository.getById(TEST_NODE_ID, user2Id);
      expect(result).toBeNull();

      // User 2 cannot update user 1's nodes
      const updateResult = await repository.updateNode({
        id: TEST_NODE_ID,
        label: 'Hacked',
        userId: user2Id,
      });
      expect(updateResult).toBeNull();

      // User 2 cannot delete user 1's nodes
      mockDb.__setDeleteResult(0);
      const deleteResult = await repository.deleteNode(TEST_NODE_ID, user2Id);
      expect(deleteResult).toBe(false);
    });

    it('should prevent cross-user parent-child relationships', async () => {
      // Arrange - User 1's node
      const user1Parent = createTestNode({ id: 'user1-parent', userId: 100 });
      
      // User 2 tries to create child under user 1's parent
      mockDb.__setSelectResult([]); // No parent found for user 2

      // Act & Assert
      await expect(repository.createNode({
        type: 'project',
        label: 'Cross-user child',
        parentId: 'user1-parent',
        meta: {},
        userId: 200,
      })).rejects.toThrow('Parent node not found');
    });
  });
});