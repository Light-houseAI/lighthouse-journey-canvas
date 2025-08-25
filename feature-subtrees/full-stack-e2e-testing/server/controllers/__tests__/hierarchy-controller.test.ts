/**
 * HierarchyController API Endpoint Tests
 * 
 * Comprehensive test suite for all REST API endpoints in the hierarchical timeline system.
 * Tests request validation, response formatting, error handling, and business logic integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import type { Request, Response } from 'express';
import { container } from 'tsyringe';

import { HierarchyController } from '../../controllers/hierarchy-controller';
import { HierarchyService } from '../../services/hierarchy-service';
import { ValidationService } from '../../services/validation-service';
import { CycleDetectionService } from '../../services/cycle-detection-service';
import { LEGACY_LEGACY_HIERARCHY_TOKENS } from '../../core/container-tokens';
import type { TimelineNode } from '../../../shared/schema';

// Test data constants
const TEST_USER_ID = 123;
const TEST_NODE_ID = '123e4567-e89b-12d3-a456-426614174000';
const TEST_PARENT_ID = '987fcdeb-51a2-43c5-b789-123456789abc';
const MOCK_TIMESTAMP = new Date('2024-01-01T00:00:00Z');

// Mock timeline node for testing
const mockTimelineNode: TimelineNode = {
  id: TEST_NODE_ID,
  type: 'job',
  label: 'Software Engineer',
  parentId: null,
  meta: {
    company: 'TechCorp',
    startDate: '2023-01',
    endDate: '2024-01',
    location: 'Remote'
  },
  userId: TEST_USER_ID,
  createdAt: MOCK_TIMESTAMP,
  updatedAt: MOCK_TIMESTAMP
};

// Mock services
const mockHierarchyService = {
  createNode: vi.fn(),
  getNodeById: vi.fn(),
  updateNode: vi.fn(),
  deleteNode: vi.fn(),
  getNodesByType: vi.fn(),
  getRootNodes: vi.fn(),
  getChildren: vi.fn(),
  getAncestors: vi.fn(),
  getSubtree: vi.fn(),
  moveNode: vi.fn(),
  getFullTree: vi.fn(),
  getHierarchyStats: vi.fn()
};

const mockValidationService = {
  getSchemaForNodeType: vi.fn(),
  getAllowedChildren: vi.fn()
};

const mockCycleDetectionService = {
  analyzeHierarchyForCycles: vi.fn(),
  getRecoverySuggestions: vi.fn()
};

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

// Helper to create mock Express request
const createMockRequest = (overrides: Partial<Request> = {}): Request => ({
  params: {},
  query: {},
  body: {},
  headers: {},
  userId: TEST_USER_ID,
  user: { id: TEST_USER_ID },
  session: { userId: TEST_USER_ID },
  ...overrides
} as Request);

// Helper to create mock Express response
const createMockResponse = (): Response => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('HierarchyController API Endpoints', () => {
  let controller: HierarchyController;

  beforeAll(() => {
    // Mock Date for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_TIMESTAMP);
  });

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Register mocks in DI container
    container.registerInstance(LEGACY_HIERARCHY_TOKENS.HIERARCHY_SERVICE, mockHierarchyService);
    container.registerInstance(LEGACY_HIERARCHY_TOKENS.VALIDATION_SERVICE, mockValidationService);
    container.registerInstance(LEGACY_HIERARCHY_TOKENS.CYCLE_DETECTION_SERVICE, mockCycleDetectionService);
    container.registerInstance(LEGACY_HIERARCHY_TOKENS.LOGGER, mockLogger);

    // Create controller instance
    controller = new HierarchyController(
      mockHierarchyService as any,
      mockValidationService as any,
      mockCycleDetectionService as any,
      mockLogger as any
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /nodes - Create Node', () => {
    it('should create a new timeline node with valid data', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          type: 'job',
          label: 'Software Engineer',
          parentId: TEST_PARENT_ID,
          meta: {
            company: 'TechCorp',
            startDate: '2023-01'
          }
        }
      });
      const res = createMockResponse();

      mockHierarchyService.createNode.mockResolvedValue(mockTimelineNode);

      // Act
      await controller.createNode(req, res);

      // Assert
      expect(mockHierarchyService.createNode).toHaveBeenCalledWith({
        type: 'job',
        label: 'Software Engineer',
        parentId: TEST_PARENT_ID,
        meta: {
          company: 'TechCorp',
          startDate: '2023-01'
        }
      }, TEST_USER_ID);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockTimelineNode,
        meta: {
          timestamp: MOCK_TIMESTAMP.toISOString()
        }
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Creating timeline node', {
        userId: TEST_USER_ID,
        type: 'job',
        label: 'Software Engineer',
        hasParent: true
      });
    });

    it('should create root node without parentId', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          type: 'careerTransition',
          label: 'Tech Career Start',
          meta: {
            description: 'Starting career in technology'
          }
        }
      });
      const res = createMockResponse();

      const rootNode = { ...mockTimelineNode, type: 'careerTransition', label: 'Tech Career Start', parentId: null };
      mockHierarchyService.createNode.mockResolvedValue(rootNode);

      // Act
      await controller.createNode(req, res);

      // Assert
      expect(mockHierarchyService.createNode).toHaveBeenCalledWith({
        type: 'careerTransition',
        label: 'Tech Career Start',
        parentId: null,
        meta: {
          description: 'Starting career in technology'
        }
      }, TEST_USER_ID);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockLogger.info).toHaveBeenCalledWith('Creating timeline node', {
        userId: TEST_USER_ID,
        type: 'careerTransition',
        label: 'Tech Career Start',
        hasParent: false
      });
    });

    it('should reject invalid node type', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          type: 'invalid-type',
          label: 'Test Node'
        }
      });
      const res = createMockResponse();

      // Act
      await controller.createNode(req, res);

      // Assert
      expect(mockHierarchyService.createNode).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('Invalid enum value')
        }
      });
    });

    it('should reject empty label', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          type: 'job',
          label: ''
        }
      });
      const res = createMockResponse();

      // Act
      await controller.createNode(req, res);

      // Assert
      expect(mockHierarchyService.createNode).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500); // Zod error gets mapped to 500 by default, then error handler changes it
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CREATE_NODE_ERROR',
          message: expect.stringContaining('too_small')
        }
      });
    });

    it('should reject label that exceeds 255 characters', async () => {
      // Arrange
      const longLabel = 'a'.repeat(256);
      const req = createMockRequest({
        body: {
          type: 'job',
          label: longLabel
        }
      });
      const res = createMockResponse();

      // Act
      await controller.createNode(req, res);

      // Assert
      expect(mockHierarchyService.createNode).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500); // Zod error gets mapped to 500 by default
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CREATE_NODE_ERROR',
          message: expect.stringContaining('too_big')
        }
      });
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          type: 'job',
          label: 'Test Job'
        }
      });
      const res = createMockResponse();

      mockHierarchyService.createNode.mockRejectedValue(new Error('Database connection failed'));

      // Act
      await controller.createNode(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CREATE_NODE_ERROR',
          message: 'Database connection failed'
        }
      });
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('GET /nodes/:id - Get Node By ID', () => {
    it('should return node when found', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_NODE_ID }
      });
      const res = createMockResponse();

      mockHierarchyService.getNodeById.mockResolvedValue(mockTimelineNode);

      // Act
      await controller.getNodeById(req, res);

      // Assert
      expect(mockHierarchyService.getNodeById).toHaveBeenCalledWith(TEST_NODE_ID, TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockTimelineNode,
        meta: {
          timestamp: MOCK_TIMESTAMP.toISOString()
        }
      });
    });

    it('should return 404 when node not found', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'non-existent-id' }
      });
      const res = createMockResponse();

      mockHierarchyService.getNodeById.mockResolvedValue(null);

      // Act
      await controller.getNodeById(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NODE_NOT_FOUND',
          message: 'Timeline node not found'
        }
      });
    });

    it('should return 400 when node ID is missing', async () => {
      // Arrange
      const req = createMockRequest({
        params: {}
      });
      const res = createMockResponse();

      // Act
      await controller.getNodeById(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_NODE_ID',
          message: 'Node ID is required'
        }
      });
      expect(mockHierarchyService.getNodeById).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /nodes/:id - Update Node', () => {
    it('should update node with valid data', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_NODE_ID },
        body: {
          label: 'Senior Software Engineer',
          meta: {
            company: 'TechCorp',
            promotion: true
          }
        }
      });
      const res = createMockResponse();

      const updatedNode = { ...mockTimelineNode, label: 'Senior Software Engineer' };
      mockHierarchyService.updateNode.mockResolvedValue(updatedNode);

      // Act
      await controller.updateNode(req, res);

      // Assert
      expect(mockHierarchyService.updateNode).toHaveBeenCalledWith(
        TEST_NODE_ID,
        {
          label: 'Senior Software Engineer',
          meta: {
            company: 'TechCorp',
            promotion: true
          }
        },
        TEST_USER_ID
      );

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedNode,
        meta: {
          timestamp: MOCK_TIMESTAMP.toISOString()
        }
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Updating timeline node', {
        userId: TEST_USER_ID,
        nodeId: TEST_NODE_ID,
        changes: {
          label: 'Senior Software Engineer',
          meta: {
            company: 'TechCorp',
            promotion: true
          }
        }
      });
    });

    it('should update only label when meta is not provided', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_NODE_ID },
        body: {
          label: 'Lead Software Engineer'
        }
      });
      const res = createMockResponse();

      const updatedNode = { ...mockTimelineNode, label: 'Lead Software Engineer' };
      mockHierarchyService.updateNode.mockResolvedValue(updatedNode);

      // Act
      await controller.updateNode(req, res);

      // Assert
      expect(mockHierarchyService.updateNode).toHaveBeenCalledWith(
        TEST_NODE_ID,
        { label: 'Lead Software Engineer' },
        TEST_USER_ID
      );
    });

    it('should update only meta when label is not provided', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_NODE_ID },
        body: {
          meta: {
            skills: ['React', 'Node.js', 'TypeScript']
          }
        }
      });
      const res = createMockResponse();

      const updatedNode = { ...mockTimelineNode };
      mockHierarchyService.updateNode.mockResolvedValue(updatedNode);

      // Act
      await controller.updateNode(req, res);

      // Assert
      expect(mockHierarchyService.updateNode).toHaveBeenCalledWith(
        TEST_NODE_ID,
        {
          meta: {
            skills: ['React', 'Node.js', 'TypeScript']
          }
        },
        TEST_USER_ID
      );
    });

    it('should return 404 when node not found', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'non-existent-id' },
        body: {
          label: 'Updated Label'
        }
      });
      const res = createMockResponse();

      mockHierarchyService.updateNode.mockResolvedValue(null);

      // Act
      await controller.updateNode(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NODE_NOT_FOUND',
          message: 'Timeline node not found'
        }
      });
    });

    it('should reject invalid label length', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_NODE_ID },
        body: {
          label: ''
        }
      });
      const res = createMockResponse();

      // Act
      await controller.updateNode(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500); // Zod validation error
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'UPDATE_NODE_ERROR',
          message: expect.stringContaining('too_small')
        }
      });
      expect(mockHierarchyService.updateNode).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /nodes/:id - Delete Node', () => {
    it('should delete node successfully', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_NODE_ID }
      });
      const res = createMockResponse();

      mockHierarchyService.deleteNode.mockResolvedValue(true);

      // Act
      await controller.deleteNode(req, res);

      // Assert
      expect(mockHierarchyService.deleteNode).toHaveBeenCalledWith(TEST_NODE_ID, TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { deleted: true, nodeId: TEST_NODE_ID },
        meta: {
          timestamp: MOCK_TIMESTAMP.toISOString()
        }
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Deleting timeline node', {
        userId: TEST_USER_ID,
        nodeId: TEST_NODE_ID
      });
    });

    it('should return 404 when node not found', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'non-existent-id' }
      });
      const res = createMockResponse();

      mockHierarchyService.deleteNode.mockResolvedValue(false);

      // Act
      await controller.deleteNode(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NODE_NOT_FOUND',
          message: 'Timeline node not found'
        }
      });
    });
  });

  describe('GET /nodes - List Nodes', () => {
    const mockNodes = [mockTimelineNode, { ...mockTimelineNode, id: 'node-2', label: 'Project Manager' }];

    it('should list all root nodes when no type filter', async () => {
      // Arrange
      const req = createMockRequest();
      const res = createMockResponse();

      mockHierarchyService.getRootNodes.mockResolvedValue(mockNodes);

      // Act
      await controller.listNodes(req, res);

      // Assert
      expect(mockHierarchyService.getRootNodes).toHaveBeenCalledWith(TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockNodes,
        meta: {
          timestamp: MOCK_TIMESTAMP.toISOString()
        }
      });
    });

    it('should filter nodes by type when type query provided', async () => {
      // Arrange
      const req = createMockRequest({
        query: { type: 'job' }
      });
      const res = createMockResponse();

      mockHierarchyService.getNodesByType.mockResolvedValue(mockNodes);

      // Act
      await controller.listNodes(req, res);

      // Assert
      expect(mockHierarchyService.getNodesByType).toHaveBeenCalledWith('job', TEST_USER_ID);
      expect(mockHierarchyService.getRootNodes).not.toHaveBeenCalled();
    });

    it('should handle query parameters correctly', async () => {
      // Arrange
      const req = createMockRequest({
        query: {
          type: 'education',
          maxDepth: '5',
          includeChildren: 'true'
        }
      });
      const res = createMockResponse();

      mockHierarchyService.getNodesByType.mockResolvedValue(mockNodes);

      // Act
      await controller.listNodes(req, res);

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith('Listing timeline nodes', {
        userId: TEST_USER_ID,
        query: {
          type: 'education',
          maxDepth: 5,
          includeChildren: true
        }
      });
    });
  });

  describe('GET /nodes/:id/children - Get Children', () => {
    it('should return children of specified node', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_PARENT_ID }
      });
      const res = createMockResponse();

      const mockChildren = [mockTimelineNode];
      mockHierarchyService.getChildren.mockResolvedValue(mockChildren);

      // Act
      await controller.getChildren(req, res);

      // Assert
      expect(mockHierarchyService.getChildren).toHaveBeenCalledWith(TEST_PARENT_ID, TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockChildren,
        meta: {
          timestamp: MOCK_TIMESTAMP.toISOString()
        }
      });
    });
  });

  describe('GET /nodes/:id/ancestors - Get Ancestors', () => {
    it('should return ancestor chain for specified node', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_NODE_ID }
      });
      const res = createMockResponse();

      const mockAncestors = [{ ...mockTimelineNode, id: TEST_PARENT_ID, label: 'Parent Node' }];
      mockHierarchyService.getAncestors.mockResolvedValue(mockAncestors);

      // Act
      await controller.getAncestors(req, res);

      // Assert
      expect(mockHierarchyService.getAncestors).toHaveBeenCalledWith(TEST_NODE_ID, TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockAncestors,
        meta: {
          timestamp: MOCK_TIMESTAMP.toISOString()
        }
      });
    });
  });

  describe('GET /nodes/:id/subtree - Get Subtree', () => {
    it('should return subtree with default maxDepth', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_NODE_ID }
      });
      const res = createMockResponse();

      const mockSubtree = [mockTimelineNode];
      mockHierarchyService.getSubtree.mockResolvedValue(mockSubtree);

      // Act
      await controller.getSubtree(req, res);

      // Assert
      expect(mockHierarchyService.getSubtree).toHaveBeenCalledWith(TEST_NODE_ID, TEST_USER_ID, 10);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockSubtree,
        meta: {
          timestamp: MOCK_TIMESTAMP.toISOString()
        }
      });
    });

    it('should return subtree with custom maxDepth', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_NODE_ID },
        query: { maxDepth: '3' }
      });
      const res = createMockResponse();

      const mockSubtree = [mockTimelineNode];
      mockHierarchyService.getSubtree.mockResolvedValue(mockSubtree);

      // Act
      await controller.getSubtree(req, res);

      // Assert
      expect(mockHierarchyService.getSubtree).toHaveBeenCalledWith(TEST_NODE_ID, TEST_USER_ID, 3);
    });

    it('should return 404 when subtree root not found', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'non-existent-id' }
      });
      const res = createMockResponse();

      mockHierarchyService.getSubtree.mockResolvedValue(null);

      // Act
      await controller.getSubtree(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NODE_NOT_FOUND',
          message: 'Timeline node not found'
        }
      });
    });
  });

  describe('POST /nodes/:id/move - Move Node', () => {
    it('should move node to new parent', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_NODE_ID },
        body: { newParentId: TEST_PARENT_ID }
      });
      const res = createMockResponse();

      const movedNode = { ...mockTimelineNode, parentId: TEST_PARENT_ID };
      mockHierarchyService.moveNode.mockResolvedValue(movedNode);

      // Act
      await controller.moveNode(req, res);

      // Assert
      expect(mockHierarchyService.moveNode).toHaveBeenCalledWith(
        TEST_NODE_ID,
        TEST_PARENT_ID,
        TEST_USER_ID
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: movedNode,
        meta: {
          timestamp: MOCK_TIMESTAMP.toISOString()
        }
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Moving timeline node', {
        userId: TEST_USER_ID,
        nodeId: TEST_NODE_ID,
        newParentId: TEST_PARENT_ID
      });
    });

    it('should move node to root level (null parent)', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_NODE_ID },
        body: { newParentId: null }
      });
      const res = createMockResponse();

      const movedNode = { ...mockTimelineNode, parentId: null };
      mockHierarchyService.moveNode.mockResolvedValue(movedNode);

      // Act
      await controller.moveNode(req, res);

      // Assert
      expect(mockHierarchyService.moveNode).toHaveBeenCalledWith(
        TEST_NODE_ID,
        null,
        TEST_USER_ID
      );
    });

    it('should return 404 when node to move not found', async () => {
      // Arrange
      const nonExistentId = '999e4567-e89b-12d3-a456-426614174999';
      const req = createMockRequest({
        params: { id: nonExistentId },
        body: { newParentId: TEST_PARENT_ID }
      });
      const res = createMockResponse();

      mockHierarchyService.moveNode.mockResolvedValue(null);

      // Act
      await controller.moveNode(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NODE_NOT_FOUND',
          message: 'Timeline node not found'
        }
      });
    });

    it('should handle cycle detection errors', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_NODE_ID },
        body: { newParentId: TEST_PARENT_ID }
      });
      const res = createMockResponse();

      mockHierarchyService.moveNode.mockRejectedValue(new Error('Cannot move node: would create cycle in hierarchy'));

      // Act
      await controller.moveNode(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'BUSINESS_RULE_VIOLATION',
          message: 'Cannot move node: would create cycle in hierarchy'
        }
      });
    });
  });

  describe('GET /tree - Get Full Tree', () => {
    it('should return complete hierarchical tree', async () => {
      // Arrange
      const req = createMockRequest();
      const res = createMockResponse();

      const mockTree = [
        {
          ...mockTimelineNode,
          children: [
            { ...mockTimelineNode, id: 'child-1', parentId: TEST_NODE_ID, children: [] }
          ]
        }
      ];
      mockHierarchyService.getFullTree.mockResolvedValue(mockTree);

      // Act
      await controller.getFullTree(req, res);

      // Assert
      expect(mockHierarchyService.getFullTree).toHaveBeenCalledWith(TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockTree,
        meta: {
          timestamp: MOCK_TIMESTAMP.toISOString()
        }
      });

      expect(mockLogger.debug).toHaveBeenCalledWith('Getting full hierarchy tree', { userId: TEST_USER_ID });
    });
  });

  describe('GET /roots - Get Root Nodes', () => {
    it('should return all root nodes', async () => {
      // Arrange
      const req = createMockRequest();
      const res = createMockResponse();

      const mockRoots = [mockTimelineNode];
      mockHierarchyService.getRootNodes.mockResolvedValue(mockRoots);

      // Act
      await controller.getRootNodes(req, res);

      // Assert
      expect(mockHierarchyService.getRootNodes).toHaveBeenCalledWith(TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockRoots,
        meta: {
          timestamp: MOCK_TIMESTAMP.toISOString()
        }
      });
    });
  });

  describe('GET /stats - Get Statistics', () => {
    it('should return hierarchy statistics', async () => {
      // Arrange
      const req = createMockRequest();
      const res = createMockResponse();

      const mockStats = {
        totalNodes: 5,
        nodesByType: {
          job: 2,
          project: 3
        },
        maxDepth: 3,
        rootNodes: 2
      };
      mockHierarchyService.getHierarchyStats.mockResolvedValue(mockStats);

      // Act
      await controller.getStats(req, res);

      // Assert
      expect(mockHierarchyService.getHierarchyStats).toHaveBeenCalledWith(TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats,
        meta: {
          timestamp: MOCK_TIMESTAMP.toISOString()
        }
      });
    });
  });

  describe('GET /validate - Validate Hierarchy', () => {
    it('should return hierarchy analysis and recovery suggestions', async () => {
      // Arrange
      const req = createMockRequest();
      const res = createMockResponse();

      const mockAnalysis = {
        hasCycles: false,
        cycles: [],
        orphanedNodes: [],
        maxDepth: 3
      };
      const mockSuggestions = [];

      mockCycleDetectionService.analyzeHierarchyForCycles.mockResolvedValue(mockAnalysis);
      mockCycleDetectionService.getRecoverySuggestions.mockResolvedValue(mockSuggestions);

      // Act
      await controller.validateHierarchy(req, res);

      // Assert
      expect(mockCycleDetectionService.analyzeHierarchyForCycles).toHaveBeenCalledWith(TEST_USER_ID);
      expect(mockCycleDetectionService.getRecoverySuggestions).toHaveBeenCalledWith(TEST_USER_ID);
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          integrity: mockAnalysis,
          suggestions: mockSuggestions
        },
        meta: {
          timestamp: MOCK_TIMESTAMP.toISOString()
        }
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Validating hierarchy integrity', { userId: TEST_USER_ID });
    });
  });

  describe('GET /schema/:type - Get Node Type Schema', () => {
    it('should return schema for valid node type', async () => {
      // Arrange
      const req = createMockRequest({
        params: { type: 'job' }
      });
      const res = createMockResponse();

      const mockSchema = { type: 'object', properties: {} };
      const mockAllowedChildren = ['project', 'event', 'action'];

      mockValidationService.getSchemaForNodeType.mockReturnValue(mockSchema);
      mockValidationService.getAllowedChildren.mockReturnValue(mockAllowedChildren);

      // Act
      await controller.getNodeTypeSchema(req, res);

      // Assert
      expect(mockValidationService.getSchemaForNodeType).toHaveBeenCalledWith('job');
      expect(mockValidationService.getAllowedChildren).toHaveBeenCalledWith('job');
      
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          nodeType: 'job',
          allowedChildren: mockAllowedChildren,
          metaSchema: {
            type: 'object',
            description: 'Node metadata schema - see API documentation for details'
          }
        },
        meta: {
          timestamp: MOCK_TIMESTAMP.toISOString()
        }
      });
    });

    it('should return 400 for invalid node type', async () => {
      // Arrange
      const req = createMockRequest({
        params: { type: 'invalid-type' }
      });
      const res = createMockResponse();

      // Act
      await controller.getNodeTypeSchema(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_NODE_TYPE',
          message: 'Invalid node type specified'
        }
      });
      expect(mockValidationService.getSchemaForNodeType).not.toHaveBeenCalled();
    });

    it('should return 404 when schema not found', async () => {
      // Arrange
      const req = createMockRequest({
        params: { type: 'job' }
      });
      const res = createMockResponse();

      mockValidationService.getSchemaForNodeType.mockReturnValue(null);

      // Act
      await controller.getNodeTypeSchema(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'SCHEMA_NOT_FOUND',
          message: 'Schema not found for node type'
        }
      });
    });
  });

  describe('Authentication and User Context', () => {
    it('should extract user ID from req.userId', async () => {
      // Arrange
      const req = createMockRequest({ userId: 456 });
      const res = createMockResponse();

      mockHierarchyService.getRootNodes.mockResolvedValue([]);

      // Act
      await controller.getRootNodes(req, res);

      // Assert
      expect(mockHierarchyService.getRootNodes).toHaveBeenCalledWith(456);
    });

    it('should extract user ID from req.user.id', async () => {
      // Arrange
      const req = createMockRequest({ 
        userId: undefined, 
        user: { id: 789 } 
      });
      const res = createMockResponse();

      mockHierarchyService.getRootNodes.mockResolvedValue([]);

      // Act
      await controller.getRootNodes(req, res);

      // Assert
      expect(mockHierarchyService.getRootNodes).toHaveBeenCalledWith(789);
    });

    it('should extract user ID from req.session.userId', async () => {
      // Arrange
      const req = createMockRequest({
        userId: undefined,
        user: undefined,
        session: { userId: 999 }
      });
      const res = createMockResponse();

      mockHierarchyService.getRootNodes.mockResolvedValue([]);

      // Act
      await controller.getRootNodes(req, res);

      // Assert
      expect(mockHierarchyService.getRootNodes).toHaveBeenCalledWith(999);
    });

    it('should handle authentication errors', async () => {
      // Arrange
      const req = createMockRequest({
        userId: undefined,
        user: undefined,
        session: undefined
      });
      const res = createMockResponse();

      // Act
      await controller.getRootNodes(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'User authentication required'
        }
      });
      expect(mockHierarchyService.getRootNodes).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should map not found errors to 404', async () => {
      // Arrange
      const req = createMockRequest({ params: { id: TEST_NODE_ID } });
      const res = createMockResponse();

      mockHierarchyService.getNodeById.mockRejectedValue(new Error('Timeline node not found'));

      // Act
      await controller.getNodeById(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Timeline node not found'
        }
      });
    });

    it('should map validation errors to 400', async () => {
      // Arrange
      const req = createMockRequest({
        body: { type: 'job', label: 'Test' }
      });
      const res = createMockResponse();

      mockHierarchyService.createNode.mockRejectedValue(new Error('validation failed for field: meta'));

      // Act
      await controller.createNode(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'validation failed for field: meta'
        }
      });
    });

    it('should map cycle detection errors to 409', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_NODE_ID },
        body: { newParentId: TEST_PARENT_ID }
      });
      const res = createMockResponse();

      mockHierarchyService.moveNode.mockRejectedValue(new Error('circular reference detected'));

      // Act
      await controller.moveNode(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'BUSINESS_RULE_VIOLATION',
          message: 'circular reference detected'
        }
      });
    });

    it('should include stack trace in development environment', async () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const req = createMockRequest({ params: { id: TEST_NODE_ID } });
      const res = createMockResponse();

      const testError = new Error('Test error');
      testError.stack = 'Error: Test error\n    at test.js:1:1';
      mockHierarchyService.getNodeById.mockRejectedValue(testError);

      // Act
      await controller.getNodeById(req, res);

      // Assert
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'GET_NODE_ERROR',
          message: 'Test error',
          details: 'Error: Test error\n    at test.js:1:1'
        }
      });

      // Cleanup
      delete process.env.NODE_ENV;
    });

    it('should log errors appropriately', async () => {
      // Arrange
      const req = createMockRequest({ params: { id: TEST_NODE_ID } });
      const res = createMockResponse();

      const testError = new Error('Database connection failed');
      testError.stack = 'Error: Database connection failed\n    at db.js:42:10';
      mockHierarchyService.getNodeById.mockRejectedValue(testError);

      // Act
      await controller.getNodeById(req, res);

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith('Hierarchy API error', {
        error: 'Database connection failed',
        stack: 'Error: Database connection failed\n    at db.js:42:10',
        defaultCode: 'GET_NODE_ERROR'
      });
    });
  });

  describe('Response Format Consistency', () => {
    it('should maintain consistent success response format', async () => {
      // Arrange
      const req = createMockRequest();
      const res = createMockResponse();

      mockHierarchyService.getRootNodes.mockResolvedValue([mockTimelineNode]);

      // Act
      await controller.getRootNodes(req, res);

      // Assert
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [mockTimelineNode],
        meta: {
          timestamp: MOCK_TIMESTAMP.toISOString()
        }
      });
    });

    it('should maintain consistent error response format', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'invalid-id' }
      });
      const res = createMockResponse();

      mockHierarchyService.getNodeById.mockResolvedValue(null);

      // Act
      await controller.getNodeById(req, res);

      // Assert
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NODE_NOT_FOUND',
          message: 'Timeline node not found'
        }
      });
    });
  });
});