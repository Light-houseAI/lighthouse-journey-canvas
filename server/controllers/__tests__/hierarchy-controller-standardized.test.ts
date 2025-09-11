/**
 * Tests for Standardized HierarchyController
 * 
 * Test suite for the updated HierarchyController with BaseController inheritance
 * Validates API response format consistency and error handling
 */

import { Request, Response } from 'express';
import { HierarchyController } from '../hierarchy-controller';
import { HierarchyService } from '../../services/hierarchy-service';
import { ValidationError, NotFoundError } from '../../core/errors';

// Mock dependencies
const mockHierarchyService = {
  createNode: jest.fn(),
  getNodeById: jest.fn(),
  updateNode: jest.fn(),
  deleteNode: jest.fn(),
  getAllNodesWithPermissions: jest.fn(),
  getNodeInsights: jest.fn(),
  createInsight: jest.fn(),
  updateInsight: jest.fn(),
  deleteInsight: jest.fn(),
} as jest.Mocked<HierarchyService>;

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

describe('Standardized HierarchyController', () => {
  let controller: HierarchyController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    controller = new HierarchyController({
      hierarchyService: mockHierarchyService,
      logger: mockLogger,
    });

    mockRequest = {
      body: {},
      params: {},
      query: {},
      user: { id: 1 },
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('createNode', () => {
    it('should create node and return standardized success response', async () => {
      const mockNodeData = {
        type: 'job',
        meta: { role: 'Software Engineer', orgId: 123 }
      };

      const mockCreatedNode = {
        id: 'test-node-id',
        ...mockNodeData,
        userId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRequest.body = mockNodeData;
      mockHierarchyService.createNode.mockResolvedValue(mockCreatedNode);

      await controller.createNode(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockCreatedNode,
      });
    });

    it('should handle validation errors with standardized error response', async () => {
      mockRequest.body = { type: 'invalid-type' }; // Invalid node type

      await controller.createNode(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: expect.any(String),
          }),
        })
      );
    });

    it('should handle service errors with standardized error response', async () => {
      const mockNodeData = {
        type: 'job',
        meta: { role: 'Software Engineer', orgId: 123 }
      };

      mockRequest.body = mockNodeData;
      mockHierarchyService.createNode.mockRejectedValue(new Error('Service error'));

      await controller.createNode(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Service error',
          }),
        })
      );
    });
  });

  describe('getNodeById', () => {
    it('should get node and return standardized success response', async () => {
      const mockNode = {
        id: 'test-node-id',
        type: 'job',
        meta: { role: 'Software Engineer' },
        userId: 1,
      };

      mockRequest.params = { id: 'test-node-id' };
      mockHierarchyService.getNodeById.mockResolvedValue(mockNode);

      await controller.getNodeById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockNode,
      });
    });

    it('should handle not found with standardized error response', async () => {
      mockRequest.params = { id: 'non-existent-id' };
      mockHierarchyService.getNodeById.mockResolvedValue(null);

      await controller.getNodeById(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
            message: 'Node not found or access denied',
          }),
        })
      );
    });
  });

  describe('listNodes', () => {
    it('should list nodes and return standardized success response with metadata', async () => {
      const mockNodes = [
        { id: 'node-1', type: 'job', meta: { role: 'Engineer' } },
        { id: 'node-2', type: 'education', meta: { degree: 'BS' } },
      ];

      mockHierarchyService.getAllNodesWithPermissions.mockResolvedValue(mockNodes);

      await controller.listNodes(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockNodes,
        meta: {
          total: mockNodes.length,
        },
      });
    });

    it('should filter nodes by type when provided', async () => {
      const mockNodes = [
        { id: 'node-1', type: 'job', meta: { role: 'Engineer' } },
        { id: 'node-2', type: 'education', meta: { degree: 'BS' } },
      ];

      mockRequest.query = { type: 'job' };
      mockHierarchyService.getAllNodesWithPermissions.mockResolvedValue(mockNodes);

      await controller.listNodes(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: [mockNodes[0]], // Only job nodes
        meta: {
          total: 1,
        },
      });
    });
  });

  describe('createInsight', () => {
    it('should create insight and return standardized success response', async () => {
      const mockInsightData = {
        description: 'Test insight',
        resources: [],
      };

      const mockCreatedInsight = {
        id: 'insight-id',
        ...mockInsightData,
        nodeId: 'node-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRequest.params = { nodeId: 'node-id' };
      mockRequest.body = mockInsightData;
      mockHierarchyService.createInsight.mockResolvedValue(mockCreatedInsight);

      await controller.createInsight(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          ...mockCreatedInsight,
          timeAgo: 'just now',
        }),
      });
    });

    it('should handle insight validation errors', async () => {
      mockRequest.params = { nodeId: 'node-id' };
      mockRequest.body = { description: '' }; // Invalid empty description

      await controller.createInsight(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
          }),
        })
      );
    });
  });

  describe('updateInsight', () => {
    it('should update insight and return standardized success response', async () => {
      const mockUpdatedInsight = {
        id: 'insight-id',
        description: 'Updated insight',
        nodeId: 'node-id',
        updatedAt: new Date(),
      };

      mockRequest.params = { insightId: 'insight-id' };
      mockRequest.body = { description: 'Updated insight' };
      mockHierarchyService.updateInsight.mockResolvedValue(mockUpdatedInsight);

      await controller.updateInsight(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          ...mockUpdatedInsight,
          timeAgo: expect.any(String),
        }),
      });
    });

    it('should handle insight not found', async () => {
      mockRequest.params = { insightId: 'non-existent-id' };
      mockRequest.body = { description: 'Updated insight' };
      mockHierarchyService.updateInsight.mockResolvedValue(null);

      await controller.updateInsight(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
            message: 'Insight not found',
          }),
        })
      );
    });
  });

  describe('deleteNode', () => {
    it('should delete node and return standardized success response', async () => {
      mockRequest.params = { id: 'node-id' };
      mockHierarchyService.deleteNode.mockResolvedValue(true);

      await controller.deleteNode(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: null,
      });
    });

    it('should handle node not found during deletion', async () => {
      mockRequest.params = { id: 'non-existent-id' };
      mockHierarchyService.deleteNode.mockResolvedValue(false);

      await controller.deleteNode(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
            message: 'Node not found or access denied',
          }),
        })
      );
    });
  });

  describe('authentication', () => {
    it('should handle missing authentication', async () => {
      mockRequest.user = undefined;

      await controller.createNode(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Authentication required',
          }),
        })
      );
    });
  });
});