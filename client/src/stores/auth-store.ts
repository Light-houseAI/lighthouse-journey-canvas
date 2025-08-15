import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface User {
  id: number;
  email: string;
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

            const response = await fetch('/api/signin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(credentials),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ message: 'Login failed' }));
              throw new Error(errorData.message || 'Login failed');
            }

            const { user } = await response.json();
            setUser(user);
            return user;
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

            const response = await fetch('/api/signup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(data),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ message: 'Registration failed' }));
              throw new Error(errorData.message || 'Registration failed');
            }

            const { user } = await response.json();
            setUser(user);
            return user;
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Registration failed';
            setError(message);
            throw error;
          } finally {
            setLoading(false);
          }
        },

        logout: async () => {
          const { setUser, setLoading, setError } = get();

          try {
            setLoading(true);

            await fetch('/api/logout', {
              method: 'POST',
              credentials: 'include',
            });

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

            const response = await fetch('/api/me', {
              credentials: 'include',
            });

            if (response.ok) {
              const { user } = await response.json();
              setUser(user);
            } else {
              setUser(null);
            }
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
            const response = await fetch('/api/onboarding/interest', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ interest }),
            });

            if (!response.ok) {
              throw new Error('Failed to complete onboarding');
            }

            const { user: updatedUser } = await response.json();
            setUser(updatedUser);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update interest';
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

            const response = await fetch('/api/onboarding/complete', {
              method: 'POST',
              credentials: 'include',
            });

            if (!response.ok) {
              throw new Error('Failed to complete onboarding');
            }

            const { user: updatedUser } = await response.json();
            setUser(updatedUser);
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
          user: state.user,
          isAuthenticated: state.isAuthenticated
        }),
      }
    ),
    { name: 'auth-store' }
  )
);
