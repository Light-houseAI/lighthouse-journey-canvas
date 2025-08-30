/**
 * Refresh Token Service Tests
 *
 * Comprehensive tests for refresh token storage, validation, and revocation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RefreshTokenService, hashToken } from '../refresh-token.service';

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;

  beforeEach(() => {
    service = new RefreshTokenService();
    vi.clearAllMocks();
  });

  describe('storeRefreshToken', () => {
    it('should store a refresh token successfully', async () => {
      const tokenId = 'test-token-id';
      const userId = 123;
      const tokenHash = 'test-hash';
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await service.storeRefreshToken(tokenId, userId, tokenHash, expiresAt, {
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
      });

      // Verify token was stored by attempting to validate it
      const result = await service.validateRefreshToken(tokenId, tokenHash);
      expect(result).toMatchObject({
        tokenId,
        userId,
        tokenHash,
        revoked: false,
      });
      expect(result?.expiresAt.getTime()).toBe(expiresAt.getTime());
      expect(result?.ipAddress).toBe('192.168.1.1');
      expect(result?.userAgent).toBe('test-agent');
    });

    it('should store token without metadata', async () => {
      const tokenId = 'test-token-id-2';
      const userId = 456;
      const tokenHash = 'test-hash-2';
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await service.storeRefreshToken(tokenId, userId, tokenHash, expiresAt);

      const result = await service.validateRefreshToken(tokenId, tokenHash);
      expect(result).toMatchObject({
        tokenId,
        userId,
        tokenHash,
        revoked: false,
      });
      expect(result?.ipAddress).toBeUndefined();
      expect(result?.userAgent).toBeUndefined();
    });
  });

  describe('validateRefreshToken', () => {
    beforeEach(async () => {
      // Store some test tokens
      await service.storeRefreshToken(
        'valid-token',
        123,
        'valid-hash',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );

      await service.storeRefreshToken(
        'expired-token',
        123,
        'expired-hash',
        new Date(Date.now() - 1000) // Expired 1 second ago
      );

      await service.storeRefreshToken(
        'revoked-token',
        123,
        'revoked-hash',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );
      await service.revokeRefreshToken('revoked-token');
    });

    it('should validate a valid token', async () => {
      const result = await service.validateRefreshToken('valid-token', 'valid-hash');

      expect(result).toBeDefined();
      expect(result?.tokenId).toBe('valid-token');
      expect(result?.userId).toBe(123);
      expect(result?.revoked).toBe(false);
    });

    it('should return null for non-existent token', async () => {
      const result = await service.validateRefreshToken('non-existent', 'any-hash');
      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      const result = await service.validateRefreshToken('expired-token', 'expired-hash');
      expect(result).toBeNull();
    });

    it('should return null for revoked token', async () => {
      const result = await service.validateRefreshToken('revoked-token', 'revoked-hash');
      expect(result).toBeNull();
    });

    it('should return null for wrong token hash', async () => {
      const result = await service.validateRefreshToken('valid-token', 'wrong-hash');
      expect(result).toBeNull();
    });

    it('should update last used time on successful validation', async () => {
      const beforeTime = new Date();
      const result = await service.validateRefreshToken('valid-token', 'valid-hash');

      expect(result).toBeDefined();
      expect(result!.lastUsedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    });
  });

  describe('revokeRefreshToken', () => {
    beforeEach(async () => {
      await service.storeRefreshToken(
        'token-to-revoke',
        123,
        'hash-to-revoke',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );
    });

    it('should revoke an existing token', async () => {
      const result = await service.revokeRefreshToken('token-to-revoke');
      expect(result).toBe(true);

      // Token should now be invalid
      const validation = await service.validateRefreshToken('token-to-revoke', 'hash-to-revoke');
      expect(validation).toBeNull();
    });

    it('should return false for non-existent token', async () => {
      const result = await service.revokeRefreshToken('non-existent-token');
      expect(result).toBe(false);
    });
  });

  describe('revokeAllUserTokens', () => {
    beforeEach(async () => {
      // Store tokens for user 123
      await service.storeRefreshToken(
        'user-123-token-1',
        123,
        'hash-1',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );
      await service.storeRefreshToken(
        'user-123-token-2',
        123,
        'hash-2',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );

      // Store token for user 456
      await service.storeRefreshToken(
        'user-456-token-1',
        456,
        'hash-3',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );

      // Store already revoked token for user 123
      await service.storeRefreshToken(
        'user-123-revoked',
        123,
        'hash-4',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );
      await service.revokeRefreshToken('user-123-revoked');
    });

    it('should revoke all active tokens for a user', async () => {
      const revokedCount = await service.revokeAllUserTokens(123);
      expect(revokedCount).toBe(2); // Only active tokens

      // Verify tokens are revoked
      const token1 = await service.validateRefreshToken('user-123-token-1', 'hash-1');
      const token2 = await service.validateRefreshToken('user-123-token-2', 'hash-2');
      expect(token1).toBeNull();
      expect(token2).toBeNull();

      // Verify other user's token is not affected
      const otherUserToken = await service.validateRefreshToken('user-456-token-1', 'hash-3');
      expect(otherUserToken).toBeDefined();
    });

    it('should return 0 for user with no active tokens', async () => {
      const revokedCount = await service.revokeAllUserTokens(999);
      expect(revokedCount).toBe(0);
    });
  });

  describe('getUserTokens', () => {
    beforeEach(async () => {
      // Store tokens with different timestamps
      await service.storeRefreshToken(
        'user-token-1',
        123,
        'hash-1',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        { ipAddress: '192.168.1.1', userAgent: 'agent-1' }
      );

      // Wait a bit for different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      await service.storeRefreshToken(
        'user-token-2',
        123,
        'hash-2',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        { ipAddress: '192.168.1.2', userAgent: 'agent-2' }
      );

      // Revoked token
      await service.storeRefreshToken(
        'user-token-revoked',
        123,
        'hash-3',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );
      await service.revokeRefreshToken('user-token-revoked');

      // Expired token
      await service.storeRefreshToken(
        'user-token-expired',
        123,
        'hash-4',
        new Date(Date.now() - 1000)
      );

      // Token for different user
      await service.storeRefreshToken(
        'other-user-token',
        456,
        'hash-5',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );
    });

    it('should return only active tokens for the user', async () => {
      const tokens = await service.getUserTokens(123);

      expect(tokens).toHaveLength(2);
      expect(tokens[0].tokenId).toBe('user-token-2'); // More recent
      expect(tokens[1].tokenId).toBe('user-token-1');

      // Verify metadata is included
      expect(tokens[0].ipAddress).toBe('192.168.1.2');
      expect(tokens[1].ipAddress).toBe('192.168.1.1');
    });

    it('should return empty array for user with no active tokens', async () => {
      const tokens = await service.getUserTokens(999);
      expect(tokens).toHaveLength(0);
    });

    it('should sort tokens by lastUsedAt descending', async () => {
      // Use token 1 to update its lastUsedAt
      await service.validateRefreshToken('user-token-1', 'hash-1');

      const tokens = await service.getUserTokens(123);
      expect(tokens[0].tokenId).toBe('user-token-1'); // Now more recently used
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      // Active tokens
      await service.storeRefreshToken(
        'active-1',
        123,
        'hash-1',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );
      await service.storeRefreshToken(
        'active-2',
        123,
        'hash-2',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );

      // Revoked token
      await service.storeRefreshToken(
        'revoked-1',
        123,
        'hash-3',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );
      await service.revokeRefreshToken('revoked-1');

      // Expired token
      await service.storeRefreshToken(
        'expired-1',
        123,
        'hash-4',
        new Date(Date.now() - 1000)
      );
    });

    it('should return correct statistics', () => {
      const stats = service.getStats();

      expect(stats).toEqual({
        total: 4,
        active: 2,
        expired: 1,
        revoked: 1,
      });
    });
  });

  describe('cleanup', () => {
    it('should clean up expired and stale revoked tokens', async () => {
      // Store expired tokens
      await service.storeRefreshToken(
        'expired-1',
        123,
        'hash-1',
        new Date(Date.now() - 2000)
      );
      await service.storeRefreshToken(
        'expired-2',
        123,
        'hash-2',
        new Date(Date.now() - 1000)
      );

      // Store stale revoked token (revoked more than 24 hours ago)
      await service.storeRefreshToken(
        'stale-revoked',
        123,
        'hash-3',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );
      await service.revokeRefreshToken('stale-revoked');

      // Manually set the lastUsedAt to simulate old revocation (more than 24 hours ago)
      const staleToken = (service as any).tokens.get('stale-revoked');
      if (staleToken) {
        staleToken.lastUsedAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      }

      // Store recently revoked token (should not be cleaned up)
      await service.storeRefreshToken(
        'recent-revoked',
        123,
        'hash-4',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );
      await service.revokeRefreshToken('recent-revoked');

      // Store active token
      await service.storeRefreshToken(
        'active',
        123,
        'hash-5',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );

      const statsBefore = service.getStats();
      expect(statsBefore.total).toBe(5);

      await service.cleanup();

      const statsAfter = service.getStats();
      // Should clean up 2 expired + 1 stale revoked = 3 tokens
      // Should keep 1 recent revoked + 1 active = 2 tokens
      expect(statsAfter.total).toBe(2);
    });
  });

  describe('clearAll', () => {
    it('should clear all tokens', async () => {
      // Store some tokens
      await service.storeRefreshToken(
        'token-1',
        123,
        'hash-1',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );
      await service.storeRefreshToken(
        'token-2',
        456,
        'hash-2',
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );

      let stats = service.getStats();
      expect(stats.total).toBe(2);

      await service.clearAll();

      stats = service.getStats();
      expect(stats.total).toBe(0);
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
      const promises = [];

      // Store multiple tokens concurrently
      for (let i = 0; i < 10; i++) {
        promises.push(
          service.storeRefreshToken(
            `concurrent-token-${i}`,
            userId,
            `hash-${i}`,
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          )
        );
      }

      await Promise.all(promises);

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
