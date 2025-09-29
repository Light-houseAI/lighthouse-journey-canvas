import { PermissionAction, VisibilityLevel } from '@journey/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';

import type { Logger } from '../../core/logger';
import { NodePermissionRepository } from '../node-permission.repository';

describe('NodePermissionRepository', () => {
  const mockDatabase = mockDeep<NodePgDatabase<any>>();
  const mockLogger = mockDeep<Logger>();

  let nodePermissionRepository: NodePermissionRepository;

  beforeEach(() => {
    mockReset(mockDatabase);
    mockReset(mockLogger);

    nodePermissionRepository = new NodePermissionRepository({
      database: mockDatabase,
      logger: mockLogger,
    });
  });

  describe('canAccess', () => {
    it('should return true when user has access permission', async () => {
      // Arrange
      const userId = 1;
      const nodeId = '123e4567-e89b-12d3-a456-426614174000';
      const action = PermissionAction.View;
      const level = VisibilityLevel.Overview;

      mockDatabase.execute.mockResolvedValue({ rows: [{ can_access: true }] });

      // Act
      const result = await nodePermissionRepository.canAccess(
        userId,
        nodeId,
        action,
        level
      );

      // Assert
      expect(result).toBe(true);
      expect(mockDatabase.execute).toHaveBeenCalled();
    });

    it('should return false when user lacks access permission', async () => {
      // Arrange
      const userId = 1;
      const nodeId = '123e4567-e89b-12d3-a456-426614174000';
      const action = PermissionAction.View;
      const level = VisibilityLevel.Overview;

      mockDatabase.execute.mockResolvedValue({ rows: [{ can_access: false }] });

      // Act
      const result = await nodePermissionRepository.canAccess(
        userId,
        nodeId,
        action,
        level
      );

      // Assert
      expect(result).toBe(false);
      expect(mockDatabase.execute).toHaveBeenCalled();
    });
  });
});
