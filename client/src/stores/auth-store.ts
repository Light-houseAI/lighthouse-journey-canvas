import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { httpClient } from '../services/http-client';
import { tokenManager } from '../services/token-manager';

export interface User {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  userName?: string;
  interest?: string;
  hasCompletedOnboarding: boolean;
  createdAt: string;
}

interface AuthState {
  // State
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: (credentials: { email: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
  register: (data: { email: string; password: string }) => Promise<User>;
  checkAuth: () => Promise<void>;
  updateUserInterest: (interest: string) => Promise<void>;
  updateProfile: (updates: { firstName?: string; lastName?: string; userName?: string }) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        user: null,
        isLoading: false,
        error: null,
        isAuthenticated: false,

        // Actions
        setUser: (user) => set((state) => {
          state.user = user;
          state.isAuthenticated = !!user;
          state.error = null;
        }),

        setLoading: (loading) => set((state) => {
          state.isLoading = loading;
        }),

        setError: (error) => set((state) => {
          state.error = error;
          state.isLoading = false;
        }),

        clearError: () => set((state) => {
          state.error = null;
        }),

        login: async (credentials) => {
          const { setUser, setLoading, setError } = get();

          try {
            setLoading(true);
            setError(null);

            const response = await httpClient.login(credentials);
            setUser(response.user);
            return response.user;
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Login failed';
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

            const response = await httpClient.register(data);
            setUser(response.user);
            return response.user;
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Registration failed';
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

            await httpClient.logout();
            setUser(null); // Hierarchy store will automatically clear via subscription
          } catch (error) {
            console.error('Logout error:', error);
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

            const response = await httpClient.getCurrentUser();
            setUser(response.user);
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
            const response = await httpClient.post('/api/onboarding/interest', { interest });
            setUser(response.user);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update interest';
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

            const response = await httpClient.updateProfile(updates);
            setUser(response.user);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update profile';
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

            const response = await httpClient.post('/api/onboarding/complete');
            setUser(response.user);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to complete onboarding';
            setError(message);
            throw error;
          }
        },
      })),
      {
        name: 'auth-store',
        partialize: (state) => ({
          // Only persist user data - tokens are handled by TokenManager
          user: state.user,
          isAuthenticated: state.isAuthenticated
        }),
      }
    ),
    { name: 'auth-store' }
  )
);
