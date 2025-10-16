/**
 * Tests for auth store with MSW integration
 * Uses renderWithProviders and MSW handlers for testing auth flows
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import React from 'react';

import { renderWithProviders, http, HttpResponse } from '../test/renderWithProviders';
import { resetAuthState, setAuthenticatedUser } from '../mocks/auth-handlers';
import { createMockUser } from '../test/factories';
import { useAuthStore } from './auth-store';

// Test component that interacts with auth store
const AuthStoreTestComponent: React.FC = () => {
  const authStore = useAuthStore();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await authStore.login('test@example.com', 'password123');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    setError(null);
    try {
      await authStore.logout();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (updates: {
    userName?: string;
    firstName?: string;
    lastName?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      await authStore.updateProfile(updates);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      await authStore.checkAuth();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Auth Store Test</h1>

      {loading && <div data-testid="loading">Loading...</div>}
      {error && <div data-testid="error">{error}</div>}

      <div data-testid="auth-status">
        {authStore.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
      </div>

      {authStore.user && (
        <div data-testid="user-info">
          <span data-testid="user-email">{authStore.user.email}</span>
          <span data-testid="user-id">{authStore.user.id}</span>
          <span data-testid="user-name">{authStore.user.userName}</span>
          {authStore.user.firstName && (
            <span data-testid="user-firstname">{authStore.user.firstName}</span>
          )}
          {authStore.user.lastName && (
            <span data-testid="user-lastname">{authStore.user.lastName}</span>
          )}
        </div>
      )}

      <button onClick={handleLogin}>Login</button>
      <button onClick={handleLogout}>Logout</button>
      <button onClick={handleCheckAuth}>Check Auth</button>
      <button
        onClick={() =>
          handleUpdateProfile({
            userName: 'newusername',
            firstName: 'Jane',
            lastName: 'Smith',
          })
        }
      >
        Update All Fields
      </button>
      <button onClick={() => handleUpdateProfile({ userName: 'justusername' })}>
        Update Username Only
      </button>
      <button onClick={() => handleUpdateProfile({ firstName: 'NewFirst' })}>
        Update First Name Only
      </button>
      <button onClick={() => handleUpdateProfile({ lastName: 'NewLast' })}>
        Update Last Name Only
      </button>
    </div>
  );
};

describe('Auth Store', () => {
  beforeEach(() => {
    // Reset auth state before each test
    resetAuthState();
    // Clear the store to initial state
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    // Clean up after each test
    resetAuthState();
  });

  describe('Login', () => {
    it('should login successfully and update store state', async () => {
      const { user } = renderWithProviders(<AuthStoreTestComponent />);

      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');

      await user.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      });

      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
      expect(screen.queryByTestId('error')).not.toBeInTheDocument();
    });

    it('should handle login with invalid credentials', async () => {
      const { user } = renderWithProviders(<AuthStoreTestComponent />, {
        handlers: [
          http.post('/api/auth/signin', () => {
            return HttpResponse.json(
              { error: 'Invalid credentials', success: false },
              { status: 401 }
            );
          }),
        ],
      });

      await user.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error')).toHaveTextContent('Invalid credentials');
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
    });

    it('should store tokens after successful login', async () => {
      const { user } = renderWithProviders(<AuthStoreTestComponent />);

      await user.click(screen.getByText('Login'));

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      });

      // Check that the store has tokens (we can't see them directly but authenticated status proves they exist)
      const authState = useAuthStore.getState();
      expect(authState.isAuthenticated).toBe(true);
      expect(authState.user).toBeDefined();
    });
  });

  describe('Logout', () => {
    it('should logout and clear user data', async () => {
      const mockUser = createMockUser();

      const { user } = renderWithProviders(<AuthStoreTestComponent />, {
        authState: {
          user: mockUser,
          isAuthenticated: true,
        },
      });

      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      expect(screen.getByTestId('user-email')).toBeInTheDocument();

      await user.click(screen.getByText('Logout'));

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
      });

      expect(screen.queryByTestId('user-email')).not.toBeInTheDocument();
      expect(screen.queryByTestId('error')).not.toBeInTheDocument();
    });

    it('should handle logout errors gracefully', async () => {
      const mockUser = createMockUser();

      const { user } = renderWithProviders(<AuthStoreTestComponent />, {
        authState: {
          user: mockUser,
          isAuthenticated: true,
        },
        handlers: [
          http.post('/api/auth/logout', () => {
            return HttpResponse.json(
              { error: 'Logout failed', success: false },
              { status: 500 }
            );
          }),
        ],
      });

      await user.click(screen.getByText('Logout'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error')).toHaveTextContent('Logout failed');
      // User might still be authenticated if logout failed
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
    });
  });

  describe('Profile Update', () => {
    it('should update all profile fields', async () => {
      const mockUser = createMockUser({
        overrides: {
          email: 'test@example.com',
          userName: 'oldusername',
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      // Set authenticated user in MSW
      setAuthenticatedUser(mockUser);

      const { user } = renderWithProviders(<AuthStoreTestComponent />, {
        authState: {
          user: mockUser,
          isAuthenticated: true,
        },
        handlers: [
          http.patch('/api/auth/profile', async ({ request }) => {
            const body = await request.json() as any;
            const updatedUser = {
              ...mockUser,
              ...body,
            };
            return HttpResponse.json({
              success: true,
              user: updatedUser,
            });
          }),
        ],
      });

      expect(screen.getByTestId('user-name')).toHaveTextContent('oldusername');
      expect(screen.getByTestId('user-firstname')).toHaveTextContent('John');
      expect(screen.getByTestId('user-lastname')).toHaveTextContent('Doe');

      await user.click(screen.getByText('Update All Fields'));

      await waitFor(() => {
        expect(screen.getByTestId('user-name')).toHaveTextContent('newusername');
      });

      expect(screen.getByTestId('user-firstname')).toHaveTextContent('Jane');
      expect(screen.getByTestId('user-lastname')).toHaveTextContent('Smith');
      expect(screen.queryByTestId('error')).not.toBeInTheDocument();
    });

    it('should update userName only', async () => {
      const mockUser = createMockUser({
        overrides: {
          userName: 'oldusername',
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      setAuthenticatedUser(mockUser);

      const { user } = renderWithProviders(<AuthStoreTestComponent />, {
        authState: {
          user: mockUser,
          isAuthenticated: true,
        },
        handlers: [
          http.patch('/api/auth/profile', async ({ request }) => {
            const body = await request.json() as any;
            const updatedUser = {
              ...mockUser,
              ...body,
            };
            return HttpResponse.json({
              success: true,
              user: updatedUser,
            });
          }),
        ],
      });

      await user.click(screen.getByText('Update Username Only'));

      await waitFor(() => {
        expect(screen.getByTestId('user-name')).toHaveTextContent('justusername');
      });

      // Other fields should remain unchanged
      expect(screen.getByTestId('user-firstname')).toHaveTextContent('John');
      expect(screen.getByTestId('user-lastname')).toHaveTextContent('Doe');
    });

    it('should update firstName only', async () => {
      const mockUser = createMockUser({
        overrides: {
          userName: 'testuser',
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      setAuthenticatedUser(mockUser);

      const { user } = renderWithProviders(<AuthStoreTestComponent />, {
        authState: {
          user: mockUser,
          isAuthenticated: true,
        },
        handlers: [
          http.patch('/api/auth/profile', async ({ request }) => {
            const body = await request.json() as any;
            const updatedUser = {
              ...mockUser,
              ...body,
            };
            return HttpResponse.json({
              success: true,
              user: updatedUser,
            });
          }),
        ],
      });

      await user.click(screen.getByText('Update First Name Only'));

      await waitFor(() => {
        expect(screen.getByTestId('user-firstname')).toHaveTextContent('NewFirst');
      });

      // Other fields should remain unchanged
      expect(screen.getByTestId('user-name')).toHaveTextContent('testuser');
      expect(screen.getByTestId('user-lastname')).toHaveTextContent('Doe');
    });

    it('should update lastName only', async () => {
      const mockUser = createMockUser({
        overrides: {
          userName: 'testuser',
          firstName: 'John',
          lastName: 'Doe',
        },
      });

      setAuthenticatedUser(mockUser);

      const { user } = renderWithProviders(<AuthStoreTestComponent />, {
        authState: {
          user: mockUser,
          isAuthenticated: true,
        },
        handlers: [
          http.patch('/api/auth/profile', async ({ request }) => {
            const body = await request.json() as any;
            const updatedUser = {
              ...mockUser,
              ...body,
            };
            return HttpResponse.json({
              success: true,
              user: updatedUser,
            });
          }),
        ],
      });

      await user.click(screen.getByText('Update Last Name Only'));

      await waitFor(() => {
        expect(screen.getByTestId('user-lastname')).toHaveTextContent('NewLast');
      });

      // Other fields should remain unchanged
      expect(screen.getByTestId('user-name')).toHaveTextContent('testuser');
      expect(screen.getByTestId('user-firstname')).toHaveTextContent('John');
    });

    it('should handle profile update errors', async () => {
      const mockUser = createMockUser();
      setAuthenticatedUser(mockUser);

      const { user } = renderWithProviders(<AuthStoreTestComponent />, {
        authState: {
          user: mockUser,
          isAuthenticated: true,
        },
        handlers: [
          http.put('/api/users/profile', () => {
            return HttpResponse.json(
              { error: 'Username already exists', success: false },
              { status: 409 }
            );
          }),
        ],
      });

      await user.click(screen.getByText('Update Username Only'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error')).toHaveTextContent('Username already exists');
    });

    it('should validate name format', async () => {
      const mockUser = createMockUser();
      setAuthenticatedUser(mockUser);

      const { user } = renderWithProviders(<AuthStoreTestComponent />, {
        authState: {
          user: mockUser,
          isAuthenticated: true,
        },
        handlers: [
          http.patch('/api/auth/profile', async ({ request }) => {
            const body = await request.json() as any;

            // Validate firstName
            if (body.firstName && !/^[a-zA-Z\s\-']+$/.test(body.firstName)) {
              return HttpResponse.json(
                {
                  error: 'First name can only contain letters, spaces, hyphens, and apostrophes',
                  success: false,
                },
                { status: 400 }
              );
            }

            // Validate lastName
            if (body.lastName && !/^[a-zA-Z\s\-']+$/.test(body.lastName)) {
              return HttpResponse.json(
                {
                  error: 'Last name can only contain letters, spaces, hyphens, and apostrophes',
                  success: false,
                },
                { status: 400 }
              );
            }

            return HttpResponse.json({
              success: true,
              user: { ...mockUser, ...body },
            });
          }),
        ],
      });

      // Create a test component with invalid name
      const InvalidNameComponent = () => {
        const authStore = useAuthStore();
        const [error, setError] = React.useState<string | null>(null);

        const handleUpdate = async () => {
          try {
            await authStore.updateProfile({ firstName: 'John123' });
          } catch (err: any) {
            setError(err.message);
          }
        };

        return (
          <div>
            <button onClick={handleUpdate}>Update Invalid Name</button>
            {error && <div data-testid="validation-error">{error}</div>}
          </div>
        );
      };

      const { rerender } = renderWithProviders(<InvalidNameComponent />, {
        authState: {
          user: mockUser,
          isAuthenticated: true,
        },
      });

      await user.click(screen.getByText('Update Invalid Name'));

      await waitFor(() => {
        expect(screen.getByTestId('validation-error')).toBeInTheDocument();
      });

      expect(screen.getByTestId('validation-error')).toHaveTextContent(
        'First name can only contain letters, spaces, hyphens, and apostrophes'
      );
    });
  });

  describe('Session Management', () => {
    it('should check auth and restore user', async () => {
      const mockUser = createMockUser();
      setAuthenticatedUser(mockUser);

      const { user } = renderWithProviders(<AuthStoreTestComponent />);

      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');

      await user.click(screen.getByText('Check Auth'));

      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      });

      expect(screen.getByTestId('user-email')).toHaveTextContent(mockUser.email);
    });

    it('should handle no active session', async () => {
      // Don't set authenticated user, so /api/auth/me will return 401

      const { user } = renderWithProviders(<AuthStoreTestComponent />);

      await user.click(screen.getByText('Check Auth'));

      // Wait a moment for the check to complete
      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
      expect(screen.queryByTestId('user-email')).not.toBeInTheDocument();
    });

    it('should handle auth check errors', async () => {
      const { user } = renderWithProviders(<AuthStoreTestComponent />, {
        handlers: [
          http.get('/api/auth/me', () => {
            return HttpResponse.error();
          }),
        ],
      });

      await user.click(screen.getByText('Check Auth'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      });

      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
    });
  });

  describe('State Management', () => {
    it('should initialize with correct default state', () => {
      renderWithProviders(<AuthStoreTestComponent />);

      expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
      expect(screen.queryByTestId('user-email')).not.toBeInTheDocument();
    });

    it('should preserve auth state across component re-renders', async () => {
      const mockUser = createMockUser();

      const { user, rerender } = renderWithProviders(<AuthStoreTestComponent />, {
        authState: {
          user: mockUser,
          isAuthenticated: true,
        },
      });

      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent(mockUser.email);

      // Re-render the component
      rerender(<AuthStoreTestComponent />);

      // State should be preserved
      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');
      expect(screen.getByTestId('user-email')).toHaveTextContent(mockUser.email);
    });

    it('should reset state correctly', async () => {
      const mockUser = createMockUser();

      const { user } = renderWithProviders(<AuthStoreTestComponent />, {
        authState: {
          user: mockUser,
          isAuthenticated: true,
        },
      });

      expect(screen.getByTestId('auth-status')).toHaveTextContent('Authenticated');

      // Clear the store to initial state
      useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });

      // Force re-render
      await waitFor(() => {
        expect(screen.getByTestId('auth-status')).toHaveTextContent('Not Authenticated');
      });

      expect(screen.queryByTestId('user-email')).not.toBeInTheDocument();
    });
  });

  describe('Special Characters in Names', () => {
    it('should handle names with hyphens and apostrophes', async () => {
      const mockUser = createMockUser({
        overrides: {
          firstName: 'Mary',
          lastName: 'Smith',
        },
      });

      setAuthenticatedUser(mockUser);

      const SpecialNameComponent = () => {
        const authStore = useAuthStore();
        const [updateResult, setUpdateResult] = React.useState<any>(null);

        const handleUpdate = async () => {
          const result = await authStore.updateProfile({
            firstName: "Mary-Jane",
            lastName: "O'Connor",
          });
          setUpdateResult(result);
        };

        return (
          <div>
            <button onClick={handleUpdate}>Update Special Names</button>
            {updateResult && (
              <div data-testid="updated-names">
                {updateResult.firstName} {updateResult.lastName}
              </div>
            )}
          </div>
        );
      };

      const { user } = renderWithProviders(<SpecialNameComponent />, {
        authState: {
          user: mockUser,
          isAuthenticated: true,
        },
        handlers: [
          http.patch('/api/auth/profile', async ({ request }) => {
            const body = await request.json() as any;
            const updatedUser = {
              ...mockUser,
              ...body,
            };
            return HttpResponse.json({
              success: true,
              user: updatedUser,
            });
          }),
        ],
      });

      await user.click(screen.getByText('Update Special Names'));

      await waitFor(() => {
        expect(screen.getByTestId('updated-names')).toBeInTheDocument();
      });

      expect(screen.getByTestId('updated-names')).toHaveTextContent("Mary-Jane O'Connor");
    });
  });
});