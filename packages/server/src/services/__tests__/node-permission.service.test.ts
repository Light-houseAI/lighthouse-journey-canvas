import { PermissionAction, VisibilityLevel } from '@journey/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

import type { Logger } from '../../core/logger';
import type { INodePermissionRepository } from '../../repositories/interfaces/node-permission.repository.interface';
import type { IOrganizationRepository } from '../../repositories/interfaces/organization.repository.interface';
import { NodePermissionService } from '../node-permission.service';

describe('NodePermissionService', () => {
  const mockNodePermissionRepository = mockDeep<INodePermissionRepository>();
  const mockOrganizationRepository = mockDeep<IOrganizationRepository>();
  const mockLogger = mockDeep<Logger>();

  let nodePermissionService: NodePermissionService;

  beforeEach(() => {
    mockReset(mockNodePermissionRepository);
    mockReset(mockOrganizationRepository);
    mockReset(mockLogger);

    nodePermissionService = new NodePermissionService({
      nodePermissionRepository: mockNodePermissionRepository,
      organizationRepository: mockOrganizationRepository,
      logger: mockLogger,
    });
  });

  describe('canAccess', () => {
    it('should return true when user has view permission for node', async () => {
      // Arrange
      const nodeId = '123e4567-e89b-12d3-a456-426614174000'; // Valid UUID
      const userId = 1;
      const expectedResult = true;

      mockNodePermissionRepository.canAccess.mockResolvedValue(expectedResult);

      // Act
      const result = await nodePermissionService.canAccess(nodeId, userId);

      // Assert
      expect(result).toBe(true);
      expect(mockNodePermissionRepository.canAccess).toHaveBeenCalledWith(
        userId,
        nodeId,
        PermissionAction.View,
        VisibilityLevel.Overview
      );
      expect(mockNodePermissionRepository.canAccess).toHaveBeenCalledTimes(1);
    });

    it('should return false and log warning when user is denied access', async () => {
      // Arrange
      const nodeId = '123e4567-e89b-12d3-a456-426614174001'; // Valid UUID
      const userId = 2;
      const expectedResult = false;

      mockNodePermissionRepository.canAccess.mockResolvedValue(expectedResult);

      // Act
      const result = await nodePermissionService.canAccess(nodeId, userId);

      // Assert
      expect(result).toBe(false);
      expect(mockNodePermissionRepository.canAccess).toHaveBeenCalledWith(
        userId,
        nodeId,
        PermissionAction.View,
        VisibilityLevel.Overview
      );
      expect(mockLogger.warn).toHaveBeenCalledWith('Access denied', {
        userId,
        nodeId,
        action: PermissionAction.View,
        level: VisibilityLevel.Overview,
        timestamp: expect.any(String),
      });
    });

    it('should handle repository errors and log them', async () => {
      // Arrange
      const nodeId = '123e4567-e89b-12d3-a456-426614174002'; // Valid UUID
      const userId = 3;
      const repositoryError = new Error('Database connection failed');

      mockNodePermissionRepository.canAccess.mockRejectedValue(repositoryError);

      // Act & Assert
      await expect(
        nodePermissionService.canAccess(nodeId, userId)
      ).rejects.toThrow('Database connection failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error checking node access',
        repositoryError
      );
    });

    it('should throw error for invalid node ID format', async () => {
      // Arrange
      const invalidNodeId = 'invalid-node-id';
      const userId = 1;

      // Act & Assert
      await expect(
        nodePermissionService.canAccess(invalidNodeId, userId)
      ).rejects.toThrow('Invalid node ID format');
      expect(mockNodePermissionRepository.canAccess).not.toHaveBeenCalled();
    });
  });
});
