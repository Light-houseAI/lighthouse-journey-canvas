/**
 * Storage Quota Service Tests
 *
 * Tests for user storage quota management including:
 * - Quota retrieval
 * - Quota checking before uploads
 * - Usage updates after uploads
 * - Auto-creation of quota records
 */

import { userStorageUsage } from '@journey/schema/schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { Database } from '../../config/database.connection';
import { StorageQuotaService } from '../storage-quota.service';

describe('StorageQuotaService', () => {
  let service: StorageQuotaService;
  let mockDatabase: ReturnType<typeof mock<Database>>;

  beforeEach(() => {
    mockDatabase = mock<Database>();
    service = new StorageQuotaService(mockDatabase);
  });

  describe('getQuota', () => {
    it('should return existing quota for user', async () => {
      const userId = 123;
      const mockQuota = {
        id: 'quota-1',
        userId: 123,
        bytesUsed: 50000000, // 50MB
        quotaBytes: 104857600, // 100MB
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockQuota]),
        }),
      } as any);

      const result = await service.getQuota(userId);

      expect(result).toEqual({
        bytesUsed: 50000000,
        quotaBytes: 104857600,
        bytesAvailable: 54857600,
        percentUsed: 47.68,
      });
    });

    it('should auto-create quota record if not exists', async () => {
      const userId = 456;

      // First call returns empty (no quota)
      mockDatabase.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      // Insert creates new quota
      const newQuota = {
        id: 'quota-2',
        userId: 456,
        bytesUsed: 0,
        quotaBytes: 104857600, // 100MB default
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([newQuota]),
          }),
        }),
      } as any);

      // Second call returns the new quota
      mockDatabase.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([newQuota]),
        }),
      } as any);

      const result = await service.getQuota(userId);

      expect(result).toEqual({
        bytesUsed: 0,
        quotaBytes: 104857600,
        bytesAvailable: 104857600,
        percentUsed: 0,
      });
    });

    it('should calculate percent used correctly', async () => {
      const userId = 789;
      const mockQuota = {
        id: 'quota-3',
        userId: 789,
        bytesUsed: 75000000, // 75MB
        quotaBytes: 100000000, // 100MB
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockQuota]),
        }),
      } as any);

      const result = await service.getQuota(userId);

      expect(result.percentUsed).toBe(75);
    });
  });

  describe('checkQuota', () => {
    it('should return true if user has enough quota', async () => {
      const userId = 123;
      const fileSize = 10000000; // 10MB

      const mockQuota = {
        id: 'quota-1',
        userId: 123,
        bytesUsed: 50000000, // 50MB used
        quotaBytes: 104857600, // 100MB total
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockQuota]),
        }),
      } as any);

      const result = await service.checkQuota(userId, fileSize);

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return false if user exceeds quota', async () => {
      const userId = 123;
      const fileSize = 60000000; // 60MB

      const mockQuota = {
        id: 'quota-1',
        userId: 123,
        bytesUsed: 50000000, // 50MB used
        quotaBytes: 104857600, // 100MB total
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockQuota]),
        }),
      } as any);

      const result = await service.checkQuota(userId, fileSize);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Insufficient storage quota');
      expect(result.bytesNeeded).toBe(60000000);
      expect(result.bytesAvailable).toBe(54857600);
    });

    it('should auto-create quota if not exists and check passes', async () => {
      const userId = 456;
      const fileSize = 5000000; // 5MB

      // First call returns empty
      mockDatabase.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      // Insert creates new quota
      const newQuota = {
        id: 'quota-2',
        userId: 456,
        bytesUsed: 0,
        quotaBytes: 104857600,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([newQuota]),
          }),
        }),
      } as any);

      // Second call returns new quota
      mockDatabase.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([newQuota]),
        }),
      } as any);

      const result = await service.checkQuota(userId, fileSize);

      expect(result.allowed).toBe(true);
    });
  });

  describe('updateUsage', () => {
    it('should atomically increment usage on upload', async () => {
      const userId = 123;
      const bytesAdded = 10000000; // 10MB

      const updatedQuota = {
        id: 'quota-1',
        userId: 123,
        bytesUsed: 60000000, // 50MB + 10MB
        quotaBytes: 104857600,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedQuota]),
          }),
        }),
      } as any);

      const result = await service.updateUsage(userId, bytesAdded);

      expect(result).toEqual({
        bytesUsed: 60000000,
        quotaBytes: 104857600,
        bytesAvailable: 44857600,
        percentUsed: 57.22,
      });

      // Verify atomic update was called
      expect(mockDatabase.update).toHaveBeenCalledWith(userStorageUsage);
    });

    it('should atomically decrement usage on deletion', async () => {
      const userId = 123;
      const bytesRemoved = -10000000; // -10MB (deletion)

      const updatedQuota = {
        id: 'quota-1',
        userId: 123,
        bytesUsed: 40000000, // 50MB - 10MB
        quotaBytes: 104857600,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedQuota]),
          }),
        }),
      } as any);

      const result = await service.updateUsage(userId, bytesRemoved);

      expect(result.bytesUsed).toBe(40000000);
    });

    it('should throw error if quota record does not exist', async () => {
      const userId = 999;
      const bytesAdded = 10000000;

      mockDatabase.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]), // No record updated
          }),
        }),
      } as any);

      await expect(service.updateUsage(userId, bytesAdded)).rejects.toThrow(
        'Quota record not found'
      );
    });

    it('should prevent negative usage', async () => {
      const userId = 123;
      const bytesRemoved = -100000000; // Try to remove 100MB

      const updatedQuota = {
        id: 'quota-1',
        userId: 123,
        bytesUsed: 0, // Clamped to 0
        quotaBytes: 104857600,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedQuota]),
          }),
        }),
      } as any);

      const result = await service.updateUsage(userId, bytesRemoved);

      expect(result.bytesUsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero bytes used', async () => {
      const userId = 123;
      const mockQuota = {
        id: 'quota-1',
        userId: 123,
        bytesUsed: 0,
        quotaBytes: 104857600,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockQuota]),
        }),
      } as any);

      const result = await service.getQuota(userId);

      expect(result.percentUsed).toBe(0);
      expect(result.bytesAvailable).toBe(104857600);
    });

    it('should handle exactly at quota limit', async () => {
      const userId = 123;
      const mockQuota = {
        id: 'quota-1',
        userId: 123,
        bytesUsed: 104857600,
        quotaBytes: 104857600,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockQuota]),
        }),
      } as any);

      const result = await service.getQuota(userId);

      expect(result.percentUsed).toBe(100);
      expect(result.bytesAvailable).toBe(0);
    });

    it('should reject upload if exactly at quota limit', async () => {
      const userId = 123;
      const fileSize = 1; // Even 1 byte

      const mockQuota = {
        id: 'quota-1',
        userId: 123,
        bytesUsed: 104857600,
        quotaBytes: 104857600,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockQuota]),
        }),
      } as any);

      const result = await service.checkQuota(userId, fileSize);

      expect(result.allowed).toBe(false);
    });
  });
});
