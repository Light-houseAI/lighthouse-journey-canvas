import { Organization } from '@journey/schema';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import * as authApi from '../services/auth-api';
import { getAllOrganizations } from '../services/organization-api';
import { tokenManager } from '../services/token-manager';
import { getErrorMessage } from '../utils/error-toast';

export interface User {
  id: number;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  userName?: string | null;
  interest?: string | null;
  hasCompletedOnboarding: boolean | null;
  createdAt: string | Date;
}

interface AuthState {
  // State - TEMPORARY: Will be migrated to TanStack Query
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  organizations: Organization[];
  isLoadingOrganizations: boolean;

  // Actions - TEMPORARY: Will be replaced by useAuth hooks
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: (credentials: { email: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
  register: (data: { email: string; password: string }) => Promise<User>;
  checkAuth: () => Promise<void>;
  updateUserInterest: (interest: string) => Promise<void>;
  updateProfile: (updates: {
    firstName?: string;
    lastName?: string;
    userName?: string;
  }) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  clearError: () => void;
  loadOrganizations: () => Promise<void>;
}

/**
 * DEPRECATED: This store is being migrated to TanStack Query
 *
 * Use the new hooks instead:
 * - useCurrentUser() for user data
 * - useLogin() for login
 * - useRegister() for registration
 * - useLogout() for logout
 * - useUpdateProfile() for profile updates
 *
 * This store currently maintains backward compatibility but will be
 * simplified to only UI state (isLoading, error) in the future.
 */
export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        user: null,
        isLoading: false,
        error: null,
        isAuthenticated: false,
        organizations: [],
        isLoadingOrganizations: false,

        // Actions
        setUser: (user) =>
          set((state) => {
            state.user = user;
            state.isAuthenticated = !!user;
            state.error = null;
          }),

        setLoading: (loading) =>
          set((state) => {
            state.isLoading = loading;
          }),

        setError: (error) =>
          set((state) => {
            state.error = error;
            state.isLoading = false;
          }),

        clearError: () =>
          set((state) => {
            state.error = null;
          }),

        login: async (credentials) => {
          const { setUser, setLoading, setError } = get();

          try {
            setLoading(true);
            setError(null);

            const response = await authApi.signin(credentials);

            if (!response.success) {
              const errorMessage =
                'error' in response ? response.error.message : 'Login failed';
              throw new Error(errorMessage);
            }

            const { queryClient } = await import('../lib/queryClient');
            queryClient.clear();

            const { useProfileReviewStore } = await import(
              './profile-review-store'
            );
            useProfileReviewStore.getState().reset();

            setUser(response.data.user as User);
            return response.data.user as User;
          } catch (error) {
            const message = getErrorMessage(error);
            setError(message);
            throw error;
          } finally {
            setLoading(false);
          }
        },

        register: async (data) => {
          const { setUser, setLoading, setError } = get();

          try {
            setLoading(true);
            setError(null);

            const response = await authApi.signup(data);

            if (!response.success) {
              const errorMessage =
                'error' in response
                  ? response.error.message
                  : 'Registration failed';
              throw new Error(errorMessage);
            }

            const { queryClient } = await import('../lib/queryClient');
            queryClient.clear();

            const { useProfileReviewStore } = await import(
              './profile-review-store'
            );
            useProfileReviewStore.getState().reset();

            setUser(response.data.user as User);
            return response.data.user as User;
          } catch (error) {
            const message = getErrorMessage(error);
            setError(message);
            throw error;
          } finally {
            setLoading(false);
          }
        },

        logout: async () => {
          const { setUser, setLoading } = get();

          try {
            setLoading(true);

            await authApi.logout();

            const { queryClient } = await import('../lib/queryClient');
            queryClient.clear();

            const { useProfileReviewStore } = await import(
              './profile-review-store'
            );
            useProfileReviewStore.getState().reset();

            setUser(null); // Hierarchy store will automatically clear via subscription
          } catch (error) {
            console.error('Logout error:', error);

            const { queryClient } = await import('../lib/queryClient');
            queryClient.clear();

            const { useProfileReviewStore } = await import(
              './profile-review-store'
            );
            useProfileReviewStore.getState().reset();

            // Still clear user state even if logout request fails
            setUser(null); // Hierarchy store will automatically clear via subscription
          } finally {
            setLoading(false);
          }
        },

        checkAuth: async () => {
          const { setUser, setLoading, setError } = get();

          try {
            setLoading(true);
            setError(null);

            // Check if we have tokens first
            if (!tokenManager.isAuthenticated()) {
              setUser(null);
              return;
            }

            const response = await authApi.getCurrentUser();

            if (!response.success) {
              setUser(null);
              return;
            }

            setUser(response.data.user as User);
          } catch (error) {
            console.error('Auth check error:', error);
            setUser(null);
          } finally {
            setLoading(false);
          }
        },

        updateUserInterest: async (interest) => {
          const { user, setUser, setError } = get();

          if (!user) {
            throw new Error('User not authenticated');
          }

          try {
            const { saveInterest } = await import('../services/onboarding-api');
            const response = await saveInterest(interest as any);
            setUser(response.user);
          } catch (error) {
            const message = getErrorMessage(error);
            setError(message);
            throw error;
          }
        },
        updateProfile: async (updates) => {
          const { user, setUser, setError } = get();

          if (!user) {
            throw new Error('User not authenticated');
          }

          try {
            setError(null);

            const response = await authApi.updateProfile(updates);

            if (!response.success) {
              const errorMessage =
                'error' in response
                  ? response.error.message
                  : 'Profile update failed';
              throw new Error(errorMessage);
            }

            setUser(response.data.user as User);
          } catch (error) {
            const message = getErrorMessage(error);
            setError(message);
            throw error;
          }
        },

        completeOnboarding: async () => {
          const { user, setUser, setError } = get();

          if (!user) {
            throw new Error('User not authenticated');
          }

          try {
            setError(null);

            const { completeOnboarding } = await import(
              '../services/onboarding-api'
            );
            const response = await completeOnboarding();
            setUser(response.user);
          } catch (error) {
            const message = getErrorMessage(error);
            setError(message);
            throw error;
          }
        },

        loadOrganizations: async () => {
          try {
            set((state) => {
              state.isLoadingOrganizations = true;
            });

            const organizations = await getAllOrganizations();

            set((state) => {
              state.organizations = organizations;
              state.isLoadingOrganizations = false;
            });
          } catch (error) {
            console.error('Failed to load organizations:', error);
            set((state) => {
              state.isLoadingOrganizations = false;
            });
          }
        },
      })),
      {
        name: 'auth-store',
        partialize: (state) => ({
          // Only persist user data and organizations - tokens are handled by TokenManager
          user: state.user,
          isAuthenticated: state.isAuthenticated,
          organizations: state.organizations,
        }),
      }
    ),
    { name: 'auth-store' }
  )
);
