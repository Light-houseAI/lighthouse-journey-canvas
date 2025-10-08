/**
 * MSW Auth Handlers
 *
 * Comprehensive authentication handlers for testing auth flows including:
 * - Login/logout
 * - Registration
 * - Token refresh
 * - User profile operations
 * - Onboarding flow
 */

import { http, HttpResponse } from 'msw';
import { createMockUser } from '../test/factories';
import type { User } from '../stores/auth-store';

// Mock JWT tokens
const generateMockTokens = () => ({
  accessToken: `mock-access-token-${Date.now()}`,
  refreshToken: `mock-refresh-token-${Date.now()}`,
  expiresIn: 3600, // 1 hour
});

// Store for tracking auth state between requests (useful for testing)
let currentUser: User | null = null;
let isAuthenticated = false;

/**
 * Reset auth state (useful between tests)
 */
export function resetAuthState() {
  currentUser = null;
  isAuthenticated = false;
}

/**
 * Set authenticated user for testing
 */
export function setAuthenticatedUser(user: User) {
  currentUser = user;
  isAuthenticated = true;
}

export const authHandlers = [
  // ============================================================================
  // LOGIN
  // ============================================================================

  // POST /api/auth/login - Login with email and password
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json() as { email: string; password: string };

    // Validate request
    if (!body.email || !body.password) {
      return HttpResponse.json(
        {
          error: 'Email and password are required',
          success: false
        },
        { status: 400 }
      );
    }

    // Simulate invalid credentials
    if (body.password === 'wrong-password') {
      return HttpResponse.json(
        {
          error: 'Invalid credentials',
          success: false
        },
        { status: 401 }
      );
    }

    // Create user based on email
    const user = createMockUser({
      overrides: {
        email: body.email,
        userName: body.email.split('@')[0],
        hasCompletedOnboarding: body.email !== 'newuser@example.com',
      }
    });

    // Store for subsequent requests
    currentUser = user;
    isAuthenticated = true;

    // Return success with tokens
    return HttpResponse.json({
      success: true,
      user,
      ...generateMockTokens(),
    });
  }),

  // ============================================================================
  // REGISTRATION
  // ============================================================================

  // POST /api/auth/register - Register new user
  http.post('/api/auth/register', async ({ request }) => {
    const body = await request.json() as {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
    };

    // Validate request
    if (!body.email || !body.password) {
      return HttpResponse.json(
        {
          error: 'Email and password are required',
          success: false
        },
        { status: 400 }
      );
    }

    // Simulate existing user
    if (body.email === 'existing@example.com') {
      return HttpResponse.json(
        {
          error: 'User already exists',
          success: false
        },
        { status: 409 }
      );
    }

    // Create new user
    const user = createMockUser({
      overrides: {
        email: body.email,
        firstName: body.firstName || 'New',
        lastName: body.lastName || 'User',
        userName: body.email.split('@')[0],
        hasCompletedOnboarding: false, // New users need onboarding
      }
    });

    // Store for subsequent requests
    currentUser = user;
    isAuthenticated = true;

    // Return success with tokens
    return HttpResponse.json({
      success: true,
      user,
      ...generateMockTokens(),
    });
  }),

  // ============================================================================
  // LOGOUT
  // ============================================================================

  // POST /api/auth/logout - Logout user
  http.post('/api/auth/logout', () => {
    // Clear auth state
    currentUser = null;
    isAuthenticated = false;

    return HttpResponse.json({
      success: true,
      message: 'Logged out successfully',
    });
  }),

  // ============================================================================
  // TOKEN REFRESH
  // ============================================================================

  // POST /api/auth/refresh - Refresh access token
  http.post('/api/auth/refresh', async ({ request }) => {
    const body = await request.json() as { refreshToken?: string };

    // Validate refresh token
    if (!body.refreshToken) {
      return HttpResponse.json(
        {
          error: 'Refresh token is required',
          success: false
        },
        { status: 400 }
      );
    }

    // Simulate expired refresh token
    if (body.refreshToken === 'expired-refresh-token') {
      return HttpResponse.json(
        {
          error: 'Refresh token expired',
          success: false
        },
        { status: 401 }
      );
    }

    // Generate new tokens
    return HttpResponse.json({
      success: true,
      ...generateMockTokens(),
    });
  }),

  // ============================================================================
  // CURRENT USER
  // ============================================================================

  // GET /api/auth/me - Get current user
  http.get('/api/auth/me', () => {
    if (!isAuthenticated || !currentUser) {
      return HttpResponse.json(
        {
          error: 'Not authenticated',
          success: false
        },
        { status: 401 }
      );
    }

    return HttpResponse.json({
      success: true,
      user: currentUser,
    });
  }),

  // GET /api/users/me - Alternative current user endpoint
  http.get('/api/users/me', () => {
    if (!isAuthenticated || !currentUser) {
      return HttpResponse.json(
        {
          error: 'Not authenticated',
          success: false
        },
        { status: 401 }
      );
    }

    return HttpResponse.json({
      success: true,
      user: currentUser,
    });
  }),

  // ============================================================================
  // PROFILE UPDATES
  // ============================================================================

  // PUT /api/users/profile - Update user profile
  http.put('/api/users/profile', async ({ request }) => {
    if (!isAuthenticated || !currentUser) {
      return HttpResponse.json(
        {
          error: 'Not authenticated',
          success: false
        },
        { status: 401 }
      );
    }

    const body = await request.json() as Partial<User>;

    // Update current user
    currentUser = {
      ...currentUser,
      ...body,
    };

    return HttpResponse.json({
      success: true,
      user: currentUser,
    });
  }),

  // PATCH /api/users/me - Alternative profile update
  http.patch('/api/users/me', async ({ request }) => {
    if (!isAuthenticated || !currentUser) {
      return HttpResponse.json(
        {
          error: 'Not authenticated',
          success: false
        },
        { status: 401 }
      );
    }

    const body = await request.json() as Partial<User>;

    // Update current user
    currentUser = {
      ...currentUser,
      ...body,
    };

    return HttpResponse.json({
      success: true,
      user: currentUser,
    });
  }),

  // ============================================================================
  // ONBOARDING
  // ============================================================================

  // POST /api/onboarding/interest - Set user interest
  http.post('/api/onboarding/interest', async ({ request }) => {
    if (!isAuthenticated || !currentUser) {
      return HttpResponse.json(
        {
          error: 'Not authenticated',
          success: false
        },
        { status: 401 }
      );
    }

    const body = await request.json() as { interest: string };

    // Update user interest
    currentUser = {
      ...currentUser,
      interest: body.interest,
    };

    return HttpResponse.json({
      success: true,
      user: currentUser,
    });
  }),

  // POST /api/onboarding/complete - Complete onboarding
  http.post('/api/onboarding/complete', () => {
    if (!isAuthenticated || !currentUser) {
      return HttpResponse.json(
        {
          error: 'Not authenticated',
          success: false
        },
        { status: 401 }
      );
    }

    // Mark onboarding as complete
    currentUser = {
      ...currentUser,
      hasCompletedOnboarding: true,
    };

    return HttpResponse.json({
      success: true,
      user: currentUser,
    });
  }),

  // ============================================================================
  // PASSWORD MANAGEMENT
  // ============================================================================

  // POST /api/auth/forgot-password - Request password reset
  http.post('/api/auth/forgot-password', async ({ request }) => {
    const body = await request.json() as { email: string };

    if (!body.email) {
      return HttpResponse.json(
        {
          error: 'Email is required',
          success: false
        },
        { status: 400 }
      );
    }

    // Simulate user not found
    if (body.email === 'notfound@example.com') {
      return HttpResponse.json(
        {
          error: 'User not found',
          success: false
        },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Password reset email sent',
    });
  }),

  // POST /api/auth/reset-password - Reset password with token
  http.post('/api/auth/reset-password', async ({ request }) => {
    const body = await request.json() as {
      token: string;
      password: string;
    };

    if (!body.token || !body.password) {
      return HttpResponse.json(
        {
          error: 'Token and password are required',
          success: false
        },
        { status: 400 }
      );
    }

    // Simulate invalid token
    if (body.token === 'invalid-token') {
      return HttpResponse.json(
        {
          error: 'Invalid or expired token',
          success: false
        },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Password reset successfully',
    });
  }),

  // POST /api/auth/change-password - Change password for authenticated user
  http.post('/api/auth/change-password', async ({ request }) => {
    if (!isAuthenticated || !currentUser) {
      return HttpResponse.json(
        {
          error: 'Not authenticated',
          success: false
        },
        { status: 401 }
      );
    }

    const body = await request.json() as {
      currentPassword: string;
      newPassword: string;
    };

    if (!body.currentPassword || !body.newPassword) {
      return HttpResponse.json(
        {
          error: 'Current and new password are required',
          success: false
        },
        { status: 400 }
      );
    }

    // Simulate wrong current password
    if (body.currentPassword === 'wrong-password') {
      return HttpResponse.json(
        {
          error: 'Current password is incorrect',
          success: false
        },
        { status: 401 }
      );
    }

    return HttpResponse.json({
      success: true,
      message: 'Password changed successfully',
    });
  }),

  // ============================================================================
  // SESSION VALIDATION
  // ============================================================================

  // GET /api/auth/validate - Validate current session
  http.get('/api/auth/validate', () => {
    if (!isAuthenticated) {
      return HttpResponse.json(
        {
          valid: false,
          success: false
        },
        { status: 401 }
      );
    }

    return HttpResponse.json({
      success: true,
      valid: true,
      user: currentUser,
    });
  }),

  // ============================================================================
  // DELETE ACCOUNT
  // ============================================================================

  // DELETE /api/users/me - Delete user account
  http.delete('/api/users/me', () => {
    if (!isAuthenticated || !currentUser) {
      return HttpResponse.json(
        {
          error: 'Not authenticated',
          success: false
        },
        { status: 401 }
      );
    }

    // Clear auth state
    currentUser = null;
    isAuthenticated = false;

    return HttpResponse.json({
      success: true,
      message: 'Account deleted successfully',
    });
  }),
];