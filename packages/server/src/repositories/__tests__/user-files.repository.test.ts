/**
 * Unit Tests for User Files Repository
 *
 * Tests database operations for tracking uploaded files including
 * creation, lookup, soft deletion, and storage calculation.
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';

import type { Logger } from '../../core/logger';
import {
  type CreateUserFileInput,
  type UserFileRecord,
  UserFilesRepository,
} from '../user-files.repository';

describe('UserFilesRepository', () => {
  let repository: UserFilesRepository;
  let mockDatabase: MockProxy<NodePgDatabase<any>>;
  let mockLogger: MockProxy<Logger>;

  const mockFileRecord: UserFileRecord = {
    id: 1,
    userId: 123,
    storageKey: 'users/123/application-materials/resume/12345.pdf',
    filename: 'resume.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024 * 1024,
    fileType: 'resume',
    deletedAt: null,
    createdAt: new Date('2025-01-01T12:00:00Z'),
    updatedAt: new Date('2025-01-01T12:00:00Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = mock<Logger>();
    mockDatabase = mock<NodePgDatabase<any>>();

    repository = new UserFilesRepository({
      database: mockDatabase,
      logger: mockLogger,
    });
  });

  describe('create', () => {
    const createInput: CreateUserFileInput = {
      userId: 123,
      storageKey: 'users/123/application-materials/resume/12345.pdf',
      filename: 'resume.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024 * 1024,
      fileType: 'resume',
    };

    it('should create user file record', async () => {
      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockFileRecord]),
      };
      mockDatabase.insert = vi.fn().mockReturnValue(mockInsert);

      const result = await repository.create(createInput);

      expect(mockDatabase.insert).toHaveBeenCalled();
      expect(mockInsert.values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 123,
          storageKey: 'users/123/application-materials/resume/12345.pdf',
          filename: 'resume.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024 * 1024,
          fileType: 'resume',
        })
      );
      expect(result).toEqual(mockFileRecord);
      expect(mockLogger.info).toHaveBeenCalledWith('User file record created', {
        userId: 123,
        storageKey: 'users/123/application-materials/resume/12345.pdf',
        sizeBytes: 1024 * 1024,
      });
    });

    it('should handle database errors', async () => {
      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockRejectedValue(new Error('Database error')),
      };
      mockDatabase.insert = vi.fn().mockReturnValue(mockInsert);

      await expect(repository.create(createInput)).rejects.toThrow(
        'Database error'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error creating user file record',
        expect.any(Object)
      );
    });
  });

  describe('findByStorageKey', () => {
    it('should return file when found', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockFileRecord]),
      };
      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);

      const result = await repository.findByStorageKey(
        mockFileRecord.storageKey
      );

      expect(mockDatabase.select).toHaveBeenCalled();
      expect(result).toEqual(mockFileRecord);
    });

    it('should return null when file not found', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);

      const result = await repository.findByStorageKey('non-existent-key');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(new Error('Database error')),
      };
      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);

      await expect(repository.findByStorageKey('some-key')).rejects.toThrow(
        'Database error'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error finding file by storage key',
        expect.any(Object)
      );
    });
  });

  describe('findByUserId', () => {
    it('should return all files for user', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockFileRecord]),
      };
      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);

      const result = await repository.findByUserId(123);

      expect(mockDatabase.select).toHaveBeenCalled();
      expect(result).toEqual([mockFileRecord]);
    });

    it('should return empty array when user has no files', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);

      const result = await repository.findByUserId(999);

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      };
      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);

      await expect(repository.findByUserId(123)).rejects.toThrow(
        'Database error'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error finding files by user ID',
        expect.any(Object)
      );
    });
  });

  describe('softDelete', () => {
    it('should soft delete file and return record', async () => {
      const deletedRecord = {
        ...mockFileRecord,
        deletedAt: new Date('2025-01-15T12:00:00Z'),
      };
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([deletedRecord]),
      };
      mockDatabase.update = vi.fn().mockReturnValue(mockUpdate);

      const result = await repository.softDelete(mockFileRecord.storageKey);

      expect(mockDatabase.update).toHaveBeenCalled();
      expect(mockUpdate.set).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
      expect(result).toEqual(deletedRecord);
      expect(mockLogger.info).toHaveBeenCalledWith('User file soft deleted', {
        storageKey: mockFileRecord.storageKey,
        fileId: 1,
      });
    });

    it('should throw error when file not found', async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };
      mockDatabase.update = vi.fn().mockReturnValue(mockUpdate);

      await expect(repository.softDelete('non-existent-key')).rejects.toThrow(
        'File not found'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error soft deleting file',
        expect.any(Object)
      );
    });

    it('should handle database errors', async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockRejectedValue(new Error('Database error')),
      };
      mockDatabase.update = vi.fn().mockReturnValue(mockUpdate);

      await expect(repository.softDelete('some-key')).rejects.toThrow(
        'Database error'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error soft deleting file',
        expect.any(Object)
      );
    });
  });

  describe('getTotalStorageByUserId', () => {
    it('should calculate total storage excluding deleted files', async () => {
      const files = [
        { ...mockFileRecord, sizeBytes: 1024 * 1024, deletedAt: null },
        { ...mockFileRecord, id: 2, sizeBytes: 512 * 1024, deletedAt: null },
        {
          ...mockFileRecord,
          id: 3,
          sizeBytes: 2048 * 1024,
          deletedAt: new Date(),
        },
      ];
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(files),
      };
      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);

      const result = await repository.getTotalStorageByUserId(123);

      // Should exclude the deleted file (2048KB)
      expect(result).toBe(1024 * 1024 + 512 * 1024);
    });

    it('should return 0 when user has no files', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);

      const result = await repository.getTotalStorageByUserId(999);

      expect(result).toBe(0);
    });

    it('should return 0 when all files are deleted', async () => {
      const files = [
        { ...mockFileRecord, deletedAt: new Date() },
        { ...mockFileRecord, id: 2, deletedAt: new Date() },
      ];
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(files),
      };
      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);

      const result = await repository.getTotalStorageByUserId(123);

      expect(result).toBe(0);
    });

    it('should handle database errors', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      };
      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);

      await expect(repository.getTotalStorageByUserId(123)).rejects.toThrow(
        'Database error'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error calculating total storage',
        expect.any(Object)
      );
    });
  });
});
