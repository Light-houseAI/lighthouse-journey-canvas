import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useToast } from '../hooks/use-toast';
import { useAuthStore } from '../stores/auth-store';
import SignIn from './signin';

vi.mock('../stores/auth-store');
const mockUseAuthStore = vi.mocked(useAuthStore);

vi.mock('../hooks/use-toast');
const mockUseToast = vi.mocked(useToast);

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      backgroundGradient: 'bg-gradient-to-br from-blue-50 to-indigo-100',
    },
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
  },
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('SignIn Component - Loading States', () => {
  const mockLogin = vi.fn();
  const mockToast = vi.fn();
  const mockOnSwitchToSignUp = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();

    mockUseToast.mockReturnValue({
      toast: mockToast,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state when signing in', async () => {
    const user = userEvent.setup();
    let resolveLogin: (value: any) => void;
    const loginPromise = new Promise((resolve) => {
      resolveLogin = resolve;
    });
    mockLogin.mockReturnValue(loginPromise);

    mockUseAuthStore.mockReturnValue({
      login: mockLogin,
      error: null,
      user: null,
      isAuthenticated: false,
      setUser: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      checkAuth: vi.fn(),
      updateUserInterest: vi.fn(),
      updateProfile: vi.fn(),
      completeOnboarding: vi.fn(),
      clearError: vi.fn(),
      organizations: [],
      isLoadingOrganizations: false,
      loadOrganizations: vi.fn(),
    });

    render(
      <TestWrapper>
        <SignIn onSwitchToSignUp={mockOnSwitchToSignUp} />
      </TestWrapper>
    );

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /signing in/i });
      expect(submitButton).toBeDisabled();
      expect(screen.getByText('Signing in...')).toBeInTheDocument();
    });

    resolveLogin!({
      id: 1,
      email: 'test@example.com',
      hasCompletedOnboarding: true,
      createdAt: '2024-01-01T00:00:00Z',
    });
  });

  it('shows normal state when not loading', async () => {
    mockUseAuthStore.mockReturnValue({
      login: mockLogin,
      error: null,
      user: null,
      isAuthenticated: false,
      setUser: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      checkAuth: vi.fn(),
      updateUserInterest: vi.fn(),
      updateProfile: vi.fn(),
      completeOnboarding: vi.fn(),
      clearError: vi.fn(),
      organizations: [],
      isLoadingOrganizations: false,
      loadOrganizations: vi.fn(),
    });

    render(
      <TestWrapper>
        <SignIn onSwitchToSignUp={mockOnSwitchToSignUp} />
      </TestWrapper>
    );

    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).not.toBeDisabled();
  });

  it('calls login function with correct credentials', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      hasCompletedOnboarding: true,
      createdAt: '2024-01-01T00:00:00Z',
    });

    mockUseAuthStore.mockReturnValue({
      login: mockLogin,
      error: null,
      user: null,
      isAuthenticated: false,
      setUser: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      checkAuth: vi.fn(),
      updateUserInterest: vi.fn(),
      updateProfile: vi.fn(),
      completeOnboarding: vi.fn(),
      clearError: vi.fn(),
      organizations: [],
      isLoadingOrganizations: false,
      loadOrganizations: vi.fn(),
    });

    render(
      <TestWrapper>
        <SignIn onSwitchToSignUp={mockOnSwitchToSignUp} />
      </TestWrapper>
    );

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('shows error toast on failed login', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Invalid email or password';
    mockLogin.mockRejectedValue(new Error(errorMessage));

    mockUseAuthStore.mockReturnValue({
      login: mockLogin,
      error: null,
      user: null,
      isAuthenticated: false,
      setUser: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      checkAuth: vi.fn(),
      updateUserInterest: vi.fn(),
      updateProfile: vi.fn(),
      completeOnboarding: vi.fn(),
      clearError: vi.fn(),
      organizations: [],
      isLoadingOrganizations: false,
      loadOrganizations: vi.fn(),
    });

    render(
      <TestWrapper>
        <SignIn onSwitchToSignUp={mockOnSwitchToSignUp} />
      </TestWrapper>
    );

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Sign in failed',
        description: errorMessage,
        variant: 'destructive',
      });
    });
  });
});
