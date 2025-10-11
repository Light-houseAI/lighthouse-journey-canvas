/**
 * HierarchyController API Endpoint Tests
 *
 * Modern test suite using Awilix DI patterns for hierarchical timeline system.
 * Tests core CRUD operations, error handling, and business logic integration.
 */

import type { TimelineNode } from '@journey/schema';
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

import type { IHierarchyService } from '../services/interfaces';
import { HierarchyController } from '../hierarchy-controller.js';

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

// Mock services using proper interface-based mocking
let mockHierarchyService: MockProxy<IHierarchyService>;

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Helper to create mock Express request
const createMockRequest = (overrides: Partial<Request> = {} as any): Request =>
  ({
    params: {} as any,
    query: {} as any,
    body: {} as any,
    headers: {} as any,
    userId: TEST_USER_ID,
    user: { id: TEST_USER_ID } as any,
    session: { userId: TEST_USER_ID } as any,
    ...overrides,
  }) as Request;

// Helper to create mock Express response
const createMockResponse = (): Response => {
  const res = {} as any as Response;
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

    // Create fresh mock instances
    mockHierarchyService = mock<IHierarchyService>();

    // Reset logger mocks
    Object.values(mockLogger).forEach((mock) => {
      if (typeof mock === 'function' && typeof mock.mockReset === 'function') {
        mock.mockReset();
      }
    });

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
          meta: { title: 'Test Node' } as any,
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
          message: expect.any(String),
          details: expect.any(Array),
        },
      });
    });

    it('should reject empty meta object', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          type: 'job',
          meta: {} as any,
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
          message: expect.any(String),
          details: expect.any(Array),
        },
      });
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          type: 'job',
          meta: { title: 'Test Job' } as any,
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
          code: 'DATABASE_ERROR',
          message: 'Database connection failed',
        },
      });
    });
  });

  describe('GET /nodes/:id - Get Node By ID', () => {
    it('should return node when found', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_NODE_ID } as any,
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
      });
    });

    it('should return 404 when node not found', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'non-existent-id' } as any,
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
          code: 'NOT_FOUND',
          message: 'Node not found or access denied',
        },
      });
    });
  });

  describe('PATCH /nodes/:id - Update Node', () => {
    it('should update node with valid data', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_NODE_ID } as any,
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
        meta: { ...mockTimelineNode.meta, title: 'Senior Software Engineer' } as any,
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
      });
    });

    it('should return 404 when node not found', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'non-existent-id' } as any,
        body: {
          meta: { title: 'Updated Title' } as any,
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
          code: 'NOT_FOUND',
          message: 'Node not found or access denied',
        },
      });
    });
  });

  describe('DELETE /nodes/:id - Delete Node', () => {
    it('should delete node successfully', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_NODE_ID } as any,
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
      });
    });

    it('should return 404 when node not found', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'non-existent-id' } as any,
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
          code: 'NOT_FOUND',
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
        { ...mockTimelineNode, id: 'node-2' } as any,
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
      });
    });
  });

  describe('Authentication and User Context', () => {
    it('should extract user ID from req.userId', async () => {
      // Arrange
      const req = createMockRequest({
        userId: TEST_USER_ID,
        user: { id: TEST_USER_ID } as any,
      });
      const res = createMockResponse();

      mockHierarchyService.getAllNodesWithPermissions.mockResolvedValue([]);

      // Act
      await controller.listNodes(req, res);

      // Assert
      expect(
        mockHierarchyService.getAllNodesWithPermissions
      ).toHaveBeenCalledWith(TEST_USER_ID, undefined);
    });

    it('should extract user ID from req.user.id', async () => {
      // Arrange
      const req = createMockRequest({
        userId: undefined,
        user: { id: 789 } as any,
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
          message: 'Authentication required',
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
      const req = createMockRequest({ params: { id: TEST_NODE_ID } as any });
      const res = createMockResponse();

      const testError = new Error('Database connection failed');
      testError.stack = 'Error: Database connection failed\n    at db.js:42:10';
      mockHierarchyService.getNodeById.mockRejectedValue(testError);

      // Act
      await controller.getNodeById(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Database connection failed',
        },
      });
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
      });
    });

    it('should maintain consistent error response format', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'invalid-id' } as any,
      });
      const res = createMockResponse();

      mockHierarchyService.getNodeById.mockResolvedValue(null);

      // Act
      await controller.getNodeById(req, res);

      // Assert
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Node not found or access denied',
        },
      });
    });
  });
});
