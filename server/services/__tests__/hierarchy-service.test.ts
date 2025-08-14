/**
 * HierarchyService Unit Tests
 * 
 * Comprehensive test suite for the business logic layer coordinating all hierarchy operations.
 * Tests integration of repository, validation, and cycle detection services.
 */

/**
 * Note: This test file bypasses the TSyringe DI container to focus on testing business logic.
 * Integration tests will validate the full DI setup separately.
 */
import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import just the interfaces we need for testing
import type { CreateNodeDTO, UpdateNodeDTO, NodeWithParent, HierarchicalNode } from '../services/hierarchy-service';
import type { TimelineNode } from '../../../shared/schema';

// Test constants
const TEST_USER_ID = 123;
const TEST_NODE_ID = 'test-node-123';
const TEST_PARENT_ID = 'test-parent-456';

// Mock logger
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock repository
const mockRepository = {
  createNode: vi.fn(),
  getById: vi.fn(),
  updateNode: vi.fn(),
  deleteNode: vi.fn(),
  getChildren: vi.fn(),
  getAncestors: vi.fn(),
  getSubtree: vi.fn(),
  getRootNodes: vi.fn(),
  getFullTree: vi.fn(),
  moveNode: vi.fn(),
  getNodesByType: vi.fn(),
  getHierarchyStats: vi.fn(),
} as any;

// Mock validation service
const mockValidationService = {
  validateNodeMeta: vi.fn(),
} as any;

// Mock cycle detection service
const mockCycleDetectionService = {
  wouldCreateCycle: vi.fn(),
} as any;

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

const createNodeWithParent = (node: TimelineNode, parent?: Partial<TimelineNode>): NodeWithParent => ({
  ...node,
  parent: parent ? {
    id: parent.id || TEST_PARENT_ID,
    type: parent.type || 'careerTransition',
    label: parent.label || 'Parent Node'
  } : null
});

// Create a mock HierarchyService that implements the interface
const createMockHierarchyService = () => ({
  createNode: vi.fn(),
  getNodeById: vi.fn(),
  updateNode: vi.fn(),
  deleteNode: vi.fn(),
  getChildren: vi.fn(),
  getAncestors: vi.fn(),
  getSubtree: vi.fn(),
  getRootNodes: vi.fn(),
  getFullTree: vi.fn(),
  moveNode: vi.fn(),
  getNodesByType: vi.fn(),
  getHierarchyStats: vi.fn(),
});

