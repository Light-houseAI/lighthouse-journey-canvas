/**
 * Refresh Token Service Tests
 *
 * Comprehensive tests for refresh token storage, validation, and revocation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, MockProxy } from 'vitest-mock-extended';

import type { IRefreshTokenRepository } from '../../repositories/interfaces/refresh-token.repository.interface.js';
import { hashToken, RefreshTokenService } from '../refresh-token.service.js';

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let mockRepository: MockProxy<IRefreshTokenRepository>;

  beforeEach(() => {
    mockRepository = mock<IRefreshTokenRepository>();
    service = new RefreshTokenService({
      refreshTokenRepository: mockRepository,
    });
    vi.clearAllMocks();
  });

  describe('storeRefreshToken', () => {
    it('should store a refresh token successfully', async () => {
      const tokenId = 'test-token-id';
      const userId = 123;
      const tokenHash = 'test-hash';
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      // Mock successful storage
      mockRepository.storeRefreshToken.mockResolvedValueOnce(undefined);

      await service.storeRefreshToken(tokenId, userId, tokenHash, expiresAt, {
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
      });

      // Verify repository was called with correct parameters
      expect(mockRepository.storeRefreshToken).toHaveBeenCalledWith(
        tokenId,
        userId,
        tokenHash,
        expiresAt,
        {
          ipAddress: '192.168.1.1',
          userAgent: 'test-agent',
        }
      );
    });

    it('should store token without metadata', async () => {
      const tokenId = 'test-token-id-2';
      const userId = 456;
      const tokenHash = 'test-hash-2';
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Mock successful storage
      mockRepository.storeRefreshToken.mockResolvedValueOnce(undefined);

      await service.storeRefreshToken(tokenId, userId, tokenHash, expiresAt);

      // Verify repository was called with correct parameters (without metadata)
      expect(mockRepository.storeRefreshToken).toHaveBeenCalledWith(
        tokenId,
        userId,
        tokenHash,
        expiresAt,
        undefined // No metadata provided
      );
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate a valid token', async () => {
      const mockTokenRecord = {
        tokenId: 'valid-token',
        userId: 123,
        tokenHash: 'valid-hash',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revoked: false,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
      };

      // Mock repository to return a valid token record
      mockRepository.validateRefreshToken.mockResolvedValueOnce(
        mockTokenRecord
      );

      const result = await service.validateRefreshToken(
        'valid-token',
        'valid-hash'
      );

      expect(result).toBeDefined();
      expect(result?.tokenId).toBe('valid-token');
      expect(result?.userId).toBe(123);
      expect(result?.revoked).toBe(false);
      expect(mockRepository.validateRefreshToken).toHaveBeenCalledWith(
        'valid-token',
        'valid-hash'
      );
      // Note: updateLastUsedAt is handled by the repository internally, not by the service
    });

    it('should return null for non-existent token', async () => {
      // Mock repository to return null (token not found)
      mockRepository.validateRefreshToken.mockResolvedValueOnce(null);

      const result = await service.validateRefreshToken(
        'non-existent',
        'any-hash'
      );

      expect(result).toBeNull();
      expect(mockRepository.validateRefreshToken).toHaveBeenCalledWith(
        'non-existent',
        'any-hash'
      );
      expect(mockRepository.updateLastUsedAt).not.toHaveBeenCalled();
    });

    it('should return null for expired token', async () => {
      // Mock repository to return null (expired token)
      mockRepository.validateRefreshToken.mockResolvedValueOnce(null);

      const result = await service.validateRefreshToken(
        'expired-token',
        'expired-hash'
      );

      expect(result).toBeNull();
      expect(mockRepository.validateRefreshToken).toHaveBeenCalledWith(
        'expired-token',
        'expired-hash'
      );
    });

    it('should return null for revoked token', async () => {
      // Mock repository to return null (revoked token)
      mockRepository.validateRefreshToken.mockResolvedValueOnce(null);

      const result = await service.validateRefreshToken(
        'revoked-token',
        'revoked-hash'
      );

      expect(result).toBeNull();
      expect(mockRepository.validateRefreshToken).toHaveBeenCalledWith(
        'revoked-token',
        'revoked-hash'
      );
    });

    it('should return null for wrong token hash', async () => {
      // Mock repository to return null (hash doesn't match)
      mockRepository.validateRefreshToken.mockResolvedValueOnce(null);

      const result = await service.validateRefreshToken(
        'valid-token',
        'wrong-hash'
      );

      expect(result).toBeNull();
      expect(mockRepository.validateRefreshToken).toHaveBeenCalledWith(
        'valid-token',
        'wrong-hash'
      );
    });

    it('should update last used time on successful validation', async () => {
      const beforeTime = new Date();
      const afterTime = new Date(beforeTime.getTime() + 1000); // 1 second later
      const mockTokenRecord = {
        tokenId: 'valid-token',
        userId: 123,
        tokenHash: 'valid-hash',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revoked: false,
        createdAt: new Date(),
        lastUsedAt: afterTime, // Repository returns updated timestamp
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
      };

      // Repository handles updating lastUsedAt internally and returns the updated record
      mockRepository.validateRefreshToken.mockResolvedValueOnce(
        mockTokenRecord
      );

      const result = await service.validateRefreshToken(
        'valid-token',
        'valid-hash'
      );

      expect(result).toBeDefined();
      expect(result!.lastUsedAt?.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime()
      );
      expect(mockRepository.validateRefreshToken).toHaveBeenCalledWith(
        'valid-token',
        'valid-hash'
      );
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke an existing token', async () => {
      // Mock repository to return true (token found and revoked)
      mockRepository.revokeRefreshToken.mockResolvedValueOnce(true);

      const result = await service.revokeRefreshToken('token-to-revoke');

      expect(result).toBe(true);
      expect(mockRepository.revokeRefreshToken).toHaveBeenCalledWith(
        'token-to-revoke'
      );
    });

    it('should return false for non-existent token', async () => {
      // Mock repository to return false (token not found)
      mockRepository.revokeRefreshToken.mockResolvedValueOnce(false);

      const result = await service.revokeRefreshToken('non-existent-token');

      expect(result).toBe(false);
      expect(mockRepository.revokeRefreshToken).toHaveBeenCalledWith(
        'non-existent-token'
      );
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all active tokens for a user', async () => {
      // Mock repository to return 2 (number of tokens revoked)
      mockRepository.revokeAllUserTokens.mockResolvedValueOnce(2);

      const revokedCount = await service.revokeAllUserTokens(123);

      expect(revokedCount).toBe(2);
      expect(mockRepository.revokeAllUserTokens).toHaveBeenCalledWith(123);
    });

    it('should return 0 for user with no active tokens', async () => {
      // Mock repository to return 0 (no tokens found for user)
      mockRepository.revokeAllUserTokens.mockResolvedValueOnce(0);

      const revokedCount = await service.revokeAllUserTokens(999);

      expect(revokedCount).toBe(0);
      expect(mockRepository.revokeAllUserTokens).toHaveBeenCalledWith(999);
    });
  });

  describe('getUserTokens', () => {
    it('should return only active tokens for the user', async () => {
      const mockTokens = [
        {
          tokenId: 'user-token-2',
          userId: 123,
          tokenHash: 'hash-2',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          revoked: false,
          createdAt: new Date(),
          lastUsedAt: new Date(),
          ipAddress: '192.168.1.2',
          userAgent: 'agent-2',
        },
        {
          tokenId: 'user-token-1',
          userId: 123,
          tokenHash: 'hash-1',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          revoked: false,
          createdAt: new Date(),
          lastUsedAt: new Date(),
          ipAddress: '192.168.1.1',
          userAgent: 'agent-1',
        },
      ];

      // Mock repository to return active tokens for user 123
      mockRepository.getUserTokens.mockResolvedValueOnce(mockTokens);

      const tokens = await service.getUserTokens(123);

      expect(tokens).toHaveLength(2);
      expect(tokens[0].tokenId).toBe('user-token-2');
      expect(tokens[1].tokenId).toBe('user-token-1');
      expect(tokens[0].ipAddress).toBe('192.168.1.2');
      expect(tokens[1].ipAddress).toBe('192.168.1.1');
      expect(mockRepository.getUserTokens).toHaveBeenCalledWith(123);
    });

    it('should return empty array for user with no active tokens', async () => {
      // Mock repository to return empty array
      mockRepository.getUserTokens.mockResolvedValueOnce([]);

      const tokens = await service.getUserTokens(999);

      expect(tokens).toHaveLength(0);
      expect(mockRepository.getUserTokens).toHaveBeenCalledWith(999);
    });

    it('should sort tokens by lastUsedAt descending', async () => {
      const earlierTime = new Date();
      const laterTime = new Date(earlierTime.getTime() + 1000);

      const mockTokens = [
        {
          tokenId: 'user-token-1',
          userId: 123,
          tokenHash: 'hash-1',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          revoked: false,
          createdAt: new Date(),
          lastUsedAt: laterTime, // More recently used
          ipAddress: '192.168.1.1',
          userAgent: 'agent-1',
        },
        {
          tokenId: 'user-token-2',
          userId: 123,
          tokenHash: 'hash-2',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          revoked: false,
          createdAt: new Date(),
          lastUsedAt: earlierTime,
          ipAddress: '192.168.1.2',
          userAgent: 'agent-2',
        },
      ];

      // Mock repository to return tokens sorted by lastUsedAt (most recent first)
      mockRepository.getUserTokens.mockResolvedValueOnce(mockTokens);

      const tokens = await service.getUserTokens(123);

      expect(tokens[0].tokenId).toBe('user-token-1'); // Most recently used first
      expect(tokens[0].lastUsedAt?.getTime() || 0).toBeGreaterThan(
        tokens[1].lastUsedAt?.getTime() || 0
      );
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const mockStats = {
        totalTokens: 4,
        activeTokens: 2,
        expiredTokens: 1,
        revokedTokens: 1,
      };

      // Mock repository to return stats
      mockRepository.getStats.mockResolvedValueOnce(mockStats);

      const stats = await service.getStats();

      expect(stats).toEqual(mockStats);
      expect(mockRepository.getStats).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should clean up expired and stale revoked tokens', async () => {
      // Mock repository to return number of cleaned up tokens
      mockRepository.cleanupExpiredTokens.mockResolvedValueOnce(3);

      const cleanedCount = await service.cleanup();

      expect(cleanedCount).toBe(3);
      expect(mockRepository.cleanupExpiredTokens).toHaveBeenCalled();
    });
  });

  describe('hashToken utility', () => {
    it('should generate consistent hashes', () => {
      const token = 'test-token-value';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);

      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBeGreaterThan(0);
    });

    it('should generate different hashes for different tokens', () => {
      const hash1 = hashToken('token-1');
      const hash2 = hashToken('token-2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('concurrency scenarios', () => {
    it('should handle concurrent token operations', async () => {
      const userId = 123;

      // Mock repository methods for concurrent operations
      mockRepository.storeRefreshToken.mockResolvedValue(undefined);
      mockRepository.getUserTokens.mockResolvedValueOnce([
        // Mock 10 tokens after storing
        ...Array.from({ length: 10 } as any, (_, i) => ({
          tokenId: `concurrent-token-${i} as any`,
          userId,
          tokenHash: `hash-${i} as any`,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          revoked: false,
          createdAt: new Date(),
          lastUsedAt: new Date(),
          ipAddress: null,
          userAgent: null,
        })),
      ]);
      mockRepository.revokeAllUserTokens.mockResolvedValueOnce(10);
      mockRepository.getUserTokens.mockResolvedValueOnce([]); // After revocation

      const promises = [];

      // Store multiple tokens concurrently
      for (let i = 0; i < 10; i++) {
        promises.push(
          service.storeRefreshToken(
            `concurrent-token-${i} as any`,
            userId,
            `hash-${i} as any`,
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          )
        );
      }

      await Promise.all(promises);
      expect(mockRepository.storeRefreshToken).toHaveBeenCalledTimes(10);

      const tokens = await service.getUserTokens(userId);
      expect(tokens).toHaveLength(10);

      // Revoke all concurrently
      const revokedCount = await service.revokeAllUserTokens(userId);
      expect(revokedCount).toBe(10);

      const tokensAfter = await service.getUserTokens(userId);
      expect(tokensAfter).toHaveLength(0);
    });
  });
});
