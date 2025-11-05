/**
 * Unit Tests for Refresh Token Repository
 *
 * Tests database operations for JWT refresh token storage including
 * validation, revocation, expiration cleanup, and statistics.
 */

import type { RefreshTokenRecord } from '@journey/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';

import { DatabaseRefreshTokenRepository } from '../refresh-token.repository';

describe('DatabaseRefreshTokenRepository', () => {
  let repository: DatabaseRefreshTokenRepository;
  let mockDatabase: MockProxy<NodePgDatabase<any>>;

  const mockTokenRecord: RefreshTokenRecord = {
    tokenId: 'token-123',
    userId: 456,
    tokenHash: 'hash-abc',
    expiresAt: new Date('2025-02-01T12:00:00Z'),
    createdAt: new Date('2025-01-01T12:00:00Z'),
    lastUsedAt: new Date('2025-01-15T12:00:00Z'),
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDatabase = mock<NodePgDatabase<any>>();

    repository = new DatabaseRefreshTokenRepository({
      database: mockDatabase,
    });
  });

  describe('storeRefreshToken', () => {
    it('should store refresh token with metadata', async () => {
      const mockInsert = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockDatabase.insert = vi.fn().mockReturnValue(mockInsert);

      await repository.storeRefreshToken(
        'token-123',
        456,
        'hash-abc',
        new Date('2025-02-01T12:00:00Z'),
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        }
      );

      expect(mockDatabase.insert).toHaveBeenCalled();
      expect(mockInsert.values).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenId: 'token-123',
          userId: 456,
          tokenHash: 'hash-abc',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        })
      );
    });

    it('should store refresh token without metadata', async () => {
      const mockInsert = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      mockDatabase.insert = vi.fn().mockReturnValue(mockInsert);

      await repository.storeRefreshToken(
        'token-123',
        456,
        'hash-abc',
        new Date('2025-02-01T12:00:00Z')
      );

      expect(mockInsert.values).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenId: 'token-123',
          userId: 456,
          tokenHash: 'hash-abc',
          ipAddress: undefined,
          userAgent: undefined,
        })
      );
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate and update last used time for valid token', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([
          {
            ...mockTokenRecord,
            revokedAt: null,
          },
        ]),
      };
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);
      mockDatabase.update = vi.fn().mockReturnValue(mockUpdate);

      const result = await repository.validateRefreshToken(
        'token-123',
        'hash-abc'
      );

      expect(mockDatabase.select).toHaveBeenCalled();
      expect(mockDatabase.update).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          tokenId: 'token-123',
          userId: 456,
          tokenHash: 'hash-abc',
        })
      );
    });

    it('should return null for non-existent token', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);

      const result = await repository.validateRefreshToken(
        'token-999',
        'hash-xyz'
      );

      expect(result).toBeNull();
    });

    it('should return null for revoked token', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);

      const result = await repository.validateRefreshToken(
        'token-123',
        'hash-abc'
      );

      expect(result).toBeNull();
    });
  });

  describe('updateLastUsedAt', () => {
    it('should update last used timestamp', async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };
      mockDatabase.update = vi.fn().mockReturnValue(mockUpdate);

      await repository.updateLastUsedAt('token-123');

      expect(mockDatabase.update).toHaveBeenCalled();
      expect(mockUpdate.set).toHaveBeenCalledWith(
        expect.objectContaining({ lastUsedAt: expect.any(Date) })
      );
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke token and return true when token exists', async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      };
      mockDatabase.update = vi.fn().mockReturnValue(mockUpdate);

      const result = await repository.revokeRefreshToken('token-123');

      expect(result).toBe(true);
      expect(mockUpdate.set).toHaveBeenCalledWith(
        expect.objectContaining({ revokedAt: expect.any(Date) })
      );
    });

    it('should return false when token does not exist', async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue({ rowCount: 0 }),
      };
      mockDatabase.update = vi.fn().mockReturnValue(mockUpdate);

      const result = await repository.revokeRefreshToken('token-999');

      expect(result).toBe(false);
    });

    it('should handle null rowCount', async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue({ rowCount: null }),
      };
      mockDatabase.update = vi.fn().mockReturnValue(mockUpdate);

      const result = await repository.revokeRefreshToken('token-123');

      expect(result).toBe(false);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all user tokens and return count', async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue({ rowCount: 3 }),
      };
      mockDatabase.update = vi.fn().mockReturnValue(mockUpdate);

      const result = await repository.revokeAllUserTokens(456);

      expect(result).toBe(3);
      expect(mockDatabase.update).toHaveBeenCalled();
    });

    it('should return 0 when user has no active tokens', async () => {
      const mockUpdate = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue({ rowCount: 0 }),
      };
      mockDatabase.update = vi.fn().mockReturnValue(mockUpdate);

      const result = await repository.revokeAllUserTokens(999);

      expect(result).toBe(0);
    });
  });

  describe('getUserTokens', () => {
    it('should return all active tokens for user', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([mockTokenRecord]),
      };
      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);

      const result = await repository.getUserTokens(456);

      expect(mockDatabase.select).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          tokenId: 'token-123',
          userId: 456,
        })
      );
    });

    it('should return empty array when user has no active tokens', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };
      mockDatabase.select = vi.fn().mockReturnValue(mockSelect);

      const result = await repository.getUserTokens(999);

      expect(result).toEqual([]);
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired and old revoked tokens', async () => {
      const mockDelete = {
        where: vi
          .fn()
          .mockResolvedValueOnce({ rowCount: 5 })
          .mockResolvedValueOnce({ rowCount: 3 }),
      };
      mockDatabase.delete = vi.fn().mockReturnValue(mockDelete);

      const result = await repository.cleanupExpiredTokens();

      expect(result).toBe(8);
      expect(mockDatabase.delete).toHaveBeenCalledTimes(2);
    });

    it('should handle null rowCount', async () => {
      const mockDelete = {
        where: vi.fn().mockResolvedValue({ rowCount: null }),
      };
      mockDatabase.delete = vi.fn().mockReturnValue(mockDelete);

      const result = await repository.cleanupExpiredTokens();

      expect(result).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return token statistics', async () => {
      // Mock 4 different select queries for total, active, expired, revoked
      mockDatabase.select = vi
        .fn()
        .mockReturnValueOnce({
          from: vi
            .fn()
            .mockResolvedValue([
              { count: '1' },
              { count: '2' },
              { count: '3' },
            ]),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ count: '1' }, { count: '2' }]),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ count: '1' }]),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ count: '1' }, { count: '2' }]),
        });

      const result = await repository.getStats();

      expect(result).toEqual({
        totalTokens: 3,
        activeTokens: 2,
        expiredTokens: 1,
        revokedTokens: 1,
      });
    });

    it('should handle empty database', async () => {
      // Mock 4 select queries that all return empty arrays
      mockDatabase.select = vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockResolvedValue([]),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        });

      const result = await repository.getStats();

      expect(result).toEqual({
        totalTokens: 0,
        activeTokens: 0,
        expiredTokens: 0,
        revokedTokens: 0,
      });
    });
  });
});
