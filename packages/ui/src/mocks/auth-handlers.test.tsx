/**
 * Tests for MSW auth handlers
 * Validates authentication flows work correctly with MSW
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import React from 'react';

import { renderWithProviders, http, HttpResponse } from '../test/renderWithProviders';
import { resetAuthState, setAuthenticatedUser } from './auth-handlers';
import { createMockUser } from '../test/factories';
import { useAuthStore } from '../stores/auth-store';

// Component to test auth operations
const AuthTestComponent: React.FC = () => {
  const authStore = useAuthStore();
  const [loginResult, setLoginResult] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleLogin = async () => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setLoginResult(data);
        setError(null);
      } else {
        setError(data.error);
        setLoginResult(null);
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (response.ok) {
        setLoginResult(null);
        setError(null);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Network error');
    }
  };

  const handleGetCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();

      if (response.ok) {
        setLoginResult(data);
        setError(null);
      } else {
        setError(data.error);
        setLoginResult(null);
      }
    } catch (err) {
      setError('Network error');
    }
  };

  return (
    <div>
      <h1>Auth Test</h1>

      {error && <div data-testid="error">{error}</div>}

      {loginResult && (
        <div data-testid="user-info">
          <span data-testid="user-email">{loginResult.user?.email}</span>
          <span data-testid="user-id">{loginResult.user?.id}</span>
        </div>
      )}

      <button onClick={handleLogin}>Login</button>
      <button onClick={handleLogout}>Logout</button>
      <button onClick={handleGetCurrentUser}>Get Current User</button>

      <div data-testid="auth-status">
        {authStore.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
      </div>
    </div>
  );
};

describe('Auth Handlers', () => {
  beforeEach(() => {
    // Reset auth state before each test
    resetAuthState();
  });

  describe('Login', () => {
    it('handles successful login', async () => {
      const { user } = renderWithProviders(<AuthTestComponent />);

      // Click login button
      await user.click(screen.getByText('Login'));

      // Wait for response
      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toBeInTheDocument();
      });

      // Check user data
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
      expect(screen.queryByTestId('error')).not.toBeInTheDocument();
    });

    it('handles login with invalid credentials', async () => {
      const { user } = renderWithProviders(<AuthTestComponent />, {
        handlers: [
          http.post('/api/auth/signin', async ({ request }) => {
            const body = await request.json() as any;

            // Always return error for this test
            return HttpResponse.json(
              { error: 'Invalid credentials', success: false },
              { status: 401 }
            );
          }),
        ],
      });

      // Click login button
      await user.click(screen.getByText('Login'));

      // Wait for error
      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error')).toHaveTextContent('Invalid credentials');
      expect(screen.queryByTestId('user-email')).not.toBeInTheDocument();
    });

    it('handles network error during login', async () => {
      const { user } = renderWithProviders(<AuthTestComponent />, {
        handlers: [
          http.post('/api/auth/login', () => {
            // Simulate network error
            return HttpResponse.error();
          }),
        ],
      });

      // Click login button
      await user.click(screen.getByText('Login'));

      // Wait for error
      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error')).toHaveTextContent('Network error');
    });
  });

  describe('Logout', () => {
    it('handles successful logout', async () => {
      const { user } = renderWithProviders(<AuthTestComponent />);

      // First login
      await user.click(screen.getByText('Login'));
      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toBeInTheDocument();
      });

      // Then logout
      await user.click(screen.getByText('Logout'));

      // Wait for logout to complete
      await waitFor(() => {
        expect(screen.queryByTestId('user-email')).not.toBeInTheDocument();
      });

      expect(screen.queryByTestId('error')).not.toBeInTheDocument();
    });
  });

  describe('Current User', () => {
    it('retrieves current user when authenticated', async () => {
      // Set authenticated user
      const mockUser = createMockUser();
      setAuthenticatedUser(mockUser);

      const { user } = renderWithProviders(<AuthTestComponent />);

      // Get current user
      await user.click(screen.getByText('Get Current User'));

      // Wait for response
      await waitFor(() => {
        expect(screen.getByTestId('user-email')).toBeInTheDocument();
      });

      expect(screen.getByTestId('user-email')).toHaveTextContent(mockUser.email);
    });

    it('returns error when not authenticated', async () => {
      const { user } = renderWithProviders(<AuthTestComponent />);

      // Get current user without being authenticated
      await user.click(screen.getByText('Get Current User'));

      // Wait for error
      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error')).toHaveTextContent('Not authenticated');
    });
  });

  describe('Registration', () => {
    it('handles successful registration', async () => {
      const RegistrationComponent = () => {
        const [result, setResult] = React.useState<any>(null);

        const handleRegister = async () => {
          const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'newuser@example.com',
              password: 'password123',
              firstName: 'New',
              lastName: 'User',
            }),
          });

          const data = await response.json();
          setResult(data);
        };

        return (
          <div>
            <button onClick={handleRegister}>Register</button>
            {result?.user && (
              <div data-testid="registered-user">
                {result.user.email} - {result.user.hasCompletedOnboarding ? 'Onboarded' : 'Not Onboarded'}
              </div>
            )}
          </div>
        );
      };

      const { user } = renderWithProviders(<RegistrationComponent />);

      await user.click(screen.getByText('Register'));

      await waitFor(() => {
        expect(screen.getByTestId('registered-user')).toBeInTheDocument();
      });

      expect(screen.getByTestId('registered-user')).toHaveTextContent('newuser@example.com - Not Onboarded');
    });

    it('handles existing user registration attempt', async () => {
      const RegistrationComponent = () => {
        const [error, setError] = React.useState<string | null>(null);

        const handleRegister = async () => {
          const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'existing@example.com',
              password: 'password123',
            }),
          });

          const data = await response.json();
          if (!response.ok) {
            setError(data.error);
          }
        };

        return (
          <div>
            <button onClick={handleRegister}>Register</button>
            {error && <div data-testid="error">{error}</div>}
          </div>
        );
      };

      const { user } = renderWithProviders(<RegistrationComponent />);

      await user.click(screen.getByText('Register'));

      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      });

      expect(screen.getByTestId('error')).toHaveTextContent('User already exists');
    });
  });

  describe('Token Refresh', () => {
    it('handles successful token refresh', async () => {
      const TokenComponent = () => {
        const [tokens, setTokens] = React.useState<any>(null);

        const handleRefresh = async () => {
          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              refreshToken: 'valid-refresh-token',
            }),
          });

          const data = await response.json();
          setTokens(data);
        };

        return (
          <div>
            <button onClick={handleRefresh}>Refresh Token</button>
            {tokens?.accessToken && (
              <div data-testid="tokens">Token refreshed</div>
            )}
          </div>
        );
      };

      const { user } = renderWithProviders(<TokenComponent />);

      await user.click(screen.getByText('Refresh Token'));

      await waitFor(() => {
        expect(screen.getByTestId('tokens')).toBeInTheDocument();
      });

      expect(screen.getByTestId('tokens')).toHaveTextContent('Token refreshed');
    });
  });

  describe('Onboarding', () => {
    it('handles onboarding flow', async () => {
      const OnboardingComponent = () => {
        const [user, setUser] = React.useState<any>(null);

        const handleInterest = async () => {
          const response = await fetch('/api/onboarding/interest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              interest: 'find-job',
            }),
          });

          const data = await response.json();
          setUser(data.user);
        };

        const handleComplete = async () => {
          const response = await fetch('/api/onboarding/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });

          const data = await response.json();
          setUser(data.user);
        };

        return (
          <div>
            <button onClick={handleInterest}>Set Interest</button>
            <button onClick={handleComplete}>Complete Onboarding</button>
            {user && (
              <div data-testid="user-status">
                {user.interest} - {user.hasCompletedOnboarding ? 'Complete' : 'Incomplete'}
              </div>
            )}
          </div>
        );
      };

      // Set authenticated user for onboarding
      const mockUser = createMockUser({ overrides: { hasCompletedOnboarding: false } });
      setAuthenticatedUser(mockUser);

      const { user } = renderWithProviders(<OnboardingComponent />);

      // Set interest
      await user.click(screen.getByText('Set Interest'));

      await waitFor(() => {
        expect(screen.getByTestId('user-status')).toBeInTheDocument();
      });

      expect(screen.getByTestId('user-status')).toHaveTextContent('find-job - Incomplete');

      // Complete onboarding
      await user.click(screen.getByText('Complete Onboarding'));

      await waitFor(() => {
        expect(screen.getByTestId('user-status')).toHaveTextContent('find-job - Complete');
      });
    });
  });
});