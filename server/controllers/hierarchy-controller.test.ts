/**
 * HierarchyController API Endpoint Tests
 *
 * Modern test suite using Awilix DI patterns for hierarchical timeline system.
 * Tests core CRUD operations, error handling, and business logic integration.
 */

import type { TimelineNode } from '@shared/schema';
import type { AwilixContainer } from 'awilix';
import { asValue, createContainer } from 'awilix';
import type { Request, Response } from 'express';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';

import { HierarchyController } from './hierarchy-controller';

// Test data constants
const TEST_USER_ID = 123;
const TEST_NODE_ID = '123e4567-e89b-12d3-a456-426614174000';
const TEST_PARENT_ID = '987fcdeb-51a2-43c5-b789-123456789abc';
const MOCK_TIMESTAMP = new Date('2024-01-01T00:00:00Z');

// Mock timeline node for testing
const mockTimelineNode: TimelineNode = {
  id: TEST_NODE_ID,
  type: 'job',
  parentId: null,
  meta: {
    title: 'Software Engineer',
    company: 'TechCorp',
    startDate: '2023-01',
    endDate: '2024-01',
    location: 'Remote',
  },
  userId: TEST_USER_ID,
  createdAt: MOCK_TIMESTAMP,
  updatedAt: MOCK_TIMESTAMP,
};

// Mock services using current HierarchyService interface
const mockHierarchyService = {
  createNode: vi.fn(),
  getNodeById: vi.fn(),
  updateNode: vi.fn(),
  deleteNode: vi.fn(),
  getAllNodes: vi.fn(),
  getAllNodesWithPermissions: vi.fn(),
  createNodeInsight: vi.fn(),
  getNodeInsights: vi.fn(),
  updateNodeInsight: vi.fn(),
  deleteNodeInsight: vi.fn(),
  createInsight: vi.fn(),
  updateInsight: vi.fn(),
  deleteInsight: vi.fn(),
};

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Helper to create mock Express request
const createMockRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    params: {},
    query: {},
    body: {},
    headers: {},
    userId: TEST_USER_ID,
    user: { id: TEST_USER_ID },
    session: { userId: TEST_USER_ID },
    ...overrides,
  }) as Request;

