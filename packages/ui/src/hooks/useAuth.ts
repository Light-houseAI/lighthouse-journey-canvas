/**
 * TanStack Query hooks for authentication
 * Uses server response format for error handling
 */

import type { ApiErrorResponse, UserProfile } from '@journey/schema';
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
  mutate: (data: { email: string; password: string; firstName: string; lastName?: string }) => void;
  mutateAsync: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName?: string;
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
    mutationFn: (data: { email: string; password: string; firstName: string; lastName?: string }) =>
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

interface UseRegisterWithCodeReturn {
  mutate: (data: { code: string; password: string; firstName: string; lastName?: string }) => void;
  mutateAsync: (data: {
    code: string;
    password: string;
    firstName: string;
    lastName?: string;
  }) => Promise<UserProfile | null>;
  isPending: boolean;
  error: ApiErrorResponse['error'] | null;
}

/**
 * Hook to handle user registration with invite code
 * Used for waitlist users who received an invite code
 */
export function useRegisterWithCode(): UseRegisterWithCodeReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: { code: string; password: string; firstName: string; lastName?: string }) =>
      authApi.signupWithCode(data),
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
/**
 * Hook to handle desktop app session sync via URL parameters
 * When the desktop app opens the web app with tokens in the URL,
 * this hook captures them, stores them, and triggers authentication.
 */
export function useDesktopSessionSync() {
  const queryClient = useQueryClient();

  const syncDesktopSession = async (): Promise<boolean> => {
    // Check if we have desktop tokens in URL
    const urlParams = new URLSearchParams(window.location.search);
    const desktopAccessToken = urlParams.get('desktop_access_token');
    const desktopRefreshToken = urlParams.get('desktop_refresh_token');

    if (!desktopAccessToken || !desktopRefreshToken) {
      return false; // No desktop tokens in URL
    }

    console.log('🔗 [DESKTOP-SYNC] Received session tokens from desktop app');

    try {
      // Store the tokens from desktop app
      tokenManager.setTokens({
        accessToken: desktopAccessToken,
        refreshToken: desktopRefreshToken,
      });

      // Clear any stale query cache before fetching fresh user data
      queryClient.clear();

      // Fetch fresh user data with the new tokens
      const userResponse = await authApi.getCurrentUser();

      if (userResponse) {
        // If user hasn't completed onboarding but arrived via desktop tokens,
        // complete onboarding now (they've clearly used the desktop app)
        if (!userResponse.hasCompletedOnboarding) {
          console.log('🔗 [DESKTOP-SYNC] Completing onboarding for desktop user...');
          try {
            const { completeOnboarding } = await import(
              '../services/onboarding-api'
            );
            const result = await completeOnboarding();
            // Use the updated user from completeOnboarding response
            if (result.user) {
              const { useAuthStore } = await import('../stores/auth-store');
              useAuthStore.getState().setUser(result.user as any);
              console.log('✅ [DESKTOP-SYNC] Onboarding completed successfully');
            }
          } catch (onboardingError) {
            console.warn('⚠️ [DESKTOP-SYNC] Failed to complete onboarding:', onboardingError);
            // Still update with original user data even if onboarding completion fails
            const { useAuthStore } = await import('../stores/auth-store');
            useAuthStore.getState().setUser(userResponse as any);
          }
        } else {
          // Update auth store with fresh user data
          const { useAuthStore } = await import('../stores/auth-store');
          useAuthStore.getState().setUser(userResponse as any);
        }

        // Clear profile review store to avoid stale onboarding state
        const { useProfileReviewStore } = await import(
          '../stores/profile-review-store'
        );
        useProfileReviewStore.getState().reset();

        console.log(
          '✅ [DESKTOP-SYNC] Session synced successfully, user:',
          userResponse.email
        );
      }

      // Clean up URL by removing token parameters (security best practice)
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('desktop_access_token');
      cleanUrl.searchParams.delete('desktop_refresh_token');
      window.history.replaceState({}, document.title, cleanUrl.pathname);

      return true;
    } catch (error) {
      console.error('❌ [DESKTOP-SYNC] Failed to sync desktop session:', error);
      // Clear invalid tokens
      tokenManager.clearTokens();
      return false;
    }
  };

  return { syncDesktopSession };
}

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
