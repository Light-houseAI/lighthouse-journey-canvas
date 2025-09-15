/**
 * Basic tests for Token Manager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TokenManager, tokenManager } from '../token-manager';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('TokenManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear internal state
    tokenManager.clearTokens();
  });

  describe('Token Storage', () => {
    it('should store and retrieve tokens', () => {
      const tokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      };

      tokenManager.setTokens(tokens);

      expect(tokenManager.getAccessToken()).toBe('test-access-token');
      expect(tokenManager.getRefreshToken()).toBe('test-refresh-token');
    });

    it('should clear tokens', () => {
      const tokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      };

      tokenManager.setTokens(tokens);
      tokenManager.clearTokens();

      expect(tokenManager.getAccessToken()).toBeNull();
      expect(tokenManager.getRefreshToken()).toBeNull();
    });

    it('should check authentication status', () => {
      expect(tokenManager.isAuthenticated()).toBe(false);

      const tokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      };

      tokenManager.setTokens(tokens);
      expect(tokenManager.isAuthenticated()).toBe(true);
    });
  });

  describe('Token Decoding', () => {
    it('should decode valid JWT token', () => {
      // Valid JWT token (header.payload.signature)
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImV4cCI6MTY5MDAwMDAwMH0.test-signature';
      
      const decoded = tokenManager.decodeToken(token);
      
      expect(decoded).toEqual({
        userId: 1,
        email: 'test@example.com',
        exp: 1690000000,
      });
    });

    it('should return null for invalid token', () => {
      const invalidToken = 'invalid-token';
      
      const decoded = tokenManager.decodeToken(invalidToken);
      
      expect(decoded).toBeNull();
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = TokenManager.getInstance();
      const instance2 = TokenManager.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBe(tokenManager);
    });
  });
});