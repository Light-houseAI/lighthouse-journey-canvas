/**
 * Token Manager Tests
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { TokenManager } from './token-manager';

describe('TokenManager', () => {
  let tokenManager: TokenManager;

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();

    // Get fresh instance
    tokenManager = TokenManager.getInstance();
    tokenManager.clearTokens();
  });

  describe('getAccessTokenExpiry', () => {
    it('should return null when no access token exists', () => {
      const expiry = tokenManager.getAccessTokenExpiry();
      expect(expiry).toBeNull();
    });

    it('should return null when access token is invalid', () => {
      // Set invalid token
      localStorage.setItem('lighthouse_access_token', 'invalid.token.here');

      const expiry = tokenManager.getAccessTokenExpiry();
      expect(expiry).toBeNull();
    });

    it('should return expiry timestamp from valid access token', () => {
      // Create a mock JWT token with expiry set to 1 hour from now
      const now = Math.floor(Date.now() / 1000);
      const exp = now + 3600; // 1 hour from now

      const payload = {
        userId: 1,
        email: 'test@example.com',
        iat: now,
        exp: exp,
        iss: 'test',
        aud: 'test',
      };

      // Create mock JWT (header.payload.signature)
      const mockToken = `header.${btoa(JSON.stringify(payload))}.signature`;

      tokenManager.setTokens({
        accessToken: mockToken,
        refreshToken: 'refresh-token',
      });

      const expiry = tokenManager.getAccessTokenExpiry();
      expect(expiry).toBe(exp);
    });

    it('should return null when token has no exp claim', () => {
      const payload = {
        userId: 1,
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        iss: 'test',
        aud: 'test',
        // No exp field
      };

      const mockToken = `header.${btoa(JSON.stringify(payload))}.signature`;

      tokenManager.setTokens({
        accessToken: mockToken,
        refreshToken: 'refresh-token',
      });

      const expiry = tokenManager.getAccessTokenExpiry();
      expect(expiry).toBeNull();
    });
  });

  describe('isAccessTokenExpired with buffer', () => {
    it('should return true when token expires within 30 second buffer', () => {
      const now = Math.floor(Date.now() / 1000);
      const exp = now + 20; // Expires in 20 seconds (within 30s buffer)

      const payload = {
        userId: 1,
        email: 'test@example.com',
        iat: now,
        exp: exp,
        iss: 'test',
        aud: 'test',
      };

      const mockToken = `header.${btoa(JSON.stringify(payload))}.signature`;

      tokenManager.setTokens({
        accessToken: mockToken,
        refreshToken: 'refresh-token',
      });

      expect(tokenManager.isAccessTokenExpired()).toBe(true);
    });

    it('should return false when token expires after 30 second buffer', () => {
      const now = Math.floor(Date.now() / 1000);
      const exp = now + 60; // Expires in 60 seconds (beyond 30s buffer)

      const payload = {
        userId: 1,
        email: 'test@example.com',
        iat: now,
        exp: exp,
        iss: 'test',
        aud: 'test',
      };

      const mockToken = `header.${btoa(JSON.stringify(payload))}.signature`;

      tokenManager.setTokens({
        accessToken: mockToken,
        refreshToken: 'refresh-token',
      });

      expect(tokenManager.isAccessTokenExpired()).toBe(false);
    });

    it('should return true when token is already expired', () => {
      const now = Math.floor(Date.now() / 1000);
      const exp = now - 100; // Already expired

      const payload = {
        userId: 1,
        email: 'test@example.com',
        iat: now - 1000,
        exp: exp,
        iss: 'test',
        aud: 'test',
      };

      const mockToken = `header.${btoa(JSON.stringify(payload))}.signature`;

      tokenManager.setTokens({
        accessToken: mockToken,
        refreshToken: 'refresh-token',
      });

      expect(tokenManager.isAccessTokenExpired()).toBe(true);
    });
  });
});
