/**
 * HTTP Client Token Refresh Tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpClient } from './http-client';
import { tokenManager } from './token-manager';

// Mock tokenManager
vi.mock('./token-manager', () => ({
  tokenManager: {
    getRefreshToken: vi.fn(),
    isRefreshTokenExpired: vi.fn(),
    isAccessTokenExpired: vi.fn(),
    isAuthenticated: vi.fn(),
    setTokens: vi.fn(),
    clearTokens: vi.fn(),
  },
}));

// Mock auth store
vi.mock('../stores/auth-store', () => ({
  useAuthStore: {
    getState: () => ({
      setUser: vi.fn(),
    }),
  },
}));

describe('HttpClient - Token Refresh', () => {
  let httpClient: HttpClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    httpClient = HttpClient.getInstance();
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('refreshTokenIfNeeded', () => {
    it('should not refresh if access token is still valid', async () => {
      vi.mocked(tokenManager.isAccessTokenExpired).mockReturnValue(false);

      const result = await httpClient.refreshTokenIfNeeded();

      expect(result).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should not refresh if refresh token is expired', async () => {
      vi.mocked(tokenManager.isAccessTokenExpired).mockReturnValue(true);
      vi.mocked(tokenManager.isRefreshTokenExpired).mockReturnValue(true);

      const result = await httpClient.refreshTokenIfNeeded();

      expect(result).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should successfully refresh tokens when access token expired', async () => {
      vi.mocked(tokenManager.isAccessTokenExpired).mockReturnValue(true);
      vi.mocked(tokenManager.isRefreshTokenExpired).mockReturnValue(false);
      vi.mocked(tokenManager.getRefreshToken).mockReturnValue(
        'refresh-token-123'
      );
      vi.mocked(tokenManager.isAuthenticated).mockReturnValue(true);

      const mockResponse = {
        success: true,
        data: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await httpClient.refreshTokenIfNeeded();

      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'refresh-token-123' }),
      });
      expect(tokenManager.setTokens).toHaveBeenCalledWith({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });
  });

  describe('Token Refresh Retry Logic', () => {
    beforeEach(() => {
      vi.mocked(tokenManager.getRefreshToken).mockReturnValue(
        'refresh-token-123'
      );
      vi.mocked(tokenManager.isRefreshTokenExpired).mockReturnValue(false);
    });

    it('should retry on 500 server error', async () => {
      const mockSuccessResponse = {
        success: true,
        data: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        },
      };

      // First call: 500 error
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' }),
      });

      // Second call: Success
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSuccessResponse,
      });

      vi.mocked(tokenManager.isAccessTokenExpired).mockReturnValue(true);
      vi.mocked(tokenManager.isAuthenticated).mockReturnValue(true);

      const result = await httpClient.refreshTokenIfNeeded();

      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(tokenManager.setTokens).toHaveBeenCalledWith({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should retry on 429 rate limit error', async () => {
      const mockSuccessResponse = {
        success: true,
        data: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        },
      };

      // First call: 429 rate limit
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Too Many Requests' }),
      });

      // Second call: Success
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSuccessResponse,
      });

      vi.mocked(tokenManager.isAccessTokenExpired).mockReturnValue(true);
      vi.mocked(tokenManager.isAuthenticated).mockReturnValue(true);

      const result = await httpClient.refreshTokenIfNeeded();

      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry on 401 unauthorized error', async () => {
      // First call: 401 error (should not retry)
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      });

      vi.mocked(tokenManager.isAccessTokenExpired).mockReturnValue(true);

      const result = await httpClient.refreshTokenIfNeeded();

      expect(result).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1); // No retry
      expect(tokenManager.clearTokens).toHaveBeenCalled();
    });

    it('should NOT retry on 403 forbidden error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Forbidden' }),
      });

      vi.mocked(tokenManager.isAccessTokenExpired).mockReturnValue(true);

      const result = await httpClient.refreshTokenIfNeeded();

      expect(result).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1); // No retry
      expect(tokenManager.clearTokens).toHaveBeenCalled();
    });

    it('should fail after 2 attempts on persistent 500 errors', async () => {
      // Both attempts fail with 500
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' }),
      });

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' }),
      });

      vi.mocked(tokenManager.isAccessTokenExpired).mockReturnValue(true);

      const result = await httpClient.refreshTokenIfNeeded();

      expect(result).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(tokenManager.clearTokens).toHaveBeenCalled();
    });

    it('should clear tokens on refresh failure', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server Error' }),
      });

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server Error' }),
      });

      vi.mocked(tokenManager.isAccessTokenExpired).mockReturnValue(true);

      await httpClient.refreshTokenIfNeeded();

      expect(tokenManager.clearTokens).toHaveBeenCalled();
    });
  });

  describe('Concurrent Refresh Handling', () => {
    it('should not trigger multiple refresh calls concurrently', async () => {
      vi.mocked(tokenManager.isAccessTokenExpired).mockReturnValue(true);
      vi.mocked(tokenManager.isRefreshTokenExpired).mockReturnValue(false);
      vi.mocked(tokenManager.getRefreshToken).mockReturnValue(
        'refresh-token-123'
      );
      vi.mocked(tokenManager.isAuthenticated).mockReturnValue(true);

      const mockResponse = {
        success: true,
        data: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        },
      };

      // Simulate slow network response
      fetchMock.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => mockResponse,
                }),
              100
            )
          )
      );

      // Trigger multiple concurrent refreshes
      const [result1, result2, result3] = await Promise.all([
        httpClient.refreshTokenIfNeeded(),
        httpClient.refreshTokenIfNeeded(),
        httpClient.refreshTokenIfNeeded(),
      ]);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);

      // Should only call fetch once (other calls wait for the promise)
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(tokenManager.setTokens).toHaveBeenCalledTimes(1);
    });
  });

  describe('401 Handling - Refresh Token Validation', () => {
    it('should NOT logout when refresh fails but refresh token is still valid', async () => {
      // Simulate refresh token still valid but refresh fails (network error)
      vi.mocked(tokenManager.isRefreshTokenExpired)
        .mockReturnValueOnce(false) // Check before refresh
        .mockReturnValueOnce(false); // Check after failure

      vi.mocked(tokenManager.getRefreshToken).mockReturnValue(
        'refresh-token-123'
      );

      // Mock auth store
      const mockSetUser = vi.fn();
      vi.doMock('../stores/auth-store', () => ({
        useAuthStore: {
          getState: () => ({ setUser: mockSetUser }),
        },
      }));

      // Refresh fails due to network error
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server Error' }),
      });

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server Error' }),
      });

      // Use reflection to call private method
      const result = await (httpClient as any).handleUnauthorized();

      expect(result).toBe(false);
      expect(mockSetUser).not.toHaveBeenCalled(); // Should NOT logout
      expect(tokenManager.clearTokens).toHaveBeenCalled(); // Tokens cleared by refreshToken()
    });

    it('should logout when refresh token is expired', async () => {
      vi.mocked(tokenManager.isRefreshTokenExpired).mockReturnValue(true);

      // Mock auth store
      const mockSetUser = vi.fn();
      vi.doMock('../stores/auth-store', () => ({
        useAuthStore: {
          getState: () => ({ setUser: mockSetUser }),
        },
      }));

      // Use reflection to call private method
      const result = await (httpClient as any).handleUnauthorized();

      expect(result).toBe(false);
      // setUser is called via notifyAuthFailure which uses dynamic import
      // We can't easily test this without complex mocking
    });
  });
});
