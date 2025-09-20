/**
 * API Integration Tests
 * Tests client-server API interactions and data flow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { httpClient } from '@/services/http-client';
import { tokenManager } from '@/services/token-manager';
import { server } from '@/mocks/server';
import { rest } from 'msw';

// Mock token manager
vi.mock('@/services/token-manager', () => ({
  tokenManager: {
    getAccessToken: vi.fn(),
    getRefreshToken: vi.fn(),
    setTokens: vi.fn(),
    clearTokens: vi.fn(),
    isAuthenticated: vi.fn(),
    isRefreshTokenExpired: vi.fn(),
  },
}));

describe('API Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
    server.close();
  });

  describe('Authentication API Integration', () => {
    it('should handle complete login flow', async () => {
      const mockResponse = {
        success: true,
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: 1,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          hasCompletedOnboarding: true,
        },
      };

      server.use(
        rest.post('/api/auth/signin', (req, res, ctx) => {
          return res(ctx.json(mockResponse));
        })
      );

      const credentials = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = await httpClient.login(credentials);

      expect(result).toEqual(mockResponse);
      expect(tokenManager.setTokens).toHaveBeenCalledWith({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });
    });

    it('should handle login failure', async () => {
      server.use(
        rest.post('/api/auth/signin', (req, res, ctx) => {
          return res(
            ctx.status(401),
            ctx.json({
              success: false,
              error: { message: 'Invalid credentials' },
            })
          );
        })
      );

      const credentials = {
        email: 'wrong@example.com',
        password: 'wrongpassword',
      };

      await expect(httpClient.login(credentials)).rejects.toThrow('Invalid credentials');
      expect(tokenManager.setTokens).not.toHaveBeenCalled();
    });

    it('should handle registration flow', async () => {
      const mockResponse = {
        success: true,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: {
          id: 2,
          email: 'newuser@example.com',
          hasCompletedOnboarding: false,
        },
      };

      server.use(
        rest.post('/api/auth/signup', (req, res, ctx) => {
          return res(ctx.json(mockResponse));
        })
      );

      const userData = {
        email: 'newuser@example.com',
        password: 'password123',
      };

      const result = await httpClient.register(userData);

      expect(result).toEqual(mockResponse);
      expect(tokenManager.setTokens).toHaveBeenCalledWith({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should handle logout flow', async () => {
      vi.mocked(tokenManager.getRefreshToken).mockReturnValue('refresh-token');

      server.use(
        rest.post('/api/auth/logout', (req, res, ctx) => {
          return res(ctx.json({ success: true }));
        })
      );

      await httpClient.logout();

      expect(tokenManager.clearTokens).toHaveBeenCalled();
    });

    it('should handle token refresh', async () => {
      vi.mocked(tokenManager.getAccessToken).mockReturnValue('expired-token');
      vi.mocked(tokenManager.getRefreshToken).mockReturnValue('valid-refresh');
      vi.mocked(tokenManager.isRefreshTokenExpired).mockReturnValue(false);
      vi.mocked(tokenManager.isAuthenticated).mockReturnValue(true);

      let callCount = 0;
      server.use(
        rest.get('/api/timeline', (req, res, ctx) => {
          callCount++;
          if (callCount === 1) {
            return res(ctx.status(401), ctx.json({ error: 'Token expired' }));
          }
          return res(ctx.json({ success: true, data: [] }));
        }),
        rest.post('/api/auth/refresh', (req, res, ctx) => {
          return res(ctx.json({
            success: true,
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
          }));
        })
      );

      const result = await httpClient.get('/api/timeline');

      expect(result).toEqual([]);
      expect(tokenManager.setTokens).toHaveBeenCalledWith({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });
  });

  describe('Timeline API Integration', () => {
    beforeEach(() => {
      vi.mocked(tokenManager.getAccessToken).mockReturnValue('valid-token');
    });

    it('should fetch timeline data', async () => {
      const mockTimeline = [
        {
          id: '1',
          title: 'Software Engineer',
          company: 'Tech Corp',
          startDate: '2023-01-01',
          endDate: '2023-12-31',
        },
        {
          id: '2',
          title: 'Computer Science Degree',
          institution: 'University',
          startDate: '2019-09-01',
          endDate: '2023-05-01',
        },
      ];

      server.use(
        rest.get('/api/timeline', (req, res, ctx) => {
          return res(ctx.json({ success: true, data: mockTimeline }));
        })
      );

      const result = await httpClient.get('/api/timeline');

      expect(result).toEqual(mockTimeline);
    });

    it('should create new timeline entry', async () => {
      const newEntry = {
        title: 'Senior Developer',
        company: 'New Corp',
        startDate: '2024-01-01',
        description: 'Leading development team',
        skills: ['React', 'Node.js'],
      };

      const mockResponse = {
        id: '3',
        ...newEntry,
        createdAt: '2024-01-01T00:00:00Z',
      };

      server.use(
        rest.post('/api/timeline', (req, res, ctx) => {
          return res(ctx.json({ success: true, data: mockResponse }));
        })
      );

      const result = await httpClient.post('/api/timeline', newEntry);

      expect(result).toEqual(mockResponse);
    });

    it('should update timeline entry', async () => {
      const updates = {
        title: 'Senior Software Engineer',
        description: 'Updated description',
      };

      server.use(
        rest.patch('/api/timeline/1', (req, res, ctx) => {
          return res(ctx.json({ 
            success: true, 
            data: { id: '1', ...updates } 
          }));
        })
      );

      const result = await httpClient.patch('/api/timeline/1', updates);

      expect(result).toEqual({ id: '1', ...updates });
    });

    it('should delete timeline entry', async () => {
      server.use(
        rest.delete('/api/timeline/1', (req, res, ctx) => {
          return res(ctx.json({ success: true }));
        })
      );

      const result = await httpClient.delete('/api/timeline/1');

      expect(result).toEqual({ success: true });
    });

    it('should handle timeline search', async () => {
      const searchResults = [
        {
          id: '1',
          title: 'Software Engineer',
          company: 'Tech Corp',
          relevanceScore: 0.95,
        },
      ];

      server.use(
        rest.get('/api/timeline/search', (req, res, ctx) => {
          const query = req.url.searchParams.get('q');
          expect(query).toBe('engineer');
          return res(ctx.json({ success: true, data: searchResults }));
        })
      );

      const result = await httpClient.get('/api/timeline/search?q=engineer');

      expect(result).toEqual(searchResults);
    });

    it('should handle timeline filtering', async () => {
      const filteredResults = [
        {
          id: '1',
          type: 'experience',
          title: 'Software Engineer',
          company: 'Tech Corp',
        },
      ];

      server.use(
        rest.get('/api/timeline', (req, res, ctx) => {
          const type = req.url.searchParams.get('type');
          const startDate = req.url.searchParams.get('startDate');
          expect(type).toBe('experience');
          expect(startDate).toBe('2023-01-01');
          return res(ctx.json({ success: true, data: filteredResults }));
        })
      );

      const result = await httpClient.get('/api/timeline?type=experience&startDate=2023-01-01');

      expect(result).toEqual(filteredResults);
    });
  });

  describe('Profile API Integration', () => {
    beforeEach(() => {
      vi.mocked(tokenManager.getAccessToken).mockReturnValue('valid-token');
    });

    it('should fetch user profile', async () => {
      const mockProfile = {
        id: 1,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        userName: 'testuser',
        bio: 'Software developer',
        avatarUrl: '/avatar.jpg',
      };

      server.use(
        rest.get('/api/auth/me', (req, res, ctx) => {
          return res(ctx.json({ success: true, data: mockProfile }));
        })
      );

      const result = await httpClient.getCurrentUser();

      expect(result).toEqual(mockProfile);
    });

    it('should update user profile', async () => {
      const updates = {
        firstName: 'Updated',
        lastName: 'Name',
        bio: 'Updated bio',
      };

      server.use(
        rest.patch('/api/auth/profile', (req, res, ctx) => {
          return res(ctx.json({ 
            success: true, 
            data: { id: 1, ...updates } 
          }));
        })
      );

      const result = await httpClient.updateProfile(updates);

      expect(result).toEqual({ id: 1, ...updates });
    });

    it('should handle avatar upload', async () => {
      const mockResponse = {
        avatarUrl: '/uploads/avatar-123.jpg',
      };

      server.use(
        rest.post('/api/upload/avatar', (req, res, ctx) => {
          return res(ctx.json({ success: true, data: mockResponse }));
        })
      );

      const formData = new FormData();
      formData.append('avatar', new File(['avatar'], 'avatar.jpg'));

      const result = await httpClient.post('/api/upload/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      expect(result).toEqual(mockResponse);
    });

    it('should check username availability', async () => {
      server.use(
        rest.get('/api/auth/check-username', (req, res, ctx) => {
          const username = req.url.searchParams.get('username');
          const available = username !== 'taken';
          return res(ctx.json({ success: true, data: { available } }));
        })
      );

      const availableResult = await httpClient.get('/api/auth/check-username?username=available');
      expect(availableResult).toEqual({ available: true });

      const takenResult = await httpClient.get('/api/auth/check-username?username=taken');
      expect(takenResult).toEqual({ available: false });
    });
  });

  describe('Sharing API Integration', () => {
    beforeEach(() => {
      vi.mocked(tokenManager.getAccessToken).mockReturnValue('valid-token');
    });

    it('should create share link', async () => {
      const shareData = {
        timelineId: '1',
        permissions: ['read'],
        expiresAt: '2024-12-31T23:59:59Z',
      };

      const mockResponse = {
        shareId: 'share-123',
        shareUrl: 'https://app.com/share/share-123',
        ...shareData,
      };

      server.use(
        rest.post('/api/share', (req, res, ctx) => {
          return res(ctx.json({ success: true, data: mockResponse }));
        })
      );

      const result = await httpClient.post('/api/share', shareData);

      expect(result).toEqual(mockResponse);
    });

    it('should fetch shared timeline', async () => {
      const mockSharedData = {
        timeline: [
          {
            id: '1',
            title: 'Software Engineer',
            company: 'Tech Corp',
            isPrivate: false,
          },
        ],
        owner: {
          firstName: 'Test',
          lastName: 'User',
        },
        permissions: ['read'],
      };

      server.use(
        rest.get('/api/share/share-123', (req, res, ctx) => {
          return res(ctx.json({ success: true, data: mockSharedData }));
        })
      );

      const result = await httpClient.get('/api/share/share-123', { skipAuth: true });

      expect(result).toEqual(mockSharedData);
    });

    it('should revoke share link', async () => {
      server.use(
        rest.delete('/api/share/share-123', (req, res, ctx) => {
          return res(ctx.json({ success: true }));
        })
      );

      const result = await httpClient.delete('/api/share/share-123');

      expect(result).toEqual({ success: true });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      vi.mocked(tokenManager.getAccessToken).mockReturnValue('valid-token');
    });

    it('should handle server errors', async () => {
      server.use(
        rest.get('/api/timeline', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({
              success: false,
              error: { message: 'Internal server error' },
            })
          );
        })
      );

      await expect(httpClient.get('/api/timeline')).rejects.toThrow('Internal server error');
    });

    it('should handle network timeouts', async () => {
      server.use(
        rest.get('/api/timeline', (req, res, ctx) => {
          return res(ctx.delay('infinite'));
        })
      );

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 100);
      });

      await expect(
        Promise.race([httpClient.get('/api/timeline'), timeoutPromise])
      ).rejects.toThrow('Request timeout');
    });

    it('should handle malformed responses', async () => {
      server.use(
        rest.get('/api/timeline', (req, res, ctx) => {
          return res(ctx.text('Invalid JSON'));
        })
      );

      // HttpClient should handle non-JSON responses gracefully
      const result = await httpClient.get('/api/timeline');
      expect(result).toEqual({});
    });

    it('should handle rate limiting', async () => {
      server.use(
        rest.get('/api/timeline', (req, res, ctx) => {
          return res(
            ctx.status(429),
            ctx.json({
              success: false,
              error: { message: 'Rate limit exceeded', retryAfter: 60 },
            })
          );
        })
      );

      await expect(httpClient.get('/api/timeline')).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Data Validation', () => {
    beforeEach(() => {
      vi.mocked(tokenManager.getAccessToken).mockReturnValue('valid-token');
    });

    it('should handle validation errors', async () => {
      server.use(
        rest.post('/api/timeline', (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              success: false,
              error: {
                message: 'Validation failed',
                details: {
                  title: 'Title is required',
                  startDate: 'Invalid date format',
                },
              },
            })
          );
        })
      );

      const invalidData = {
        title: '',
        startDate: 'invalid-date',
      };

      await expect(httpClient.post('/api/timeline', invalidData)).rejects.toThrow('Validation failed');
    });

    it('should handle missing required fields', async () => {
      server.use(
        rest.patch('/api/auth/profile', (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              success: false,
              error: { message: 'Email is required' },
            })
          );
        })
      );

      await expect(httpClient.updateProfile({ email: '' })).rejects.toThrow('Email is required');
    });
  });

  describe('Pagination and Limits', () => {
    beforeEach(() => {
      vi.mocked(tokenManager.getAccessToken).mockReturnValue('valid-token');
    });

    it('should handle paginated timeline requests', async () => {
      const mockResponse = {
        data: [
          { id: '1', title: 'Entry 1' },
          { id: '2', title: 'Entry 2' },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 25,
          totalPages: 3,
        },
      };

      server.use(
        rest.get('/api/timeline', (req, res, ctx) => {
          const page = req.url.searchParams.get('page');
          const limit = req.url.searchParams.get('limit');
          expect(page).toBe('1');
          expect(limit).toBe('10');
          return res(ctx.json({ success: true, ...mockResponse }));
        })
      );

      const result = await httpClient.get('/api/timeline?page=1&limit=10');

      expect(result).toEqual(mockResponse);
    });
  });
});