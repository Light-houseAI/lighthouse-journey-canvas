/**
 * Component Tests for HTTP Client
 * Tests client-specific API interactions, authentication flows, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HttpClient, httpClient } from '../http-client';
import { tokenManager } from '../token-manager';

// Mock token manager
vi.mock('../token-manager', () => ({
  tokenManager: {
    getAccessToken: vi.fn(),
    getRefreshToken: vi.fn(),
    setTokens: vi.fn(),
    clearTokens: vi.fn(),
    isAuthenticated: vi.fn(),
    isRefreshTokenExpired: vi.fn(),
  },
}));

// Mock fetch
global.fetch = vi.fn();

describe('HttpClient Component Tests', () => {
  let client: HttpClient;

  beforeEach(() => {
    client = HttpClient.getInstance();
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authentication Flow', () => {
    it('should attach JWT token to authenticated requests', async () => {
      const mockToken = 'test-access-token';
      vi.mocked(tokenManager.getAccessToken).mockReturnValue(mockToken);
      
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: 'test' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await client.get('/api/test');

      expect(fetch).toHaveBeenCalledWith('/api/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockToken}`,
        },
      });
    });

    it('should skip authentication for specified requests', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await client.get('/api/public', { skipAuth: true });

      expect(fetch).toHaveBeenCalledWith('/api/public', {
        method: 'GET',
        skipAuth: true,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should handle login and store tokens', async () => {
      const credentials = { email: 'test@example.com', password: 'password123' };
      const mockResponse = {
        success: true,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: { id: 1, email: 'test@example.com', hasCompletedOnboarding: true },
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await client.login(credentials);

      expect(fetch).toHaveBeenCalledWith('/api/auth/signin', {
        method: 'POST',
        skipAuth: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      expect(tokenManager.setTokens).toHaveBeenCalledWith({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      expect(result).toEqual(mockResponse);
    });

    it('should handle logout and clear tokens', async () => {
      const mockRefreshToken = 'test-refresh-token';
      vi.mocked(tokenManager.getRefreshToken).mockReturnValue(mockRefreshToken);
      
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await client.logout();

      expect(fetch).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: mockRefreshToken }),
        skipRefresh: true,
      });

      expect(tokenManager.clearTokens).toHaveBeenCalled();
    });
  });

  describe('Token Refresh Flow', () => {
    it('should refresh token on 401 response and retry request', async () => {
      const mockAccessToken = 'old-access-token';
      const mockRefreshToken = 'valid-refresh-token';
      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';

      vi.mocked(tokenManager.getAccessToken).mockReturnValue(mockAccessToken);
      vi.mocked(tokenManager.getRefreshToken).mockReturnValue(mockRefreshToken);
      vi.mocked(tokenManager.isRefreshTokenExpired).mockReturnValue(false);
      vi.mocked(tokenManager.isAuthenticated).mockReturnValue(true);

      // First call returns 401
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        // Token refresh call
        .mockResolvedValueOnce(
          new Response(JSON.stringify({
            success: true,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        // Retry original request
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ success: true, data: 'success' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        );

      const result = await client.get('/api/protected');

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(tokenManager.setTokens).toHaveBeenCalledWith({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
      expect(result).toBe('success');
    });

    it('should clear tokens when refresh fails', async () => {
      const mockRefreshToken = 'invalid-refresh-token';
      vi.mocked(tokenManager.getRefreshToken).mockReturnValue(mockRefreshToken);
      vi.mocked(tokenManager.isRefreshTokenExpired).mockReturnValue(false);

      // First call returns 401
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        )
        // Refresh token call fails
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 'Invalid refresh token' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        );

      await expect(client.get('/api/protected')).rejects.toThrow();

      expect(tokenManager.clearTokens).toHaveBeenCalled();
    });
  });

  describe('HTTP Methods', () => {
    beforeEach(() => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: 'test' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should handle POST requests with data', async () => {
      const testData = { name: 'Test User', email: 'test@example.com' };
      
      await client.post('/api/users', testData);

      expect(fetch).toHaveBeenCalledWith('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData),
      });
    });

    it('should handle PUT requests with data', async () => {
      const updateData = { name: 'Updated User' };
      
      await client.put('/api/users/1', updateData);

      expect(fetch).toHaveBeenCalledWith('/api/users/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
    });

    it('should handle PATCH requests with data', async () => {
      const patchData = { email: 'newemail@example.com' };
      
      await client.patch('/api/users/1', patchData);

      expect(fetch).toHaveBeenCalledWith('/api/users/1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchData),
      });
    });

    it('should handle DELETE requests', async () => {
      await client.delete('/api/users/1');

      expect(fetch).toHaveBeenCalledWith('/api/users/1', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      await expect(client.get('/api/test')).rejects.toThrow('Network error');
    });

    it('should handle non-JSON responses', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response('Server Error', {
          status: 500,
          statusText: 'Internal Server Error',
        })
      );

      await expect(client.get('/api/test')).rejects.toThrow('HTTP 500: Internal Server Error');
    });

    it('should handle API error responses', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({
          success: false,
          error: { message: 'User not found', code: 'USER_NOT_FOUND' }
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(client.get('/api/users/999')).rejects.toThrow('User not found');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = HttpClient.getInstance();
      const instance2 = HttpClient.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBe(httpClient);
    });
  });
});