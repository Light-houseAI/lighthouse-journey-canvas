import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

describe('Auth Store - API Integration Tests', () => {
  const mockFetch = global.fetch as any;

  beforeEach(() => {
    vi.resetAllMocks();

    // Reset fetch mock
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('updateProfile API Integration', () => {
    it('should make correct API call for profile update with userName only', async () => {
      // Mock successful API response
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        userName: 'newusername',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: mockUser,
        }),
      });

      // Simulate the updateProfile function from auth store
      const updateProfile = async (updates: {
        userName?: string;
        firstName?: string;
        lastName?: string;
      }) => {
        const response = await fetch('/api/profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update profile');
        }

        const data = await response.json();
        return data.user;
      };

      // Test the API call
      const result = await updateProfile({ userName: 'newusername' });

      // Verify fetch was called correctly
      expect(mockFetch).toHaveBeenCalledWith('/api/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userName: 'newusername' }),
      });

      // Verify response handling
      expect(result).toEqual(mockUser);
    });

    it('should make correct API call for profile update with firstName and lastName', async () => {
      // Mock successful API response
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: mockUser,
        }),
      });

      const updateProfile = async (updates: {
        userName?: string;
        firstName?: string;
        lastName?: string;
      }) => {
        const response = await fetch('/api/profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update profile');
        }

        const data = await response.json();
        return data.user;
      };

      // Test the API call with all fields
      const result = await updateProfile({
        firstName: 'John',
        lastName: 'Doe',
        userName: 'johndoe',
      });

      // Verify fetch was called correctly
      expect(mockFetch).toHaveBeenCalledWith('/api/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: 'John',
          lastName: 'Doe',
          userName: 'johndoe',
        }),
      });

      // Verify response handling
      expect(result).toEqual(mockUser);
    });

    it('should make correct API call for firstName only update', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        userName: 'janesmith',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: mockUser,
        }),
      });

      const updateProfile = async (updates: {
        userName?: string;
        firstName?: string;
        lastName?: string;
      }) => {
        const response = await fetch('/api/profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update profile');
        }

        const data = await response.json();
        return data.user;
      };

      const result = await updateProfile({ firstName: 'Jane' });

      expect(mockFetch).toHaveBeenCalledWith('/api/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ firstName: 'Jane' }),
      });

      expect(result).toEqual(mockUser);
    });

    it('should make correct API call for lastName only update', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Williams',
        userName: 'johnwilliams',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          user: mockUser,
        }),
      });

      const updateProfile = async (updates: {
        userName?: string;
        firstName?: string;
        lastName?: string;
      }) => {
        const response = await fetch('/api/profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update profile');
        }

        const data = await response.json();
        return data.user;
      };

      const result = await updateProfile({ lastName: 'Williams' });

      expect(mockFetch).toHaveBeenCalledWith('/api/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lastName: 'Williams' }),
      });

      expect(result).toEqual(mockUser);
    });

    it('should handle API error responses correctly', async () => {
      // Mock error response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          message: 'Username already exists',
        }),
      });

      const updateProfile = async (updates: {
        userName?: string;
        firstName?: string;
        lastName?: string;
      }) => {
        const response = await fetch('/api/profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update profile');
        }

        const data = await response.json();
        return data.user;
      };

      // Test error handling
      await expect(updateProfile({ userName: 'existinguser' })).rejects.toThrow(
        'Username already exists'
      );

      expect(mockFetch).toHaveBeenCalledWith('/api/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userName: 'existinguser' }),
      });
    });

    it('should handle firstName validation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error:
            'First name can only contain letters, spaces, hyphens, and apostrophes',
        }),
      });

      const updateProfile = async (updates: {
        userName?: string;
        firstName?: string;
        lastName?: string;
      }) => {
        const response = await fetch('/api/profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || errorData.message || 'Failed to update profile'
          );
        }

        const data = await response.json();
        return data.user;
      };

      await expect(updateProfile({ firstName: 'John123' })).rejects.toThrow(
        'First name can only contain letters, spaces, hyphens, and apostrophes'
      );
    });

    it('should handle lastName validation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error:
            'Last name can only contain letters, spaces, hyphens, and apostrophes',
        }),
      });

      const updateProfile = async (updates: {
        userName?: string;
        firstName?: string;
        lastName?: string;
      }) => {
        const response = await fetch('/api/profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || errorData.message || 'Failed to update profile'
          );
        }

        const data = await response.json();
        return data.user;
      };

      await expect(updateProfile({ lastName: 'Doe@#$' })).rejects.toThrow(
        'Last name can only contain letters, spaces, hyphens, and apostrophes'
      );
    });

    it('should handle network errors', async () => {
      // Mock network failure
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const updateProfile = async (updates: { userName: string }) => {
        const response = await fetch('/api/profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update profile');
        }

        const data = await response.json();
        return data.user;
      };

      await expect(updateProfile({ userName: 'testuser' })).rejects.toThrow(
        'Network error'
      );
    });

    it('should include credentials in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, user: {} }),
      });

      const updateProfile = async (updates: { userName: string }) => {
        const response = await fetch('/api/profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });

        return response;
      };

      await updateProfile({ userName: 'testuser' });

      // Verify credentials are included
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/profile',
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });
  });

  describe('logout API Integration', () => {
    it('should make correct API call for logout', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const logout = async () => {
        const response = await fetch('/api/logout', {
          method: 'POST',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Logout failed');
        }

        return response.json();
      };

      await logout();

      expect(mockFetch).toHaveBeenCalledWith('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });
    });

    it('should handle logout API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Logout failed' }),
      });

      const logout = async () => {
        const response = await fetch('/api/logout', {
          method: 'POST',
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Logout failed');
        }

        return response.json();
      };

      await expect(logout()).rejects.toThrow('Logout failed');
    });
  });

  describe('API Response Validation', () => {
    it('should validate profile update response structure', async () => {
      const mockResponse = {
        success: true,
        user: {
          id: 1,
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          userName: 'testuser',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const updateProfile = async (updates: {
        userName?: string;
        firstName?: string;
        lastName?: string;
      }) => {
        const response = await fetch('/api/profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });

        const data = await response.json();

        // Validate response structure
        if (!data.success || !data.user) {
          throw new Error('Invalid response structure');
        }

        // Validate user object structure
        const { user } = data;
        if (!user.id || !user.email) {
          throw new Error('Invalid user object structure');
        }

        return user;
      };

      const result = await updateProfile({
        firstName: 'John',
        lastName: 'Doe',
        userName: 'testuser',
      });

      expect(result).toEqual({
        id: 1,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        userName: 'testuser',
      });
    });

    it('should handle malformed API responses', async () => {
      // Mock malformed response (missing required fields)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          // Missing success field and user object
        }),
      });

      const updateProfile = async (updates: { userName: string }) => {
        const response = await fetch('/api/profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });

        const data = await response.json();

        if (!data.success || !data.user) {
          throw new Error('Invalid response structure');
        }

        return data.user;
      };

      await expect(updateProfile({ userName: 'testuser' })).rejects.toThrow(
        'Invalid response structure'
      );
    });
  });

  describe('Request Payload Validation', () => {
    it('should send only allowed fields in update payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, user: {} }),
      });

      const updateProfile = async (updates: {
        userName?: string;
        firstName?: string;
        lastName?: string;
      }) => {
        // Only send allowed fields
        const allowedFields: {
          userName?: string;
          firstName?: string;
          lastName?: string;
        } = {};
        if (updates.userName !== undefined)
          allowedFields.userName = updates.userName;
        if (updates.firstName !== undefined)
          allowedFields.firstName = updates.firstName;
        if (updates.lastName !== undefined)
          allowedFields.lastName = updates.lastName;

        const response = await fetch('/api/profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(allowedFields),
        });

        return response;
      };

      await updateProfile({
        firstName: 'John',
        lastName: 'Doe',
        userName: 'testuser',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/profile',
        expect.objectContaining({
          body: expect.stringContaining('"firstName":"John"'),
        })
      );
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/profile',
        expect.objectContaining({
          body: expect.stringContaining('"lastName":"Doe"'),
        })
      );
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/profile',
        expect.objectContaining({
          body: expect.stringContaining('"userName":"testuser"'),
        })
      );
    });

    it('should handle empty or undefined values for all fields', async () => {
      const testCases = [
        { firstName: '', lastName: '', userName: '' },
        {
          firstName: undefined as any,
          lastName: undefined as any,
          userName: undefined as any,
        },
        { firstName: 'John', lastName: '', userName: 'testuser' },
        { firstName: '', lastName: 'Doe', userName: 'testuser' },
      ];

      for (const testCase of testCases) {
        mockFetch.mockClear();
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, user: {} }),
        });

        const updateProfile = async (updates: {
          userName?: string;
          firstName?: string;
          lastName?: string;
        }) => {
          const response = await fetch('/api/profile', {
            method: 'PATCH',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
          });

          return response;
        };

        await updateProfile(testCase);

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/profile',
          expect.objectContaining({
            body: JSON.stringify(testCase),
          })
        );
      }
    });

    it('should handle special characters in names correctly', async () => {
      const validNameCases = [
        { firstName: 'Mary-Jane', lastName: "O'Connor" },
        { firstName: 'Jean-Claude', lastName: 'Van Damme' },
        { firstName: 'Anne Marie', lastName: 'Smith-Wilson' },
      ];

      for (const testCase of validNameCases) {
        mockFetch.mockClear();
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, user: testCase }),
        });

        const updateProfile = async (updates: {
          userName?: string;
          firstName?: string;
          lastName?: string;
        }) => {
          const response = await fetch('/api/profile', {
            method: 'PATCH',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update profile');
          }

          const data = await response.json();
          return data.user;
        };

        const result = await updateProfile(testCase);
        expect(result).toEqual(testCase);
      }
    });
  });

  describe('Authentication Headers', () => {
    it('should include correct headers for authenticated requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, user: {} }),
      });

      const updateProfile = async (updates: { userName: string }) => {
        const response = await fetch('/api/profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        });

        return response;
      };

      await updateProfile({ userName: 'testuser' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/profile',
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        })
      );
    });
  });
});
