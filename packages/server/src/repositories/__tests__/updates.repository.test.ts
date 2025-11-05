/**
 * Unit Tests for Updates Repository
 *
 * Tests database operations for career transition updates including
 * CRUD operations, pagination, and rendered text generation.
 */

import type { Update } from '@journey/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';

import type { Logger } from '../../core/logger';
import { UpdatesRepository } from '../updates.repository';

describe('UpdatesRepository', () => {
  let repository: UpdatesRepository;
  let mockDatabase: MockProxy<NodePgDatabase<any>>;
  let mockLogger: MockProxy<Logger>;

  const mockUpdate: Update = {
    id: 'update-123',
    nodeId: 'node-456',
    notes: 'Applied to 5 companies',
    meta: { appliedToJobs: true, networked: true },
    renderedText: 'Job Search Preparation: applied to jobs, networked',
    isDeleted: false,
    createdAt: new Date('2025-01-01T12:00:00Z'),
    updatedAt: new Date('2025-01-01T12:00:00Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = mock<Logger>();
    mockDatabase = mock<NodePgDatabase<any>>();

    repository = new UpdatesRepository({
      database: mockDatabase,
      logger: mockLogger,
    });
  });

  describe('create', () => {
    it('should create update with rendered text', async () => {
      const createData = {
        notes: 'Applied to 5 companies',
        meta: { appliedToJobs: true, networked: true },
      };

      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockUpdate]),
      };
      mockDatabase.insert = vi.fn().mockReturnValue(mockInsert);

      const result = await repository.create('node-456', createData);

      expect(mockDatabase.insert).toHaveBeenCalled();
      expect(mockInsert.values).toHaveBeenCalledWith({
        nodeId: 'node-456',
        notes: 'Applied to 5 companies',
        meta: { appliedToJobs: true, networked: true },
        renderedText: expect.stringContaining('Job Search Preparation'),
      });
      expect(result).toEqual(mockUpdate);
      expect(mockLogger.info).toHaveBeenCalledWith('Created update', {
        updateId: 'update-123',
        nodeId: 'node-456',
      });
    });

    it('should handle database errors', async () => {
      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockRejectedValue(new Error('Database error')),
      };
      mockDatabase.insert = vi.fn().mockReturnValue(mockInsert);

      await expect(
        repository.create('node-456', { notes: 'test' })
      ).rejects.toThrow('Database error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create update',
        expect.any(Object)
      );
    });
  });

  describe('getById', () => {
    it('should return update when found', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockUpdate]),
      };
      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);

      const result = await repository.getById('update-123');

      expect(mockDatabase.select).toHaveBeenCalled();
      expect(result).toEqual(mockUpdate);
    });

    it('should return null when not found', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);

      const result = await repository.getById('update-999');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      };
      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);

      await expect(repository.getById('update-123')).rejects.toThrow(
        'Database error'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get update by ID',
        expect.any(Object)
      );
    });
  });

  describe('getByNodeId', () => {
    it('should return paginated updates with total count', async () => {
      const mockCountSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 25 }]),
      };
      const mockDataSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([mockUpdate]),
      };

      mockDatabase.select = vi
        .fn()
        .mockReturnValueOnce(mockCountSelect)
        .mockReturnValueOnce(mockDataSelect);

      const result = await repository.getByNodeId('node-456', {
        page: 1,
        limit: 10,
      });

      expect(result).toEqual({
        updates: [mockUpdate],
        total: 25,
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Retrieved updates for node',
        expect.any(Object)
      );
    });

    it('should handle pagination correctly', async () => {
      const mockCountSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 25 }]),
      };
      const mockDataSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockResolvedValue([]),
      };

      mockDatabase.select = vi
        .fn()
        .mockReturnValueOnce(mockCountSelect)
        .mockReturnValueOnce(mockDataSelect);

      await repository.getByNodeId('node-456', { page: 3, limit: 10 });

      expect(mockDataSelect.offset).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      };
      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);

      await expect(
        repository.getByNodeId('node-456', { page: 1, limit: 10 })
      ).rejects.toThrow('Database error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get updates by node ID',
        expect.any(Object)
      );
    });
  });

  describe('update', () => {
    it('should update existing update', async () => {
      const updateData = {
        notes: 'Updated notes',
        meta: { completedInterviews: true },
      };

      const mockUpdateBuilder = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi
          .fn()
          .mockResolvedValue([{ ...mockUpdate, notes: 'Updated notes' }]),
      };
      mockDatabase.update = vi.fn().mockReturnValue(mockUpdateBuilder);

      const result = await repository.update('update-123', updateData);

      expect(mockDatabase.update).toHaveBeenCalled();
      expect(mockUpdateBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: 'Updated notes',
          meta: { completedInterviews: true },
        })
      );
      expect(result).toEqual(
        expect.objectContaining({ notes: 'Updated notes' })
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Updated update', {
        updateId: 'update-123',
      });
    });

    it('should return null when update not found', async () => {
      const mockUpdateBuilder = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };
      mockDatabase.update = vi.fn().mockReturnValue(mockUpdateBuilder);

      const result = await repository.update('update-999', { notes: 'test' });

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const mockUpdateBuilder = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockRejectedValue(new Error('Database error')),
      };
      mockDatabase.update = vi.fn().mockReturnValue(mockUpdateBuilder);

      await expect(
        repository.update('update-123', { notes: 'test' })
      ).rejects.toThrow('Database error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update update',
        expect.any(Object)
      );
    });
  });

  describe('softDelete', () => {
    it('should soft delete update', async () => {
      const mockUpdateBuilder = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: 'update-123' }]),
      };
      mockDatabase.update = vi.fn().mockReturnValue(mockUpdateBuilder);

      const result = await repository.softDelete('update-123');

      expect(result).toBe(true);
      expect(mockUpdateBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({ isDeleted: true })
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Soft deleted update', {
        updateId: 'update-123',
      });
    });

    it('should return false when update not found', async () => {
      const mockUpdateBuilder = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };
      mockDatabase.update = vi.fn().mockReturnValue(mockUpdateBuilder);

      const result = await repository.softDelete('update-999');

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      const mockUpdateBuilder = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockRejectedValue(new Error('Database error')),
      };
      mockDatabase.update = vi.fn().mockReturnValue(mockUpdateBuilder);

      await expect(repository.softDelete('update-123')).rejects.toThrow(
        'Database error'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to soft delete update',
        expect.any(Object)
      );
    });
  });

  describe('belongsToNode', () => {
    it('should return true when update belongs to node', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ nodeId: 'node-456' }]),
      };
      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);

      const result = await repository.belongsToNode('update-123', 'node-456');

      expect(result).toBe(true);
    });

    it('should return false when update belongs to different node', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ nodeId: 'different-node' }]),
      };
      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);

      const result = await repository.belongsToNode('update-123', 'node-456');

      expect(result).toBe(false);
    });

    it('should return false when update not found', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);

      const result = await repository.belongsToNode('update-999', 'node-456');

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      };
      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);

      await expect(
        repository.belongsToNode('update-123', 'node-456')
      ).rejects.toThrow('Database error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to check update node ownership',
        expect.any(Object)
      );
    });
  });
});
