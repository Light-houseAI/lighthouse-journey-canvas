/**
 * useAuth Hooks Tests
 *
 * Tests for authentication hooks including:
 * - useLogin
 * - useRegister
 * - useLogout
 * - useCurrentUser
 * - useUpdateProfile
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as authApi from '../services/auth-api';
import { tokenManager } from '../services/token-manager';
import {
  authKeys,
  useCurrentUser,
  useLogin,
  useLogout,
  useRegister,
  useUpdateProfile,
} from './useAuth';

// Mock dependencies
vi.mock('../services/auth-api');
vi.mock('../services/token-manager');
vi.mock('../stores/auth-store', () => ({
  useAuthStore: {
    getState: () => ({
      setUser: vi.fn(),
    }),
  },
}));
vi.mock('../stores/profile-review-store', () => ({
  useProfileReviewStore: {
    getState: () => ({
      reset: vi.fn(),
    }),
  },
}));

const mockAuthApi = vi.mocked(authApi);
const mockTokenManager = vi.mocked(tokenManager);

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useAuth Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useCurrentUser', () => {
    it('should fetch current user when authenticated', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        userName: 'testuser',
        interest: 'find-job',
        hasCompletedOnboarding: true,
        createdAt: '2024-01-01T00:00:00Z',
      };

      mockTokenManager.isAuthenticated.mockReturnValue(true);
      mockAuthApi.getCurrentUser.mockResolvedValue(mockUser);

      const { result } = renderHook(() => useCurrentUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockAuthApi.getCurrentUser).toHaveBeenCalled();
      expect(result.current.data).toEqual(mockUser);
    });

    it('should not fetch when not authenticated', () => {
      mockTokenManager.isAuthenticated.mockReturnValue(false);

      const { result } = renderHook(() => useCurrentUser(), {
        wrapper: createWrapper(),
      });

      expect(mockAuthApi.getCurrentUser).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it('should handle fetch errors', async () => {
      mockTokenManager.isAuthenticated.mockReturnValue(true);
      mockAuthApi.getCurrentUser.mockRejectedValue(
        new Error('Unauthorized')
      );

      const { result } = renderHook(() => useCurrentUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  describe('useLogin', () => {
    it('should login successfully', async () => {
      const mockResponse = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: 1,
          email: 'test@example.com',
          firstName: null,
          lastName: null,
          userName: null,
          interest: null,
          hasCompletedOnboarding: false,
          createdAt: '2024-01-01T00:00:00Z',
        },
      };

      mockAuthApi.signin.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useLogin(), {
        wrapper: createWrapper(),
      });

      const credentials = {
        email: 'test@example.com',
        password: 'password123',
      };

      result.current.mutate(credentials);

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(mockAuthApi.signin).toHaveBeenCalledWith(credentials);
      expect(mockTokenManager.setTokens).toHaveBeenCalledWith({
        accessToken: mockResponse.accessToken,
        refreshToken: mockResponse.refreshToken,
      });
    });

    it('should handle login errors', async () => {
      const error = new Error('Invalid credentials');
      mockAuthApi.signin.mockRejectedValue(error);

      const { result } = renderHook(() => useLogin(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        email: 'test@example.com',
        password: 'wrongpassword',
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toBe('Invalid credentials');
    });

    it('should return user profile via mutateAsync', async () => {
      const mockResponse = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: 1,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          userName: 'testuser',
          interest: 'find-job',
          hasCompletedOnboarding: true,
          createdAt: '2024-01-01T00:00:00Z',
        },
      };

      mockAuthApi.signin.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useLogin(), {
        wrapper: createWrapper(),
      });

      const user = await result.current.mutateAsync({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(user).toEqual(mockResponse.user);
    });
  });

  describe('useRegister', () => {
    it('should register successfully', async () => {
      const mockResponse = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: 1,
          email: 'newuser@example.com',
          firstName: null,
          lastName: null,
          userName: null,
          interest: null,
          hasCompletedOnboarding: false,
          createdAt: '2024-01-01T00:00:00Z',
        },
      };

      mockAuthApi.signup.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useRegister(), {
        wrapper: createWrapper(),
      });

      const signupData = {
        email: 'newuser@example.com',
        password: 'password123',
      };

      result.current.mutate(signupData);

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(mockAuthApi.signup).toHaveBeenCalledWith(signupData);
      expect(mockTokenManager.setTokens).toHaveBeenCalledWith({
        accessToken: mockResponse.accessToken,
        refreshToken: mockResponse.refreshToken,
      });
    });

    it('should handle duplicate email error', async () => {
      const error = new Error('Email already exists');
      mockAuthApi.signup.mockRejectedValue(error);

      const { result } = renderHook(() => useRegister(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        email: 'existing@example.com',
        password: 'password123',
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toBe('Email already exists');
    });

    it('should return user profile via mutateAsync', async () => {
      const mockResponse = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: 1,
          email: 'newuser@example.com',
          firstName: null,
          lastName: null,
          userName: null,
          interest: null,
          hasCompletedOnboarding: false,
          createdAt: '2024-01-01T00:00:00Z',
        },
      };

      mockAuthApi.signup.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useRegister(), {
        wrapper: createWrapper(),
      });

      const user = await result.current.mutateAsync({
        email: 'newuser@example.com',
        password: 'password123',
      });

      expect(user).toEqual(mockResponse.user);
    });
  });

  describe('useLogout', () => {
    it('should logout successfully', async () => {
      mockAuthApi.logout.mockResolvedValue(undefined);

      const { result } = renderHook(() => useLogout(), {
        wrapper: createWrapper(),
      });

      result.current.mutate();

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(mockAuthApi.logout).toHaveBeenCalled();
    });

    it('should clear cache on successful logout', async () => {
      mockAuthApi.logout.mockResolvedValue(undefined);

      const queryClient = new QueryClient();
      const spy = vi.spyOn(queryClient, 'clear');

      const { result } = renderHook(() => useLogout(), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      });

      result.current.mutate();

      await waitFor(() => {
        expect(spy).toHaveBeenCalled();
      });
    });

    it('should clear cache even on logout error', async () => {
      mockAuthApi.logout.mockRejectedValue(new Error('Network error'));

      const queryClient = new QueryClient();
      const spy = vi.spyOn(queryClient, 'clear');

      const { result } = renderHook(() => useLogout(), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      });

      result.current.mutate();

      await waitFor(() => {
        expect(spy).toHaveBeenCalled();
      });
    });

    it('should handle logout with mutateAsync', async () => {
      mockAuthApi.logout.mockResolvedValue(undefined);

      const { result } = renderHook(() => useLogout(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync();

      expect(mockAuthApi.logout).toHaveBeenCalled();
    });
  });

  describe('useUpdateProfile', () => {
    it('should update profile successfully', async () => {
      const mockUpdatedUser = {
        id: 1,
        email: 'test@example.com',
        firstName: 'Updated',
        lastName: 'Name',
        userName: 'updateduser',
        interest: 'grow-career',
        hasCompletedOnboarding: true,
        createdAt: '2024-01-01T00:00:00Z',
      };

      mockAuthApi.updateProfile.mockResolvedValue(mockUpdatedUser);

      const { result } = renderHook(() => useUpdateProfile(), {
        wrapper: createWrapper(),
      });

      const updates = {
        firstName: 'Updated',
        lastName: 'Name',
        userName: 'updateduser',
        interest: 'grow-career',
      };

      result.current.mutate(updates);

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(mockAuthApi.updateProfile).toHaveBeenCalledWith(updates);
    });

    it('should invalidate current user query on success', async () => {
      const mockUpdatedUser = {
        id: 1,
        email: 'test@example.com',
        firstName: 'Updated',
        lastName: 'Name',
        userName: 'updateduser',
        interest: 'grow-career',
        hasCompletedOnboarding: true,
        createdAt: '2024-01-01T00:00:00Z',
      };

      mockAuthApi.updateProfile.mockResolvedValue(mockUpdatedUser);

      const queryClient = new QueryClient();
      const spy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateProfile(), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      });

      result.current.mutate({ firstName: 'Updated' });

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith({
          queryKey: authKeys.currentUser(),
        });
      });
    });

    it('should handle update profile errors', async () => {
      const error = new Error('Validation failed');
      mockAuthApi.updateProfile.mockRejectedValue(error);

      const { result } = renderHook(() => useUpdateProfile(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ firstName: '' });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toBe('Validation failed');
    });

    it('should return updated user via mutateAsync', async () => {
      const mockUpdatedUser = {
        id: 1,
        email: 'test@example.com',
        firstName: 'Updated',
        lastName: 'Name',
        userName: 'updateduser',
        interest: 'grow-career',
        hasCompletedOnboarding: true,
        createdAt: '2024-01-01T00:00:00Z',
      };

      mockAuthApi.updateProfile.mockResolvedValue(mockUpdatedUser);

      const { result } = renderHook(() => useUpdateProfile(), {
        wrapper: createWrapper(),
      });

      const user = await result.current.mutateAsync({ firstName: 'Updated' });

      expect(user).toEqual(mockUpdatedUser);
    });
  });

  describe('Query Keys', () => {
    it('should generate consistent auth keys', () => {
      expect(authKeys.all).toEqual(['auth']);
      expect(authKeys.currentUser()).toEqual(['auth', 'currentUser']);
    });
  });
});
