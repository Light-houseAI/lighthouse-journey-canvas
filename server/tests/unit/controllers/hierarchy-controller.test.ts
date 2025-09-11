/**
 * Hierarchy Controller Unit Tests
 *
 * Tests HTTP request/response handling with mocked services:
 * 1. Request validation and parsing
 * 2. Service method calls with proper parameters
 * 3. Response formatting and status codes
 * 4. Error handling and HTTP error responses
 * 5. Authentication and authorization middleware integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response } from 'express';

import { TimelineNodeType } from '@shared/schema';
import { setupIntegrationTestContext, TEST_TIMEOUTS, TestDataBuilders } from '../../setup/test-hooks.js';
import { TestContainerFactory } from '../../setup/test-container.js';
import type { HierarchyController } from '../../../controllers/hierarchy.controller.js';
import type { HierarchyService } from '../../../services/hierarchy.service.js';

describe('Hierarchy Controller Unit Tests', () => {
  const testContext = setupIntegrationTestContext({ 
    suiteName: 'hierarchy-controller-unit',
    withTestData: false
  });

  let controller: HierarchyController;
  let mockHierarchyService: any;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    const { db, dbConfig } = testContext.getContext();

    // Create unit test container with mocked services
    const container = TestContainerFactory.createForController({
      db,
      dbConfig,
      enableMocks: true,
      customRegistrations: {
        // Mock the hierarchy service specifically
        hierarchyService: {
          createNode: vi.fn(),
          getNode: vi.fn(),
          getUserNodes: vi.fn(),
          updateNode: vi.fn(),
          deleteNode: vi.fn(),
          getNodeChildren: vi.fn(),
        }
      }
    });

    controller = container.resolve<HierarchyController>('hierarchyController');
    mockHierarchyService = container.resolve<HierarchyService>('hierarchyService');

    // Mock Express request and response objects
    mockReq = {
      body: {},
      params: {},
      query: {},
      headers: {},
      user: { id: 1, email: 'test@example.com' }, // Simulated authenticated user
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('POST /nodes - Create Node', () => {
    it('should create node successfully with valid request', async () => {
      // 🔧 ARRANGE
      const nodeData = TestDataBuilders.jobNode({
        meta: {
          title: 'Test Job',
          company: 'Test Company',
          startDate: '2023-01'
        }
      });

      const expectedNode = {
        id: 'test-node-id',
        ...nodeData,
        userId: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockReq.body = nodeData;
      mockHierarchyService.createNode.mockResolvedValue(expectedNode);

      // ⚡ ACT
      await controller.createNode(mockReq as Request, mockRes as Response);

      // ✅ ASSERT
      expect(mockHierarchyService.createNode).toHaveBeenCalledWith(nodeData, 1);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(expectedNode);

    }, TEST_TIMEOUTS.UNIT);

    it('should handle validation errors appropriately', async () => {
      // 🔧 ARRANGE
      const invalidNodeData = {
        type: 'invalid-type',
        meta: {
          title: '', // Empty title should be invalid
        }
      };

      mockReq.body = invalidNodeData;
      mockHierarchyService.createNode.mockRejectedValue(new Error('Validation failed: Title is required'));

      // ⚡ ACT
      await controller.createNode(mockReq as Request, mockRes as Response);

      // ✅ ASSERT
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation failed: Title is required'
      });

    }, TEST_TIMEOUTS.UNIT);

    it('should handle missing authentication', async () => {
      // 🔧 ARRANGE
      mockReq.user = undefined; // No authenticated user
      mockReq.body = TestDataBuilders.jobNode();

      // ⚡ ACT
      await controller.createNode(mockReq as Request, mockRes as Response);

      // ✅ ASSERT
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication required'
      });

    }, TEST_TIMEOUTS.UNIT);

    it('should handle service errors with proper HTTP status', async () => {
      // 🔧 ARRANGE
      mockReq.body = TestDataBuilders.jobNode();
      mockHierarchyService.createNode.mockRejectedValue(new Error('Database connection failed'));

      // ⚡ ACT
      await controller.createNode(mockReq as Request, mockRes as Response);

      // ✅ ASSERT
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Database connection failed'
      });

    }, TEST_TIMEOUTS.UNIT);
  });

  describe('GET /nodes/:id - Get Node', () => {
    it('should retrieve node successfully', async () => {
      // 🔧 ARRANGE
      const nodeId = 'test-node-id';
      const expectedNode = {
        id: nodeId,
        type: TimelineNodeType.Job,
        meta: { title: 'Test Job', company: 'Test Company' },
        userId: 1,
      };

      mockReq.params = { id: nodeId };
      mockHierarchyService.getNode.mockResolvedValue(expectedNode);

      // ⚡ ACT
      await controller.getNode(mockReq as Request, mockRes as Response);

      // ✅ ASSERT
      expect(mockHierarchyService.getNode).toHaveBeenCalledWith(nodeId);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expectedNode);

    }, TEST_TIMEOUTS.UNIT);

    it('should handle node not found', async () => {
      // 🔧 ARRANGE
      const nodeId = 'non-existent-node';
      mockReq.params = { id: nodeId };
      mockHierarchyService.getNode.mockResolvedValue(null);

      // ⚡ ACT
      await controller.getNode(mockReq as Request, mockRes as Response);

      // ✅ ASSERT
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Node not found'
      });

    }, TEST_TIMEOUTS.UNIT);

    it('should validate node ID parameter', async () => {
      // 🔧 ARRANGE
      mockReq.params = { id: '' }; // Empty ID

      // ⚡ ACT
      await controller.getNode(mockReq as Request, mockRes as Response);

      // ✅ ASSERT
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Node ID is required'
      });

    }, TEST_TIMEOUTS.UNIT);
  });

  describe('GET /nodes - List User Nodes', () => {
    it('should list user nodes with default pagination', async () => {
      // 🔧 ARRANGE
      const expectedNodes = [
        { id: 'node-1', type: TimelineNodeType.Job, meta: { title: 'Job 1' }, userId: 1 },
        { id: 'node-2', type: TimelineNodeType.Project, meta: { title: 'Project 1' }, userId: 1 },
      ];

      mockHierarchyService.getUserNodes.mockResolvedValue(expectedNodes);

      // ⚡ ACT
      await controller.getUserNodes(mockReq as Request, mockRes as Response);

      // ✅ ASSERT
      expect(mockHierarchyService.getUserNodes).toHaveBeenCalledWith(1, undefined);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expectedNodes);

    }, TEST_TIMEOUTS.UNIT);

    it('should handle query parameters for filtering', async () => {
      // 🔧 ARRANGE
      mockReq.query = { type: 'job', limit: '10' };
      const filteredNodes = [
        { id: 'job-1', type: TimelineNodeType.Job, meta: { title: 'Job 1' }, userId: 1 }
      ];

      mockHierarchyService.getUserNodes.mockResolvedValue(filteredNodes);

      // ⚡ ACT
      await controller.getUserNodes(mockReq as Request, mockRes as Response);

      // ✅ ASSERT
      expect(mockHierarchyService.getUserNodes).toHaveBeenCalledWith(1, {
        type: 'job',
        limit: 10
      });
      expect(mockRes.json).toHaveBeenCalledWith(filteredNodes);

    }, TEST_TIMEOUTS.UNIT);
  });

  describe('PATCH /nodes/:id - Update Node', () => {
    it('should update node successfully', async () => {
      // 🔧 ARRANGE
      const nodeId = 'test-node-id';
      const updateData = {
        meta: {
          title: 'Updated Job Title',
          company: 'New Company'
        }
      };

      const updatedNode = {
        id: nodeId,
        type: TimelineNodeType.Job,
        meta: updateData.meta,
        userId: 1,
      };

      mockReq.params = { id: nodeId };
      mockReq.body = updateData;
      mockHierarchyService.updateNode.mockResolvedValue(updatedNode);

      // ⚡ ACT
      await controller.updateNode(mockReq as Request, mockRes as Response);

      // ✅ ASSERT
      expect(mockHierarchyService.updateNode).toHaveBeenCalledWith(nodeId, updateData, 1);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(updatedNode);

    }, TEST_TIMEOUTS.UNIT);

    it('should handle unauthorized update attempts', async () => {
      // 🔧 ARRANGE
      const nodeId = 'other-user-node';
      mockReq.params = { id: nodeId };
      mockReq.body = { meta: { title: 'Hacked Title' } };
      
      mockHierarchyService.updateNode.mockRejectedValue(new Error('Unauthorized: Cannot update node owned by another user'));

      // ⚡ ACT
      await controller.updateNode(mockReq as Request, mockRes as Response);

      // ✅ ASSERT
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized: Cannot update node owned by another user'
      });

    }, TEST_TIMEOUTS.UNIT);
  });

  describe('DELETE /nodes/:id - Delete Node', () => {
    it('should delete node successfully', async () => {
      // 🔧 ARRANGE
      const nodeId = 'test-node-id';
      mockReq.params = { id: nodeId };
      mockHierarchyService.deleteNode.mockResolvedValue(true);

      // ⚡ ACT
      await controller.deleteNode(mockReq as Request, mockRes as Response);

      // ✅ ASSERT
      expect(mockHierarchyService.deleteNode).toHaveBeenCalledWith(nodeId, 1);
      expect(mockRes.status).toHaveBeenCalledWith(204);
      expect(mockRes.send).toHaveBeenCalled();

    }, TEST_TIMEOUTS.UNIT);

    it('should handle deletion of non-existent node', async () => {
      // 🔧 ARRANGE
      const nodeId = 'non-existent-node';
      mockReq.params = { id: nodeId };
      mockHierarchyService.deleteNode.mockRejectedValue(new Error('Node not found'));

      // ⚡ ACT
      await controller.deleteNode(mockReq as Request, mockRes as Response);

      // ✅ ASSERT
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Node not found'
      });

    }, TEST_TIMEOUTS.UNIT);

    it('should handle unauthorized deletion attempts', async () => {
      // 🔧 ARRANGE
      const nodeId = 'protected-node';
      mockReq.params = { id: nodeId };
      mockHierarchyService.deleteNode.mockRejectedValue(new Error('Unauthorized: Cannot delete node owned by another user'));

      // ⚡ ACT
      await controller.deleteNode(mockReq as Request, mockRes as Response);

      // ✅ ASSERT
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized: Cannot delete node owned by another user'
      });

    }, TEST_TIMEOUTS.UNIT);
  });

  describe('GET /nodes/:id/children - Get Node Children', () => {
    it('should retrieve node children successfully', async () => {
      // 🔧 ARRANGE
      const parentId = 'parent-node-id';
      const expectedChildren = [
        { id: 'child-1', parentId, type: TimelineNodeType.Project, meta: { title: 'Child 1' } },
        { id: 'child-2', parentId, type: TimelineNodeType.Project, meta: { title: 'Child 2' } },
      ];

      mockReq.params = { id: parentId };
      mockHierarchyService.getNodeChildren.mockResolvedValue(expectedChildren);

      // ⚡ ACT
      await controller.getNodeChildren(mockReq as Request, mockRes as Response);

      // ✅ ASSERT
      expect(mockHierarchyService.getNodeChildren).toHaveBeenCalledWith(parentId);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expectedChildren);

    }, TEST_TIMEOUTS.UNIT);

    it('should return empty array for leaf nodes', async () => {
      // 🔧 ARRANGE
      const leafNodeId = 'leaf-node-id';
      mockReq.params = { id: leafNodeId };
      mockHierarchyService.getNodeChildren.mockResolvedValue([]);

      // ⚡ ACT
      await controller.getNodeChildren(mockReq as Request, mockRes as Response);

      // ✅ ASSERT
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith([]);

    }, TEST_TIMEOUTS.UNIT);
  });

  describe('Error Handling Middleware Integration', () => {
    it('should handle async errors properly', async () => {
      // 🔧 ARRANGE
      mockReq.body = TestDataBuilders.jobNode();
      mockHierarchyService.createNode.mockRejectedValue(new Error('Unexpected database error'));

      // ⚡ ACT
      await controller.createNode(mockReq as Request, mockRes as Response);

      // ✅ ASSERT
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unexpected database error'
      });

    }, TEST_TIMEOUTS.UNIT);

    it('should handle malformed request body', async () => {
      // 🔧 ARRANGE
      mockReq.body = 'invalid-json-string';

      // ⚡ ACT
      await controller.createNode(mockReq as Request, mockRes as Response);

      // ✅ ASSERT
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid request body'
      });

    }, TEST_TIMEOUTS.UNIT);
  });
});