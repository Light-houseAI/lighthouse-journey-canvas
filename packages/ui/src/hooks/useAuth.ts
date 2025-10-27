/**
 * TanStack Query hooks for authentication
 * Uses server response format for error handling
 */

import type { UserProfile } from '@journey/schema';
import type { ApiErrorResponse } from '@journey/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as authApi from '../services/auth-api';
import { tokenManager } from '../services/token-manager';

/**
 * Query keys for auth-related queries
 */
export const authKeys = {
  all: ['auth'] as const,
  currentUser: () => [...authKeys.all, 'currentUser'] as const,
};

/**
 * Hook to fetch current user with caching
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.currentUser(),
    queryFn: authApi.getCurrentUser,
    enabled: tokenManager.isAuthenticated(), // Only fetch if authenticated
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: false, // Server handles errors
  });
}

interface UseLoginReturn {
  mutate: (credentials: { email: string; password: string }) => void;
  mutateAsync: (credentials: {
    email: string;
    password: string;
  }) => Promise<UserProfile | null>;
  isPending: boolean;
  error: ApiErrorResponse['error'] | null;
}

/**
 * Hook to handle user login
 */
export function useLogin(): UseLoginReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      authApi.signin(credentials),
    onSuccess: async (response) => {
      // Save tokens to localStorage (CRITICAL for authenticated requests)
      tokenManager.setTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });

      // Update user query cache immediately (TanStack Query best practice)
      queryClient.setQueryData(authKeys.currentUser(), response.user);

      // Update auth store to trigger app redirect (backward compatibility)
      const { useAuthStore } = await import('../stores/auth-store');
      useAuthStore.getState().setUser(response.user as any);

      // Clear profile review store
      const { useProfileReviewStore } = await import(
        '../stores/profile-review-store'
      );
      useProfileReviewStore.getState().reset();
    },
    retry: false, // Server handles errors
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: async (credentials) => {
      const response = await mutation.mutateAsync(credentials);
      return response.user as UserProfile;
    },
    isPending: mutation.isPending,
    error: mutation.error
      ? { message: mutation.error.message, code: 'ERROR' }
      : null,
  };
}

interface UseRegisterReturn {
  mutate: (data: { email: string; password: string }) => void;
  mutateAsync: (data: {
    email: string;
    password: string;
  }) => Promise<UserProfile | null>;
  isPending: boolean;
  error: ApiErrorResponse['error'] | null;
}

/**
 * Hook to handle user registration
 */
export function useRegister(): UseRegisterReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      authApi.signup(data),
    onSuccess: async (response) => {
      // Save tokens to localStorage (CRITICAL for authenticated requests)
      tokenManager.setTokens({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });

      // Update user query cache immediately (TanStack Query best practice)
      queryClient.setQueryData(authKeys.currentUser(), response.user);

      // Update auth store to trigger app redirect (backward compatibility)
      const { useAuthStore } = await import('../stores/auth-store');
      useAuthStore.getState().setUser(response.user as any);

      // Clear profile review store
      const { useProfileReviewStore } = await import(
        '../stores/profile-review-store'
      );
      useProfileReviewStore.getState().reset();
    },
    retry: false, // Server handles errors
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: async (data) => {
      const response = await mutation.mutateAsync(data);
      return response.user as UserProfile;
    },
    isPending: mutation.isPending,
    error: mutation.error
      ? { message: mutation.error.message, code: 'ERROR' }
      : null,
  };
}

interface UseLogoutReturn {
  mutate: () => void;
  mutateAsync: () => Promise<void>;
  isPending: boolean;
  error: ApiErrorResponse['error'] | null;
}

/**
 * Hook to handle user logout
 */
export function useLogout(): UseLogoutReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: authApi.logout,
    onSuccess: async () => {
      // Clear all caches on logout
      queryClient.clear();

      // Clear profile review store
      const { useProfileReviewStore } = await import(
        '../stores/profile-review-store'
      );
      useProfileReviewStore.getState().reset();

      // Clear auth store to trigger navigation to login
      const { useAuthStore } = await import('../stores/auth-store');
      useAuthStore.getState().setUser(null);
    },
    onError: async () => {
      // Clear caches even on error (user still logged out locally)
      queryClient.clear();

      // Clear profile review store
      const { useProfileReviewStore } = await import(
        '../stores/profile-review-store'
      );
      useProfileReviewStore.getState().reset();

      // Clear auth store even on error (user should be logged out locally)
      const { useAuthStore } = await import('../stores/auth-store');
      useAuthStore.getState().setUser(null);
    },
    retry: false, // Don't retry logout
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: async () => {
      await mutation.mutateAsync();
    },
    isPending: mutation.isPending,
    error: mutation.error
      ? { message: mutation.error.message, code: 'ERROR' }
      : null,
  };
}

interface UseUpdateProfileReturn {
  mutate: (updates: {
    firstName?: string;
    lastName?: string;
    userName?: string;
    interest?: string;
  }) => void;
  mutateAsync: (updates: {
    firstName?: string;
    lastName?: string;
    userName?: string;
    interest?: string;
  }) => Promise<UserProfile | null>;
  isPending: boolean;
  error: ApiErrorResponse['error'] | null;
}

/**
 * Hook to update user profile
 */
export function useUpdateProfile(): UseUpdateProfileReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (updates: {
      firstName?: string;
      lastName?: string;
      userName?: string;
      interest?: string;
    }) => authApi.updateProfile(updates),
    onSuccess: () => {
      // Invalidate current user query to refetch
      queryClient.invalidateQueries({ queryKey: authKeys.currentUser() });
    },
    retry: false, // Server handles errors
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: async (updates) => {
      return await mutation.mutateAsync(updates);
    },
    isPending: mutation.isPending,
    error: mutation.error
      ? { message: mutation.error.message, code: 'ERROR' }
      : null,
  };
}
