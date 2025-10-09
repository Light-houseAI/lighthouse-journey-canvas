/**
 * NodePermissionController Test Suite
 *
 * Comprehensive tests for node permission management API endpoints.
 * Tests request validation, response formatting, error handling, and business logic integration.
 */

import {
  PermissionAction,
  PolicyEffect,
  SubjectType,
  VisibilityLevel,
} from '@journey/schema';
import { type SetNodePermissionsDTO } from '@journey/schema';
import type { Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';

import type { INodePermissionService, IUserService } from '../services/interfaces';
import { NodePermissionController } from './node-permission.controller.js';

// Test data constants
const TEST_USER_ID = 123;
const TEST_NODE_ID = '123e4567-e89b-12d3-a456-426614174000';
const TEST_POLICY_ID = '987fcdeb-51a2-43c5-b789-123456789abc';

const validPermissionsData: SetNodePermissionsDTO = {
  policies: [
    {
      level: VisibilityLevel.Overview,
      action: PermissionAction.View,
      subjectType: SubjectType.Public,
      effect: PolicyEffect.Allow,
    },
    {
      level: VisibilityLevel.Full,
      action: PermissionAction.View,
      subjectType: SubjectType.Organization,
      subjectId: 1,
      effect: PolicyEffect.Allow,
    },
  ],
};

// Mock services using proper interface-based mocking
let mockNodePermissionService: MockProxy<INodePermissionService>;
let mockUserService: MockProxy<IUserService>;

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Helper to create mock Express response
const createMockResponse = (): Response => {
  const res = {} as any as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

// Helper to create mock Express request
const createMockRequest = (overrides: Partial<Request> = {} as any): Request => {
  const res = createMockResponse();
  return {
    params: {} as any,
    query: {} as any,
    body: {} as any,
    headers: {} as any,
    user: { id: TEST_USER_ID } as any,
    res,
    ...overrides,
  } as Request;
};

describe('NodePermissionController', () => {
  let controller: NodePermissionController;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create fresh mock instances
    mockNodePermissionService = mock<INodePermissionService>();
    mockUserService = mock<IUserService>();

    // Create controller instance with mocked dependencies
    controller = new NodePermissionController({
      nodePermissionService: mockNodePermissionService as any,
      userService: mockUserService as any,
      logger: mockLogger as any,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /nodes/:nodeId/permissions - Set Node Permissions', () => {
    it('should successfully set permissions', async () => {
      // Arrange
      const req = createMockRequest({
        params: { nodeId: TEST_NODE_ID } as any,
        body: validPermissionsData,
      });

      mockNodePermissionService.setNodePermissions.mockResolvedValue(undefined);

      // Act
      await controller.setPermissions(req);

      // Assert
      expect(mockNodePermissionService.setNodePermissions).toHaveBeenCalledWith(
        TEST_NODE_ID,
        expect.objectContaining({
          policies: expect.any(Array),
        }),
        TEST_USER_ID
      );
      expect(req.res!.status).toHaveBeenCalledWith(200);
      expect(req.res!.json).toHaveBeenCalledWith({
        success: true,
        data: null,
      });
    });

    it('should throw error when service fails', async () => {
      // Arrange
      const req = createMockRequest({
        params: { nodeId: TEST_NODE_ID } as any,
        body: validPermissionsData,
      });

      const error = new Error('Permission denied');
      mockNodePermissionService.setNodePermissions.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.setPermissions(req)).rejects.toThrow('Permission denied');
    });
  });

  describe('GET /nodes/:nodeId/permissions - Get Node Permissions', () => {
    it('should retrieve node permissions successfully', async () => {
      // Arrange
      const req = createMockRequest({
        params: { nodeId: TEST_NODE_ID } as any,
      });

      const mockPermissions = {
        nodeId: TEST_NODE_ID,
        policies: validPermissionsData.policies,
      };

      mockNodePermissionService.getNodePolicies.mockResolvedValue(
        mockPermissions as any
      );

      // Act
      await controller.getPermissions(req);

      // Assert
      expect(mockNodePermissionService.getNodePolicies).toHaveBeenCalledWith(
        TEST_NODE_ID,
        TEST_USER_ID
      );

      expect(req.res!.status).toHaveBeenCalledWith(200);
      expect(req.res!.json).toHaveBeenCalledWith({
        success: true,
        data: mockPermissions,
      });
    });
  });

  describe('DELETE /nodes/:nodeId/permissions/:policyId - Delete Node Policy', () => {
    it('should delete node policy successfully', async () => {
      // Arrange
      const req = createMockRequest({
        params: {
          nodeId: TEST_NODE_ID,
          policyId: TEST_POLICY_ID,
        },
      });

      mockNodePermissionService.deletePolicy.mockResolvedValue(undefined);

      // Act
      await controller.deletePolicy(req);

      // Assert
      expect(mockNodePermissionService.deletePolicy).toHaveBeenCalledWith(
        TEST_POLICY_ID,
        TEST_USER_ID
      );

      expect(req.res!.status).toHaveBeenCalledWith(200);
      expect(req.res!.json).toHaveBeenCalledWith({
        success: true,
        data: null,
      });
    });
  });

  describe('Authentication and Authorization', () => {
    it('should extract user ID from request', async () => {
      // Arrange
      const req = createMockRequest({
        params: { nodeId: TEST_NODE_ID } as any,
        user: { id: 456 } as any,
      });

      mockNodePermissionService.getNodePolicies.mockResolvedValue({
        nodeId: TEST_NODE_ID,
        policies: [],
      } as any);

      // Act
      await controller.getPermissions(req);

      // Assert - verify it was called with the correct user ID
      expect(mockNodePermissionService.getNodePolicies).toHaveBeenCalledWith(
        TEST_NODE_ID,
        456
      );
    });

    it('should throw AuthenticationError for missing user', async () => {
      const { AuthenticationError } = await import('@journey/schema');

      // Arrange
      const req = createMockRequest({
        params: { nodeId: TEST_NODE_ID } as any,
        user: undefined,
      });

      // Act & Assert
      await expect(controller.getPermissions(req)).rejects.toThrow(AuthenticationError);
    });
  });
});