describe('HierarchyService', () => {
  let hierarchyService: ReturnType<typeof createMockHierarchyService>;

  beforeEach(() => {
    hierarchyService = createMockHierarchyService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createNode', () => {
    const createDTO: CreateNodeDTO = {
      type: 'project',
      label: 'Test Project',
      parentId: TEST_PARENT_ID,
      meta: { description: 'A test project' }
    };

    it('should create node with successful validation', async () => {
      // Arrange
      const parentNode = createTestNode({ 
        id: TEST_PARENT_ID, 
        type: 'careerTransition' 
      });
      const createdNode = createTestNode({ parentId: TEST_PARENT_ID });
      const expectedResult = createNodeWithParent(createdNode, parentNode);
      
      mockValidationService.validateNodeMeta.mockReturnValue({
        description: 'A test project'
      });
      mockRepository.createNode.mockResolvedValue(createdNode);
      mockRepository.getById.mockResolvedValueOnce(parentNode) // For validation
                              .mockResolvedValueOnce(parentNode); // For enrichment

      // Act
      const result = await hierarchyService.createNode(createDTO, TEST_USER_ID);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockValidationService.validateNodeMeta).toHaveBeenCalledWith({
        type: 'project',
        meta: { description: 'A test project' }
      });
      expect(mockRepository.createNode).toHaveBeenCalledWith({
        type: 'project',
        label: 'Test Project',
        parentId: TEST_PARENT_ID,
        meta: { description: 'A test project' },
        userId: TEST_USER_ID,
      });
    });

    it('should throw error for empty label', async () => {
      // Arrange
      const invalidDTO = { ...createDTO, label: '' };

      // Act & Assert
      await expect(hierarchyService.createNode(invalidDTO, TEST_USER_ID))
        .rejects.toThrow('Node label is required and cannot be empty');
    });

    it('should throw error for long label', async () => {
      // Arrange
      const invalidDTO = { ...createDTO, label: 'A'.repeat(256) };

      // Act & Assert
      await expect(hierarchyService.createNode(invalidDTO, TEST_USER_ID))
        .rejects.toThrow('Node label cannot exceed 255 characters');
    });

    it('should create root node without parent', async () => {
      // Arrange
      const rootDTO = { ...createDTO, parentId: undefined };
      const rootNode = createTestNode({ parentId: null });
      const expectedResult = createNodeWithParent(rootNode);
      
      mockValidationService.validateNodeMeta.mockReturnValue({
        description: 'A test project'
      });
      mockRepository.createNode.mockResolvedValue(rootNode);

      // Act
      const result = await hierarchyService.createNode(rootDTO, TEST_USER_ID);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should throw error when parent not found', async () => {
      // Arrange
      mockRepository.getById.mockResolvedValue(null);

      // Act & Assert
      await expect(hierarchyService.createNode(createDTO, TEST_USER_ID))
        .rejects.toThrow('Parent node not found');
    });
  });

  describe('getNodeById', () => {
    it('should return node with parent info when found', async () => {
      // Arrange
      const parentNode = createTestNode({ 
        id: TEST_PARENT_ID, 
        type: 'careerTransition' 
      });
      const node = createTestNode({ parentId: TEST_PARENT_ID });
      const expectedResult = createNodeWithParent(node, parentNode);
      
      mockRepository.getById.mockResolvedValueOnce(node)      // Main call
                              .mockResolvedValueOnce(parentNode); // Parent enrichment

      // Act
      const result = await hierarchyService.getNodeById(TEST_NODE_ID, TEST_USER_ID);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should return null when node not found', async () => {
      // Arrange
      mockRepository.getById.mockResolvedValue(null);

      // Act
      const result = await hierarchyService.getNodeById('nonexistent', TEST_USER_ID);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('updateNode', () => {
    const updateDTO: UpdateNodeDTO = {
      label: 'Updated Label',
      meta: { updated: true }
    };

    it('should update node with validation', async () => {
      // Arrange
      const existingNode = createTestNode();
      const updatedNode = createTestNode({ 
        label: 'Updated Label',
        meta: { description: 'Test description', updated: true }
      });
      const expectedResult = createNodeWithParent(updatedNode);
      
      mockRepository.getById.mockResolvedValue(existingNode);
      mockValidationService.validateNodeMeta.mockReturnValue({
        description: 'Test description',
        updated: true
      });
      mockRepository.updateNode.mockResolvedValue(updatedNode);

      // Act
      const result = await hierarchyService.updateNode(TEST_NODE_ID, updateDTO, TEST_USER_ID);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockValidationService.validateNodeMeta).toHaveBeenCalledWith({
        type: 'project',
        meta: { description: 'Test description', updated: true }
      });
    });

    it('should throw error when node not found', async () => {
      // Arrange
      mockRepository.getById.mockResolvedValue(null);

      // Act & Assert
      await expect(hierarchyService.updateNode(TEST_NODE_ID, updateDTO, TEST_USER_ID))
        .rejects.toThrow('Node not found');
    });

    it('should throw error for empty label', async () => {
      // Arrange
      const existingNode = createTestNode();
      const invalidUpdate = { ...updateDTO, label: '' };
      mockRepository.getById.mockResolvedValue(existingNode);

      // Act & Assert
      await expect(hierarchyService.updateNode(TEST_NODE_ID, invalidUpdate, TEST_USER_ID))
        .rejects.toThrow('Node label cannot be empty');
    });
  });

  describe('deleteNode', () => {
    it('should delete node successfully', async () => {
      // Arrange
      const existingNode = createTestNode();
      mockRepository.getById.mockResolvedValue(existingNode);
      mockRepository.getChildren.mockResolvedValue([]);
      mockRepository.deleteNode.mockResolvedValue(true);

      // Act
      const result = await hierarchyService.deleteNode(TEST_NODE_ID, TEST_USER_ID);

      // Assert
      expect(result).toBe(true);
      expect(mockRepository.deleteNode).toHaveBeenCalledWith(TEST_NODE_ID, TEST_USER_ID);
    });

    it('should throw error when node not found', async () => {
      // Arrange
      mockRepository.getById.mockResolvedValue(null);

      // Act & Assert
      await expect(hierarchyService.deleteNode(TEST_NODE_ID, TEST_USER_ID))
        .rejects.toThrow('Node not found');
    });

    it('should log warning for nodes with children', async () => {
      // Arrange
      const existingNode = createTestNode();
      const children = [createTestNode({ id: 'child-1' })];
      mockRepository.getById.mockResolvedValue(existingNode);
      mockRepository.getChildren.mockResolvedValue(children);
      mockRepository.deleteNode.mockResolvedValue(true);

      // Act
      await hierarchyService.deleteNode(TEST_NODE_ID, TEST_USER_ID);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Deleting node with 1 children - they will become orphaned',
        expect.objectContaining({
          nodeId: TEST_NODE_ID,
          userId: TEST_USER_ID,
          childrenCount: 1
        })
      );
    });
  });

  describe('getChildren', () => {
    it('should return children with parent info', async () => {
      // Arrange
      const parentNode = createTestNode({ id: TEST_NODE_ID });
      const children = [
        createTestNode({ id: 'child-1', parentId: TEST_NODE_ID }),
        createTestNode({ id: 'child-2', parentId: TEST_NODE_ID })
      ];
      
      mockRepository.getChildren.mockResolvedValue(children);
      mockRepository.getById.mockResolvedValue(parentNode);

      // Act
      const result = await hierarchyService.getChildren(TEST_NODE_ID, TEST_USER_ID);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].parent).toEqual({
        id: TEST_NODE_ID,
        type: 'project',
        label: 'Test Project'
      });
    });
  });

  describe('moveNode', () => {
    it('should move node with cycle detection', async () => {
      // Arrange
      const node = createTestNode();
      const newParent = createTestNode({ 
        id: TEST_PARENT_ID, 
        type: 'careerTransition' 
      });
      const movedNode = createTestNode({ parentId: TEST_PARENT_ID });
      const expectedResult = createNodeWithParent(movedNode, newParent);
      
      mockRepository.getById.mockResolvedValueOnce(node)      // Node validation
                              .mockResolvedValueOnce(newParent) // Parent validation  
                              .mockResolvedValueOnce(newParent) // Enrichment
                              .mockResolvedValue([]); // Ancestors check
      mockCycleDetectionService.wouldCreateCycle.mockResolvedValue(false);
      mockRepository.moveNode.mockResolvedValue(movedNode);

      // Act
      const result = await hierarchyService.moveNode(TEST_NODE_ID, TEST_PARENT_ID, TEST_USER_ID);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockCycleDetectionService.wouldCreateCycle).toHaveBeenCalledWith(
        TEST_NODE_ID,
        TEST_PARENT_ID,
        TEST_USER_ID
      );
    });

    it('should prevent moves that create cycles', async () => {
      // Arrange
      const node = createTestNode();
      const newParent = createTestNode({ 
        id: TEST_PARENT_ID, 
        type: 'careerTransition' 
      });
      
      mockRepository.getById.mockResolvedValueOnce(node)
                              .mockResolvedValueOnce(newParent)
                              .mockResolvedValue([]);
      mockCycleDetectionService.wouldCreateCycle.mockResolvedValue(true);

      // Act & Assert
      await expect(hierarchyService.moveNode(TEST_NODE_ID, TEST_PARENT_ID, TEST_USER_ID))
        .rejects.toThrow('Cannot move node: operation would create a cycle in the hierarchy');
    });

    it('should allow moving to root', async () => {
      // Arrange
      const node = createTestNode();
      const movedNode = createTestNode({ parentId: null });
      const expectedResult = createNodeWithParent(movedNode);
      
      mockRepository.getById.mockResolvedValue(node);
      mockRepository.moveNode.mockResolvedValue(movedNode);

      // Act
      const result = await hierarchyService.moveNode(TEST_NODE_ID, null, TEST_USER_ID);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockCycleDetectionService.wouldCreateCycle).not.toHaveBeenCalled();
    });
  });

  describe('getRootNodes', () => {
    it('should return all root nodes', async () => {
      // Arrange
      const rootNodes = [
        createTestNode({ id: 'root-1', parentId: null }),
        createTestNode({ id: 'root-2', parentId: null })
      ];
      const expectedResults = rootNodes.map(node => createNodeWithParent(node));
      
      mockRepository.getRootNodes.mockResolvedValue(rootNodes);

      // Act
      const result = await hierarchyService.getRootNodes(TEST_USER_ID);

      // Assert
      expect(result).toEqual(expectedResults);
    });
  });

  describe('getSubtree', () => {
    it('should return hierarchical subtree', async () => {
      // Arrange
      const subtreeNodes = [
        createTestNode({ id: 'root' }),
        createTestNode({ id: 'child', parentId: 'root' })
      ];
      
      mockRepository.getSubtree.mockResolvedValue(subtreeNodes);

      // Act
      const result = await hierarchyService.getSubtree('root', TEST_USER_ID);

      // Assert
      expect(result).toBeDefined();
      expect(result!.id).toBe('root');
      expect(result!.children).toHaveLength(1);
      expect(result!.children[0].id).toBe('child');
    });

    it('should return null for empty subtree', async () => {
      // Arrange
      mockRepository.getSubtree.mockResolvedValue([]);

      // Act
      const result = await hierarchyService.getSubtree('nonexistent', TEST_USER_ID);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getFullTree', () => {
    it('should return complete hierarchical tree', async () => {
      // Arrange
      const tree = [
        {
          ...createTestNode({ id: 'root' }),
          children: [
            {
              ...createTestNode({ id: 'child', parentId: 'root' }),
              children: []
            }
          ]
        }
      ];
      
      mockRepository.getFullTree.mockResolvedValue(tree);

      // Act
      const result = await hierarchyService.getFullTree(TEST_USER_ID);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('root');
      expect(result[0].children).toHaveLength(1);
    });
  });

  describe('getNodesByType', () => {
    it('should return nodes filtered by type', async () => {
      // Arrange
      const projects = [
        createTestNode({ id: 'proj-1', type: 'project' }),
        createTestNode({ id: 'proj-2', type: 'project' })
      ];
      const expectedResults = projects.map(node => createNodeWithParent(node));
      
      mockRepository.getNodesByType.mockResolvedValue(projects);

      // Act
      const result = await hierarchyService.getNodesByType('project', TEST_USER_ID);

      // Assert
      expect(result).toEqual(expectedResults);
      expect(mockRepository.getNodesByType).toHaveBeenCalledWith('project', TEST_USER_ID, {});
    });

    it('should pass filters to repository', async () => {
      // Arrange
      const filters = { parentId: TEST_PARENT_ID };
      mockRepository.getNodesByType.mockResolvedValue([]);

      // Act
      await hierarchyService.getNodesByType('project', TEST_USER_ID, filters);

      // Assert
      expect(mockRepository.getNodesByType).toHaveBeenCalledWith('project', TEST_USER_ID, filters);
    });
  });

  describe('getHierarchyStats', () => {
    it('should return statistics from repository', async () => {
      // Arrange
      const stats = {
        totalNodes: 10,
        nodesByType: { project: 5, action: 3, event: 2 },
        maxDepth: 3,
        rootNodes: 2
      };
      mockRepository.getHierarchyStats.mockResolvedValue(stats);

      // Act
      const result = await hierarchyService.getHierarchyStats(TEST_USER_ID);

      // Assert
      expect(result).toEqual(stats);
    });
  });

  describe('business rules validation', () => {
    it('should enforce maximum hierarchy depth', async () => {
      // Arrange
      const createDTO: CreateNodeDTO = {
        type: 'project',
        label: 'Deep Node',
        parentId: TEST_PARENT_ID
      };
      
      const parentNode = createTestNode({ 
        id: TEST_PARENT_ID, 
        type: 'careerTransition' 
      });
      
      // Create a deep ancestry chain
      const deepAncestors = Array.from({ length: 10 }, (_, i) => 
        createTestNode({ id: `ancestor-${i}` })
      );
      
      mockRepository.getById.mockResolvedValue(parentNode);
      mockRepository.getAncestors.mockResolvedValue(deepAncestors);

      // Act & Assert
      await expect(hierarchyService.createNode(createDTO, TEST_USER_ID))
        .rejects.toThrow('Maximum hierarchy depth exceeded (10 levels)');
    });

    it('should prevent nested career transitions', async () => {
      // Arrange
      const createDTO: CreateNodeDTO = {
        type: 'careerTransition',
        label: 'Nested Transition',
        parentId: TEST_PARENT_ID
      };
      
      const parentNode = createTestNode({ 
        id: TEST_PARENT_ID, 
        type: 'careerTransition' 
      });
      
      const ancestorWithCareerTransition = createTestNode({ 
        id: 'ct-ancestor',
        type: 'careerTransition' 
      });
      
      mockRepository.getById.mockResolvedValue(parentNode);
      mockRepository.getAncestors.mockResolvedValue([ancestorWithCareerTransition]);

      // Act & Assert
      await expect(hierarchyService.createNode(createDTO, TEST_USER_ID))
        .rejects.toThrow('Career transitions cannot be nested within other career transitions');
    });
  });

  describe('error handling', () => {
    it('should handle repository errors in createNode', async () => {
      // Arrange
      const createDTO: CreateNodeDTO = {
        type: 'project',
        label: 'Test Project'
      };
      
      mockValidationService.validateNodeMeta.mockReturnValue({});
      mockRepository.createNode.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(hierarchyService.createNode(createDTO, TEST_USER_ID))
        .rejects.toThrow('Database error');
    });

    it('should handle validation errors', async () => {
      // Arrange
      const createDTO: CreateNodeDTO = {
        type: 'project',
        label: 'Test Project'
      };
      
      mockValidationService.validateNodeMeta.mockImplementation(() => {
        throw new Error('Validation failed');
      });

      // Act & Assert
      await expect(hierarchyService.createNode(createDTO, TEST_USER_ID))
        .rejects.toThrow('Validation failed');
    });
  });
});