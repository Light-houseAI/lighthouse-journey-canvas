/**
 * HierarchyService Unit Tests
 * 
 * Comprehensive test suite for the business logic layer coordinating hierarchy operations.
 * Tests integration of repository and validation services.
 */

import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import just the interfaces we need for testing
import type { CreateNodeDTO, UpdateNodeDTO, NodeWithParent } from '../hierarchy-service';
import type { TimelineNode } from '../../../shared/schema';
import { HierarchyService } from '../hierarchy-service';

// Test constants
const TEST_USER_ID = 123;
const TEST_NODE_ID = 'test-node-123';
const TEST_PARENT_ID = 'test-parent-456';

// Mock repository
const mockRepository = {
  createNode: vi.fn(),
  getById: vi.fn(),
  updateNode: vi.fn(),
  deleteNode: vi.fn(),
  getAllNodes: vi.fn(),
} as any;

// Mock insight repository
const mockInsightRepository = {
  findByNodeId: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findById: vi.fn(),
} as any;


// Mock logger (removed to fix unused variable warning)

describe('HierarchyService', () => {
  let hierarchyService: HierarchyService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    hierarchyService = new HierarchyService({
      hierarchyRepository: mockRepository,
      insightRepository: mockInsightRepository,
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // Helper functions
  const createTestNode = (overrides: Partial<TimelineNode> = {}): TimelineNode => ({
    id: TEST_NODE_ID,
    type: 'project',
    parentId: null,
    meta: {},
    userId: TEST_USER_ID,
    createdAt: new Date('2023-01-01T10:00:00Z'),
    updatedAt: new Date('2023-01-01T10:00:00Z'),
    ...overrides,
  });

  const createNodeWithParent = (node: TimelineNode, parent?: TimelineNode): NodeWithParent => ({
    ...node,
    parent: parent ? {
      id: parent.id,
      type: parent.type,
      title: parent.meta?.title as string
    } : null,
  });

  describe('createNode', () => {
    it('should create node successfully', async () => {
      // Arrange
      const createDTO: CreateNodeDTO = {
        type: 'project',
        meta: { title: 'Test Project' }
      };
      const createdNode = createTestNode();
      const expectedResult = createNodeWithParent(createdNode);

      mockRepository.createNode.mockResolvedValue(createdNode);

      // Act
      const result = await hierarchyService.createNode(createDTO, TEST_USER_ID);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockRepository.createNode).toHaveBeenCalledWith({
        type: 'project',
        parentId: undefined,
        meta: { title: 'Test Project' },
        userId: TEST_USER_ID
      });
    });

    it('should create node with parent', async () => {
      // Arrange
      const createDTO: CreateNodeDTO = {
        type: 'project',
        parentId: TEST_PARENT_ID,
        meta: { title: 'Child Project' }
      };
      const parentNode = createTestNode({ 
        id: TEST_PARENT_ID, 
        type: 'job',
        meta: { title: 'Parent Job' }
      });
      const createdNode = createTestNode({ parentId: TEST_PARENT_ID });
      const expectedResult = createNodeWithParent(createdNode, parentNode);

      mockRepository.createNode.mockResolvedValue(createdNode);
      mockRepository.getById.mockResolvedValue(parentNode);

      // Act
      const result = await hierarchyService.createNode(createDTO, TEST_USER_ID);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockRepository.createNode).toHaveBeenCalledWith({
        type: 'project',
        parentId: TEST_PARENT_ID,
        meta: { title: 'Child Project' },
        userId: TEST_USER_ID
      });
    });
  });

  describe('getNodeById', () => {
    it('should return node with parent info', async () => {
      // Arrange
      const parentNode = createTestNode({ 
        id: TEST_PARENT_ID, 
        type: 'job',
        meta: { title: 'Parent Job' }
      });
      const node = createTestNode({ parentId: TEST_PARENT_ID });
      const expectedResult = createNodeWithParent(node, parentNode);

      mockRepository.getById.mockResolvedValueOnce(node)
                              .mockResolvedValueOnce(parentNode);

      // Act
      const result = await hierarchyService.getNodeById(TEST_NODE_ID, TEST_USER_ID);

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('should return null when node not found', async () => {
      // Arrange
      mockRepository.getById.mockResolvedValue(null);

      // Act
      const result = await hierarchyService.getNodeById(TEST_NODE_ID, TEST_USER_ID);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('updateNode', () => {
    it('should update node successfully', async () => {
      // Arrange
      const updateDTO: UpdateNodeDTO = {
        meta: { title: 'Updated Project' }
      };
      const existingNode = createTestNode();
      const updatedNode = createTestNode({ meta: { title: 'Updated Project' } });
      const expectedResult = createNodeWithParent(updatedNode);

      mockRepository.getById.mockResolvedValue(existingNode);
      mockRepository.updateNode.mockResolvedValue(updatedNode);

      // Act
      const result = await hierarchyService.updateNode(TEST_NODE_ID, updateDTO, TEST_USER_ID);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockRepository.updateNode).toHaveBeenCalledWith({
        id: TEST_NODE_ID,
        userId: TEST_USER_ID,
        meta: { title: 'Updated Project' }
      });
    });

    it('should return null when node not found', async () => {
      // Arrange
      const updateDTO: UpdateNodeDTO = {
        meta: { title: 'Updated Project' }
      };
      mockRepository.updateNode.mockResolvedValue(null);

      // Act
      const result = await hierarchyService.updateNode(TEST_NODE_ID, updateDTO, TEST_USER_ID);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('deleteNode', () => {
    it('should delete node successfully', async () => {
      // Arrange
      const existingNode = createTestNode();
      mockRepository.getById.mockResolvedValue(existingNode);
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
  });

  describe('getAllNodes', () => {
    it('should return all nodes with parent info', async () => {
      // Arrange
      const nodes = [
        createTestNode({ id: 'node-1' }),
        createTestNode({ id: 'node-2' })
      ];
      const expectedResults = nodes.map(node => createNodeWithParent(node));
      
      mockRepository.getAllNodes.mockResolvedValue(nodes);

      // Act
      const result = await hierarchyService.getAllNodes(TEST_USER_ID);

      // Assert
      expect(result).toEqual(expectedResults);
    });
  });

  describe('insights operations', () => {
    describe('getNodeInsights', () => {
      it('should return insights for node', async () => {
        // Arrange
        const node = createTestNode();
        const insights = [{ id: 'insight-1', nodeId: TEST_NODE_ID, content: 'Test insight' }];
        
        mockRepository.getById.mockResolvedValue(node);
        mockInsightRepository.findByNodeId.mockResolvedValue(insights);

        // Act
        const result = await hierarchyService.getNodeInsights(TEST_NODE_ID, TEST_USER_ID);

        // Assert
        expect(result).toEqual(insights);
        expect(mockInsightRepository.findByNodeId).toHaveBeenCalledWith(TEST_NODE_ID);
      });

      it('should throw error when node not found', async () => {
        // Arrange
        mockRepository.getById.mockResolvedValue(null);

        // Act & Assert
        await expect(hierarchyService.getNodeInsights(TEST_NODE_ID, TEST_USER_ID))
          .rejects.toThrow('Node not found or access denied');
      });
    });

    describe('createInsight', () => {
      it('should create insight for node', async () => {
        // Arrange
        const node = createTestNode();
        const insightData = { description: 'New insight', resources: [] };
        const createdInsight = { id: 'insight-1', nodeId: TEST_NODE_ID, ...insightData };
        
        mockRepository.getById.mockResolvedValue(node);
        mockInsightRepository.create.mockResolvedValue(createdInsight);

        // Act
        const result = await hierarchyService.createInsight(TEST_NODE_ID, insightData, TEST_USER_ID);

        // Assert
        expect(result).toEqual(createdInsight);
        expect(mockInsightRepository.create).toHaveBeenCalledWith({
          nodeId: TEST_NODE_ID,
          ...insightData
        });
      });
    });
  });

  describe('error handling', () => {
    it('should handle repository errors in createNode', async () => {
      // Arrange
      const createDTO: CreateNodeDTO = {
        type: 'project',
        meta: { title: 'Test Project' }
      };
      
      mockRepository.createNode.mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(hierarchyService.createNode(createDTO, TEST_USER_ID))
        .rejects.toThrow('Database error');
    });

    it('should handle validation errors', async () => {
      // Arrange
      const createDTO: CreateNodeDTO = {
        type: 'project',
        meta: { title: 'Test Project' }
      };
      
      // Mock repository to throw validation error (handled at repository level now)
      mockRepository.createNode.mockRejectedValue(new Error('Validation failed'));

      // Act & Assert
      await expect(hierarchyService.createNode(createDTO, TEST_USER_ID))
        .rejects.toThrow('Validation failed');
    });
  });
});