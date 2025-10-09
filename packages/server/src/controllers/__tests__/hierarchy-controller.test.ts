/**
 * HierarchyController API Endpoint Tests
 *
 * Modern test suite using interface-based mocking for hierarchical timeline system.
 * Tests core CRUD operations, error handling, and business logic integration.
 */

import type { TimelineNode } from '@journey/schema';
import { AuthenticationError, NotFoundError, ValidationError } from '@journey/schema';
import type { Request, Response } from 'express';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';

import type { IHierarchyService } from '../../services/interfaces';
import { HierarchyController } from '../hierarchy-controller';

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
    user: { id: TEST_USER_ID } as any,
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

    // Create controller instance
    controller = new HierarchyController({
      hierarchyService: mockHierarchyService as any,
      logger: mockLogger as any,
    });
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

    it('should throw ValidationError for invalid node type', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          type: 'invalid-type',
          meta: { title: 'Test Node' } as any,
        },
      });
      const res = createMockResponse();

      // Act & Assert
      await expect(controller.createNode(req, res)).rejects.toThrow(ValidationError);
      expect(mockHierarchyService.createNode).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for empty meta object', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          type: 'job',
          meta: {} as any,
        },
      });
      const res = createMockResponse();

      // Act & Assert
      await expect(controller.createNode(req, res)).rejects.toThrow(ValidationError);
      expect(mockHierarchyService.createNode).not.toHaveBeenCalled();
    });

    it('should throw AuthenticationError when user not authenticated', async () => {
      // Arrange
      const req = createMockRequest({
        body: {
          type: 'job',
          meta: { title: 'Test Job' } as any,
        },
        user: undefined,
      });
      const res = createMockResponse();

      // Act & Assert
      await expect(controller.createNode(req, res)).rejects.toThrow(AuthenticationError);
      expect(mockHierarchyService.createNode).not.toHaveBeenCalled();
    });

    it('should propagate service errors', async () => {
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

      // Act & Assert
      await expect(controller.createNode(req, res)).rejects.toThrow('Database connection failed');
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
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockTimelineNode,
      });
    });

    it('should throw NotFoundError when node not found', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'non-existent-id' } as any,
      });
      const res = createMockResponse();

      mockHierarchyService.getNodeById.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.getNodeById(req, res)).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthenticationError when user not authenticated', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_NODE_ID } as any,
        user: undefined,
      });
      const res = createMockResponse();

      // Act & Assert
      await expect(controller.getNodeById(req, res)).rejects.toThrow(AuthenticationError);
      expect(mockHierarchyService.getNodeById).not.toHaveBeenCalled();
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

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedNode,
      });
    });

    it('should throw NotFoundError when node not found', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'non-existent-id' } as any,
        body: {
          meta: { title: 'Updated Title' } as any,
        },
      });
      const res = createMockResponse();

      mockHierarchyService.updateNode.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.updateNode(req, res)).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthenticationError when user not authenticated', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_NODE_ID } as any,
        body: { meta: { title: 'Updated Title' } as any },
        user: undefined,
      });
      const res = createMockResponse();

      // Act & Assert
      await expect(controller.updateNode(req, res)).rejects.toThrow(AuthenticationError);
      expect(mockHierarchyService.updateNode).not.toHaveBeenCalled();
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
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: null,
      });
    });

    it('should throw NotFoundError when node not found', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: 'non-existent-id' } as any,
      });
      const res = createMockResponse();

      mockHierarchyService.deleteNode.mockResolvedValue(false);

      // Act & Assert
      await expect(controller.deleteNode(req, res)).rejects.toThrow(NotFoundError);
    });

    it('should throw AuthenticationError when user not authenticated', async () => {
      // Arrange
      const req = createMockRequest({
        params: { id: TEST_NODE_ID } as any,
        user: undefined,
      });
      const res = createMockResponse();

      // Act & Assert
      await expect(controller.deleteNode(req, res)).rejects.toThrow(AuthenticationError);
      expect(mockHierarchyService.deleteNode).not.toHaveBeenCalled();
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
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockNodes,
        meta: {
          total: 2,
        },
      });
    });

    it('should filter nodes by type', async () => {
      // Arrange
      const req = createMockRequest({
        query: { type: 'job' } as any,
      });
      const res = createMockResponse();

      const mockNodes = [
        mockTimelineNode,
        { ...mockTimelineNode, id: 'node-2', type: 'education' } as any,
      ];
      mockHierarchyService.getAllNodesWithPermissions.mockResolvedValue(
        mockNodes
      );

      // Act
      await controller.listNodes(req, res);

      // Assert
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [mockTimelineNode],
        meta: {
          total: 1,
        },
      });
    });

    it('should throw AuthenticationError when user not authenticated', async () => {
      // Arrange
      const req = createMockRequest({
        user: undefined,
      });
      const res = createMockResponse();

      // Act & Assert
      await expect(controller.listNodes(req, res)).rejects.toThrow(AuthenticationError);
      expect(mockHierarchyService.getAllNodesWithPermissions).not.toHaveBeenCalled();
    });
  });

  describe('Insights API Methods', () => {
    const mockInsight = {
      id: 'insight-1',
      nodeId: TEST_NODE_ID,
      userId: TEST_USER_ID,
      description: 'Test insight',
      resources: [],
      createdAt: MOCK_TIMESTAMP,
      updatedAt: MOCK_TIMESTAMP,
    };

    describe('GET /nodes/:nodeId/insights', () => {
      it('should return node insights with timeAgo', async () => {
        // Arrange
        const req = createMockRequest({
          params: { nodeId: TEST_NODE_ID } as any,
        });
        const res = createMockResponse();

        mockHierarchyService.getNodeInsights.mockResolvedValue([mockInsight] as any);

        // Act
        await controller.getNodeInsights(req, res);

        // Assert
        expect(mockHierarchyService.getNodeInsights).toHaveBeenCalledWith(
          TEST_NODE_ID,
          TEST_USER_ID
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              ...mockInsight,
              timeAgo: expect.any(String),
            }),
          ]),
          meta: { total: 1 },
        });
      });

      it('should throw AuthenticationError when user not authenticated', async () => {
        // Arrange
        const req = createMockRequest({
          params: { nodeId: TEST_NODE_ID } as any,
          user: undefined,
        });
        const res = createMockResponse();

        // Act & Assert
        await expect(controller.getNodeInsights(req, res)).rejects.toThrow(AuthenticationError);
        expect(mockHierarchyService.getNodeInsights).not.toHaveBeenCalled();
      });
    });

    describe('POST /nodes/:nodeId/insights', () => {
      it('should create insight with valid data', async () => {
        // Arrange
        const req = createMockRequest({
          params: { nodeId: TEST_NODE_ID } as any,
          body: {
            description: 'New insight',
            resources: [],
          },
        });
        const res = createMockResponse();

        mockHierarchyService.createInsight.mockResolvedValue(mockInsight as any);

        // Act
        await controller.createInsight(req, res);

        // Assert
        expect(mockHierarchyService.createInsight).toHaveBeenCalledWith(
          TEST_NODE_ID,
          { description: 'New insight', resources: [] },
          TEST_USER_ID
        );
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: expect.objectContaining({
            ...mockInsight,
            timeAgo: 'just now',
          }),
        });
      });

      it('should throw ValidationError for invalid insight data', async () => {
        // Arrange
        const req = createMockRequest({
          params: { nodeId: TEST_NODE_ID } as any,
          body: { description: '' },
        });
        const res = createMockResponse();

        // Act & Assert
        await expect(controller.createInsight(req, res)).rejects.toThrow(ValidationError);
        expect(mockHierarchyService.createInsight).not.toHaveBeenCalled();
      });

      it('should throw AuthenticationError when user not authenticated', async () => {
        // Arrange
        const req = createMockRequest({
          params: { nodeId: TEST_NODE_ID } as any,
          body: { description: 'New insight', resources: [] },
          user: undefined,
        });
        const res = createMockResponse();

        // Act & Assert
        await expect(controller.createInsight(req, res)).rejects.toThrow(AuthenticationError);
        expect(mockHierarchyService.createInsight).not.toHaveBeenCalled();
      });
    });

    describe('PUT /insights/:insightId', () => {
      it('should update insight with valid data', async () => {
        // Arrange
        const req = createMockRequest({
          params: { insightId: 'insight-1' } as any,
          body: {
            description: 'Updated insight',
          },
        });
        const res = createMockResponse();

        const updatedInsight = { ...mockInsight, description: 'Updated insight' };
        mockHierarchyService.updateInsight.mockResolvedValue(updatedInsight as any);

        // Act
        await controller.updateInsight(req, res);

        // Assert
        expect(mockHierarchyService.updateInsight).toHaveBeenCalledWith(
          'insight-1',
          { description: 'Updated insight' },
          TEST_USER_ID
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: expect.objectContaining({
            ...updatedInsight,
            timeAgo: expect.any(String),
          }),
        });
      });

      it('should throw NotFoundError when insight not found', async () => {
        // Arrange
        const req = createMockRequest({
          params: { insightId: 'non-existent' } as any,
          body: { description: 'Updated' },
        });
        const res = createMockResponse();

        mockHierarchyService.updateInsight.mockResolvedValue(null);

        // Act & Assert
        await expect(controller.updateInsight(req, res)).rejects.toThrow(NotFoundError);
      });

      it('should throw AuthenticationError when user not authenticated', async () => {
        // Arrange
        const req = createMockRequest({
          params: { insightId: 'insight-1' } as any,
          body: { description: 'Updated' },
          user: undefined,
        });
        const res = createMockResponse();

        // Act & Assert
        await expect(controller.updateInsight(req, res)).rejects.toThrow(AuthenticationError);
        expect(mockHierarchyService.updateInsight).not.toHaveBeenCalled();
      });
    });

    describe('DELETE /insights/:insightId', () => {
      it('should delete insight successfully', async () => {
        // Arrange
        const req = createMockRequest({
          params: { insightId: 'insight-1' } as any,
        });
        const res = createMockResponse();

        mockHierarchyService.deleteInsight.mockResolvedValue(true);

        // Act
        await controller.deleteInsight(req, res);

        // Assert
        expect(mockHierarchyService.deleteInsight).toHaveBeenCalledWith(
          'insight-1',
          TEST_USER_ID
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: null,
        });
      });

      it('should throw NotFoundError when insight not found', async () => {
        // Arrange
        const req = createMockRequest({
          params: { insightId: 'non-existent' } as any,
        });
        const res = createMockResponse();

        mockHierarchyService.deleteInsight.mockResolvedValue(false);

        // Act & Assert
        await expect(controller.deleteInsight(req, res)).rejects.toThrow(NotFoundError);
      });

      it('should throw AuthenticationError when user not authenticated', async () => {
        // Arrange
        const req = createMockRequest({
          params: { insightId: 'insight-1' } as any,
          user: undefined,
        });
        const res = createMockResponse();

        // Act & Assert
        await expect(controller.deleteInsight(req, res)).rejects.toThrow(AuthenticationError);
        expect(mockHierarchyService.deleteInsight).not.toHaveBeenCalled();
      });
    });
  });
});
