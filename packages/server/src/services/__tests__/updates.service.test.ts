/**
 * Unit Tests for Updates Service
 *
 * Tests CRUD operations for career transition updates with permission checks,
 * pagination, and proper error handling.
 */

import type { Update } from '@journey/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';

import type { Logger } from '../../core/logger';
import type { UpdatesRepository } from '../../repositories/updates.repository';
import type { NodePermissionService } from '../node-permission.service';
import { UpdatesService } from '../updates.service';

describe('UpdatesService', () => {
  let service: UpdatesService;
  let mockUpdatesRepository: MockProxy<UpdatesRepository>;
  let mockNodePermissionService: MockProxy<NodePermissionService>;
  let mockLogger: MockProxy<Logger>;

  const mockUpdate: Update = {
    id: 'update-123',
    nodeId: 'node-456',
    notes: 'Applied to 5 companies',
    meta: {
      appliedToJobs: true,
      updatedResumeOrPortfolio: false,
      networked: true,
    },
    renderedText: 'Job Search Preparation: applied to jobs, networked',
    isDeleted: false,
    createdAt: new Date('2025-01-01T12:00:00Z'),
    updatedAt: new Date('2025-01-01T12:00:00Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = mock<Logger>();
    mockUpdatesRepository = mock<UpdatesRepository>();
    mockNodePermissionService = mock<NodePermissionService>();

    service = new UpdatesService({
      updatesRepository: mockUpdatesRepository,
      nodePermissionService: mockNodePermissionService,
      logger: mockLogger,
    });
  });

  describe('createUpdate', () => {
    const createData = {
      notes: 'Applied to 5 companies',
      meta: {
        appliedToJobs: true,
        networked: true,
      },
    };

    it('should create update when user has edit permission', async () => {
      mockNodePermissionService.canEdit.mockResolvedValue(true);
      mockUpdatesRepository.create.mockResolvedValue(mockUpdate);

      const result = await service.createUpdate(123, 'node-456', createData);

      expect(mockNodePermissionService.canEdit).toHaveBeenCalledWith(
        123,
        'node-456'
      );
      expect(mockUpdatesRepository.create).toHaveBeenCalledWith(
        'node-456',
        createData
      );
      expect(result).toEqual({
        id: 'update-123',
        nodeId: 'node-456',
        notes: 'Applied to 5 companies',
        meta: {
          appliedToJobs: true,
          updatedResumeOrPortfolio: false,
          networked: true,
          developedSkills: false,
          pendingInterviews: false,
          completedInterviews: false,
          practicedMock: false,
          receivedOffers: false,
          receivedRejections: false,
          possiblyGhosted: false,
        },
        renderedText: 'Job Search Preparation: applied to jobs, networked',
        createdAt: '2025-01-01T12:00:00.000Z',
        updatedAt: '2025-01-01T12:00:00.000Z',
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Created update', {
        updateId: 'update-123',
        nodeId: 'node-456',
        userId: 123,
      });
    });

    it('should throw error when user lacks edit permission', async () => {
      mockNodePermissionService.canEdit.mockResolvedValue(false);

      await expect(
        service.createUpdate(123, 'node-456', createData)
      ).rejects.toThrow('Insufficient permissions to create update');

      expect(mockUpdatesRepository.create).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create update',
        expect.any(Object)
      );
    });

    it('should propagate repository errors', async () => {
      mockNodePermissionService.canEdit.mockResolvedValue(true);
      mockUpdatesRepository.create.mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        service.createUpdate(123, 'node-456', createData)
      ).rejects.toThrow('Database error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create update',
        expect.any(Object)
      );
    });
  });

  describe('getUpdatesByNodeId', () => {
    const paginationOptions = { page: 1, limit: 10 };

    it('should return paginated updates when user has view permission', async () => {
      mockNodePermissionService.canView.mockResolvedValue(true);
      mockUpdatesRepository.getByNodeId.mockResolvedValue({
        updates: [mockUpdate],
        total: 1,
      });

      const result = await service.getUpdatesByNodeId(
        123,
        'node-456',
        paginationOptions
      );

      expect(mockNodePermissionService.canView).toHaveBeenCalledWith(
        123,
        'node-456'
      );
      expect(mockUpdatesRepository.getByNodeId).toHaveBeenCalledWith(
        'node-456',
        paginationOptions
      );
      expect(result).toEqual({
        updates: [
          {
            id: 'update-123',
            nodeId: 'node-456',
            notes: 'Applied to 5 companies',
            meta: expect.any(Object),
            renderedText: 'Job Search Preparation: applied to jobs, networked',
            createdAt: '2025-01-01T12:00:00.000Z',
            updatedAt: '2025-01-01T12:00:00.000Z',
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          hasNext: false,
          hasPrev: false,
        },
      });
    });

    it('should calculate hasNext and hasPrev correctly', async () => {
      mockNodePermissionService.canView.mockResolvedValue(true);
      mockUpdatesRepository.getByNodeId.mockResolvedValue({
        updates: Array(10).fill(mockUpdate),
        total: 25,
      });

      const result = await service.getUpdatesByNodeId(123, 'node-456', {
        page: 2,
        limit: 10,
      });

      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        hasNext: true,
        hasPrev: true,
      });
    });

    it('should throw error when user lacks view permission', async () => {
      mockNodePermissionService.canView.mockResolvedValue(false);

      await expect(
        service.getUpdatesByNodeId(123, 'node-456', paginationOptions)
      ).rejects.toThrow('Insufficient permissions to view updates');

      expect(mockUpdatesRepository.getByNodeId).not.toHaveBeenCalled();
    });
  });

  describe('getUpdateById', () => {
    it('should return update when user has view permission and update exists', async () => {
      mockNodePermissionService.canView.mockResolvedValue(true);
      mockUpdatesRepository.getById.mockResolvedValue(mockUpdate);

      const result = await service.getUpdateById(123, 'node-456', 'update-123');

      expect(mockNodePermissionService.canView).toHaveBeenCalledWith(
        123,
        'node-456'
      );
      expect(mockUpdatesRepository.getById).toHaveBeenCalledWith('update-123');
      expect(result).toEqual(expect.objectContaining({ id: 'update-123' }));
    });

    it('should return null when update not found', async () => {
      mockNodePermissionService.canView.mockResolvedValue(true);
      mockUpdatesRepository.getById.mockResolvedValue(null);

      const result = await service.getUpdateById(123, 'node-456', 'update-123');

      expect(result).toBeNull();
    });

    it('should throw error when update belongs to different node', async () => {
      mockNodePermissionService.canView.mockResolvedValue(true);
      mockUpdatesRepository.getById.mockResolvedValue({
        ...mockUpdate,
        nodeId: 'different-node',
      });

      await expect(
        service.getUpdateById(123, 'node-456', 'update-123')
      ).rejects.toThrow('Update does not belong to the specified node');
    });

    it('should throw error when user lacks view permission', async () => {
      mockNodePermissionService.canView.mockResolvedValue(false);

      await expect(
        service.getUpdateById(123, 'node-456', 'update-123')
      ).rejects.toThrow('Insufficient permissions to view update');

      expect(mockUpdatesRepository.getById).not.toHaveBeenCalled();
    });
  });

  describe('updateUpdate', () => {
    const updateData = {
      notes: 'Updated notes',
      meta: {
        completedInterviews: true,
      },
    };

    it('should update when user has edit permission and update exists', async () => {
      mockNodePermissionService.canEdit.mockResolvedValue(true);
      mockUpdatesRepository.getById.mockResolvedValue(mockUpdate);
      mockUpdatesRepository.update.mockResolvedValue({
        ...mockUpdate,
        notes: 'Updated notes',
      });

      const result = await service.updateUpdate(
        123,
        'node-456',
        'update-123',
        updateData
      );

      expect(mockNodePermissionService.canEdit).toHaveBeenCalledWith(
        123,
        'node-456'
      );
      expect(mockUpdatesRepository.getById).toHaveBeenCalledWith('update-123');
      expect(mockUpdatesRepository.update).toHaveBeenCalledWith(
        'update-123',
        updateData
      );
      expect(result).toEqual(
        expect.objectContaining({ notes: 'Updated notes' })
      );
    });

    it('should return null when update not found', async () => {
      mockNodePermissionService.canEdit.mockResolvedValue(true);
      mockUpdatesRepository.getById.mockResolvedValue(null);

      const result = await service.updateUpdate(
        123,
        'node-456',
        'update-123',
        updateData
      );

      expect(result).toBeNull();
      expect(mockUpdatesRepository.update).not.toHaveBeenCalled();
    });

    it('should return null when update belongs to different node', async () => {
      mockNodePermissionService.canEdit.mockResolvedValue(true);
      mockUpdatesRepository.getById.mockResolvedValue({
        ...mockUpdate,
        nodeId: 'different-node',
      });

      const result = await service.updateUpdate(
        123,
        'node-456',
        'update-123',
        updateData
      );

      expect(result).toBeNull();
      expect(mockUpdatesRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error when user lacks edit permission', async () => {
      mockNodePermissionService.canEdit.mockResolvedValue(false);

      await expect(
        service.updateUpdate(123, 'node-456', 'update-123', updateData)
      ).rejects.toThrow('Insufficient permissions to update');

      expect(mockUpdatesRepository.getById).not.toHaveBeenCalled();
    });
  });

  describe('deleteUpdate', () => {
    it('should delete when user has edit permission and update exists', async () => {
      mockNodePermissionService.canEdit.mockResolvedValue(true);
      mockUpdatesRepository.belongsToNode.mockResolvedValue(true);
      mockUpdatesRepository.softDelete.mockResolvedValue(true);

      const result = await service.deleteUpdate(123, 'node-456', 'update-123');

      expect(mockNodePermissionService.canEdit).toHaveBeenCalledWith(
        123,
        'node-456'
      );
      expect(mockUpdatesRepository.belongsToNode).toHaveBeenCalledWith(
        'update-123',
        'node-456'
      );
      expect(mockUpdatesRepository.softDelete).toHaveBeenCalledWith(
        'update-123'
      );
      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Deleted update', {
        updateId: 'update-123',
        nodeId: 'node-456',
        userId: 123,
      });
    });

    it('should return false when update does not belong to node', async () => {
      mockNodePermissionService.canEdit.mockResolvedValue(true);
      mockUpdatesRepository.belongsToNode.mockResolvedValue(false);

      const result = await service.deleteUpdate(123, 'node-456', 'update-123');

      expect(result).toBe(false);
      expect(mockUpdatesRepository.softDelete).not.toHaveBeenCalled();
    });

    it('should throw error when user lacks edit permission', async () => {
      mockNodePermissionService.canEdit.mockResolvedValue(false);

      await expect(
        service.deleteUpdate(123, 'node-456', 'update-123')
      ).rejects.toThrow('Insufficient permissions to delete update');

      expect(mockUpdatesRepository.belongsToNode).not.toHaveBeenCalled();
    });
  });
});