// Helper to create mock Express response
const createMockResponse = (): Response => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe('HierarchyController API Endpoints', () => {
  let controller: HierarchyController;
  let container: AwilixContainer;

  beforeAll(() => {
    // Mock Date for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_TIMESTAMP);
  });

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create Awilix container for testing
    container = createContainer();

    // Register mocks in Awilix container
    container.register({
      hierarchyService: asValue(mockHierarchyService),
      logger: asValue(mockLogger),
    });

    // Create controller instance using Awilix constructor injection pattern
    controller = new HierarchyController({
      hierarchyService: mockHierarchyService as any,
      logger: mockLogger as any,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    container?.dispose?.();
  });

  describe('POST /nodes - Create Node', () => {
    it('should create a new timeline node with valid data', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          type: 'job',
          parentId: TEST_PARENT_ID,
          meta: {
            title: 'Software Engineer',
            company: 'TechCorp',
            startDate: '2023-01',
          },
        },
      });
      const res = createMockResponse();

      mockHierarchyService.createNode.mockResolvedValue(mockTimelineNode);

      // Act
      await controller.createNode(req, res);

      // Assert
      expect(mockHierarchyService.createNode).toHaveBeenCalledWith(
        {
          type: 'job',
          parentId: TEST_PARENT_ID,
          meta: {
            title: 'Software Engineer',
            company: 'TechCorp',
            startDate: '2023-01',
          },
        },
        TEST_USER_ID
      );

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockTimelineNode,
        meta: {
          timestamp: MOCK_TIMESTAMP.toISOString(),
        },
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Creating timeline node',
        expect.any(Object)
      );
    });

    it('should create root node without parentId', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          type: 'careerTransition',
          meta: {
            title: 'Tech Career Start',
            description: 'Starting career in technology',
          },
        },
      });
      const res = createMockResponse();

      const rootNode = {
        ...mockTimelineNode,
        type: 'careerTransition',
        parentId: null,
      };
      mockHierarchyService.createNode.mockResolvedValue(rootNode);

      // Act
      await controller.createNode(req, res);

      // Assert
      expect(mockHierarchyService.createNode).toHaveBeenCalledWith(
        {
          type: 'careerTransition',
          parentId: null,
          meta: {
            title: 'Tech Career Start',
            description: 'Starting career in technology',
          },
        },
        TEST_USER_ID
      );

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Creating timeline node',
        expect.any(Object)
      );
    });

    it('should reject invalid node type', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          type: 'invalid-type',
          meta: { title: 'Test Node' },
        },
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
          message: expect.stringContaining('Invalid enum value'),
        },
      });
    });

    it('should reject empty meta object', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          type: 'job',
          meta: {},
        },
      });
      const res = createMockResponse();

      // Act
      await controller.createNode(req, res);

      // Assert
      expect(mockHierarchyService.createNode).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CREATE_NODE_ERROR',
          message: expect.stringContaining('Meta should not be empty object'),
        },
      });
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          type: 'job',
          meta: { title: 'Test Job' },
        },
      });
      const res = createMockResponse();

      mockHierarchyService.createNode.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act
      await controller.createNode(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'CREATE_NODE_ERROR',
          message: 'Database connection failed',
        },
      });
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('GET /nodes/:id - Get Node By ID', () => {
    it('should return node when found', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_NODE_ID },
      });
      const res = createMockResponse();

      mockHierarchyService.getNodeById.mockResolvedValue(mockTimelineNode);

      // Act
      await controller.getNodeById(req, res);

      // Assert
      expect(mockHierarchyService.getNodeById).toHaveBeenCalledWith(
        TEST_NODE_ID,
        TEST_USER_ID
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockTimelineNode,
        meta: {
          timestamp: MOCK_TIMESTAMP.toISOString(),
        },
      });
    });

    it('should return 404 when node not found', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'non-existent-id' },
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
          message: 'Node not found or access denied',
        },
      });
    });
  });

  describe('PATCH /nodes/:id - Update Node', () => {
    it('should update node with valid data', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_NODE_ID },
        body: {
          meta: {
            title: 'Senior Software Engineer',
            company: 'TechCorp',
            promotion: true,
          },
        },
      });
      const res = createMockResponse();

      const updatedNode = {
        ...mockTimelineNode,
        meta: { ...mockTimelineNode.meta, title: 'Senior Software Engineer' },
      };
      mockHierarchyService.updateNode.mockResolvedValue(updatedNode);

      // Act
      await controller.updateNode(req, res);

      // Assert
      expect(mockHierarchyService.updateNode).toHaveBeenCalledWith(
        TEST_NODE_ID,
        {
          meta: {
            title: 'Senior Software Engineer',
            company: 'TechCorp',
            promotion: true,
          },
        },
        TEST_USER_ID
      );

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedNode,
        meta: {
          timestamp: MOCK_TIMESTAMP.toISOString(),
        },
      });
    });

    it('should return 404 when node not found', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'non-existent-id' },
        body: {
          meta: { title: 'Updated Title' },
        },
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
          message: 'Node not found or access denied',
        },
      });
    });
  });

  describe('DELETE /nodes/:id - Delete Node', () => {
    it('should delete node successfully', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_NODE_ID },
      });
      const res = createMockResponse();

      mockHierarchyService.deleteNode.mockResolvedValue(true);

      // Act
      await controller.deleteNode(req, res);

      // Assert
      expect(mockHierarchyService.deleteNode).toHaveBeenCalledWith(
        TEST_NODE_ID,
        TEST_USER_ID
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: null,
        meta: {
          timestamp: MOCK_TIMESTAMP.toISOString(),
        },
      });
    });

    it('should return 404 when node not found', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'non-existent-id' },
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
          message: 'Node not found or access denied',
        },
      });
    });
  });

  describe('GET /nodes - List All Nodes', () => {
    it('should return all user nodes', async () => {
      // Arrange
      const req = createMockRequest();
      const res = createMockResponse();

      const mockNodes = [
        mockTimelineNode,
        { ...mockTimelineNode, id: 'node-2' },
      ];
      mockHierarchyService.getAllNodesWithPermissions.mockResolvedValue(
        mockNodes
      );

      // Act
      await controller.listNodes(req, res);

      // Assert
      expect(
        mockHierarchyService.getAllNodesWithPermissions
      ).toHaveBeenCalledWith(TEST_USER_ID, undefined);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockNodes,
        meta: {
          timestamp: MOCK_TIMESTAMP.toISOString(),
          count: 2,
        },
      });
    });
  });

  describe('Authentication and User Context', () => {
    it('should extract user ID from req.userId', async () => {
      // Arrange
      const req = createMockRequest({ userId: 456 });
      const res = createMockResponse();

      mockHierarchyService.getAllNodesWithPermissions.mockResolvedValue([]);

      // Act
      await controller.listNodes(req, res);

      // Assert
      expect(
        mockHierarchyService.getAllNodesWithPermissions
      ).toHaveBeenCalledWith(456, undefined);
    });

    it('should extract user ID from req.user.id', async () => {
      // Arrange
      const req = createMockRequest({
        userId: undefined,
        user: { id: 789 },
      });
      const res = createMockResponse();

      mockHierarchyService.getAllNodesWithPermissions.mockResolvedValue([]);

      // Act
      await controller.listNodes(req, res);

      // Assert
      expect(
        mockHierarchyService.getAllNodesWithPermissions
      ).toHaveBeenCalledWith(789, undefined);
    });

    it('should handle authentication errors', async () => {
      // Arrange
      const req = createMockRequest({
        userId: undefined,
        user: undefined,
        session: undefined,
      });
      const res = createMockResponse();

      // Act
      await controller.listNodes(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'User authentication required',
        },
      });
      expect(
        mockHierarchyService.getAllNodesWithPermissions
      ).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
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
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Hierarchy API error',
        expect.objectContaining({
          defaultCode: 'GET_NODE_ERROR',
          error: 'Database connection failed',
        })
      );
    });
  });

  describe('Response Format Consistency', () => {
    it('should maintain consistent success response format', async () => {
      // Arrange
      const req = createMockRequest();
      const res = createMockResponse();

      mockHierarchyService.getAllNodesWithPermissions.mockResolvedValue([
        mockTimelineNode,
      ]);

      // Act
      await controller.listNodes(req, res);

      // Assert
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [mockTimelineNode],
        meta: {
          timestamp: MOCK_TIMESTAMP.toISOString(),
          count: 1,
        },
      });
    });

    it('should maintain consistent error response format', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'invalid-id' },
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
          message: 'Node not found or access denied',
        },
      });
    });
  });
});
