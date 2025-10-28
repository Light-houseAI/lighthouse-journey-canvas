/**
 * SignUp Component Tests
 *
 * Tests for user registration flow including:
 * - Form rendering and validation
 * - Successful signup
 * - Error handling
 * - Navigation and loading states
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useToast } from '../hooks/use-toast';
import SignUp from './signup';

// Mock toast function
const mockToast = vi.fn();

// Mock dependencies
vi.mock('../hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      backgroundGradient: 'bg-gradient-to-br from-blue-50 to-indigo-100',
      cardBackground: 'bg-white',
      primaryBorder: 'border-blue-500',
      cardShadow: 'shadow-xl',
      primaryText: 'text-gray-900',
      secondaryText: 'text-gray-600',
      inputBackground: 'bg-white',
      placeholderText: 'text-gray-400',
      focusBorder: 'focus:border-blue-600',
      focus: 'focus:ring-2 focus:ring-blue-500',
    },
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
  },
}));

// Mock auth API
const mockSignup = vi.fn();
vi.mock('../services/auth-api', () => ({
  signup: (data: any) => mockSignup(data),
}));

// Mock token manager
vi.mock('../services/token-manager', () => ({
  tokenManager: {
    setTokens: vi.fn(),
    isAuthenticated: vi.fn(() => false),
  },
}));

// Mock auth store
vi.mock('../stores/auth-store', () => ({
  useAuthStore: {
    getState: () => ({
      setUser: vi.fn(),
    }),
  },
}));

// Mock profile review store
vi.mock('../stores/profile-review-store', () => ({
  useProfileReviewStore: {
    getState: () => ({
      reset: vi.fn(),
    }),
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

describe('SignUp Component', () => {
  const mockOnSwitchToSignIn = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all form elements', () => {
      render(
        <TestWrapper>
          <SignUp onSwitchToSignIn={mockOnSwitchToSignIn} />
        </TestWrapper>
      );

      expect(screen.getByText('Begin Your Journey')).toBeInTheDocument();
      expect(
        screen.getByText('Create your professional timeline')
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /create account/i })
      ).toBeInTheDocument();
    });

    it('should render sign in link', () => {
      render(
        <TestWrapper>
          <SignUp onSwitchToSignIn={mockOnSwitchToSignIn} />
        </TestWrapper>
      );

      expect(screen.getByText('Already have an account?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should have email and password inputs with correct types', () => {
      render(
        <TestWrapper>
          <SignUp onSwitchToSignIn={mockOnSwitchToSignIn} />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);

      expect(emailInput).toHaveAttribute('type', 'email');
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  describe('Form Validation', () => {
    it('should show validation error for invalid email', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <SignUp onSwitchToSignIn={mockOnSwitchToSignIn} />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'invalid-email');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('should show validation error for short password', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <SignUp onSwitchToSignIn={mockOnSwitchToSignIn} />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email address/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, '123'); // Too short
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/password must be at least 8 characters long/i)
        ).toBeInTheDocument();
      });
    });

    it('should show validation errors for empty fields', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <SignUp onSwitchToSignIn={mockOnSwitchToSignIn} />
        </TestWrapper>
      );

      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
        expect(
          screen.getByText(/password must be at least 8 characters long/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Successful Signup', () => {
    it('should call signup with correct credentials', async () => {
      const user = userEvent.setup();

      mockSignup.mockResolvedValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: 1,
          email: 'test@example.com',
          hasCompletedOnboarding: false,
          createdAt: '2024-01-01T00:00:00Z',
        },
      });

      render(
        <TestWrapper>
          <SignUp onSwitchToSignIn={mockOnSwitchToSignIn} />
        </TestWrapper>
      );

      await user.type(
        screen.getByLabelText(/email address/i),
        'test@example.com'
      );
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(mockSignup).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('should show success toast on successful signup', async () => {
      const user = userEvent.setup();

      mockSignup.mockResolvedValue({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: 1,
          email: 'test@example.com',
          hasCompletedOnboarding: false,
          createdAt: '2024-01-01T00:00:00Z',
        },
      });

      render(
        <TestWrapper>
          <SignUp onSwitchToSignIn={mockOnSwitchToSignIn} />
        </TestWrapper>
      );

      await user.type(
        screen.getByLabelText(/email address/i),
        'test@example.com'
      );
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Account created!',
          description: "Welcome! Let's get you set up.",
        });
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state during signup', async () => {
      const user = userEvent.setup();
      let resolveSignup: (value: any) => void;
      const signupPromise = new Promise((resolve) => {
        resolveSignup = resolve;
      });
      mockSignup.mockReturnValue(signupPromise);

      render(
        <TestWrapper>
          <SignUp onSwitchToSignIn={mockOnSwitchToSignIn} />
        </TestWrapper>
      );

      await user.type(
        screen.getByLabelText(/email address/i),
        'test@example.com'
      );
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(screen.getByText('Creating account...')).toBeInTheDocument();
        const submitButton = screen.getByRole('button', {
          name: /creating account/i,
        });
        expect(submitButton).toBeDisabled();
      });

      // Resolve the promise to clean up
      resolveSignup!({
        accessToken: 'mock-token',
        refreshToken: 'mock-refresh',
        user: { id: 1, email: 'test@example.com' },
      });
    });

    it('should disable submit button during signup', async () => {
      const user = userEvent.setup();
      let resolveSignup: (value: any) => void;
      const signupPromise = new Promise((resolve) => {
        resolveSignup = resolve;
      });
      mockSignup.mockReturnValue(signupPromise);

      render(
        <TestWrapper>
          <SignUp onSwitchToSignIn={mockOnSwitchToSignIn} />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', {
        name: /create account/i,
      });
      expect(submitButton).not.toBeDisabled();

      await user.type(
        screen.getByLabelText(/email address/i),
        'test@example.com'
      );
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        const disabledButton = screen.getByRole('button', {
          name: /creating account/i,
        });
        expect(disabledButton).toBeDisabled();
      });

      // Resolve the promise to clean up
      resolveSignup!({
        accessToken: 'mock-token',
        refreshToken: 'mock-refresh',
        user: { id: 1, email: 'test@example.com' },
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error toast on signup failure', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Email already exists';
      mockSignup.mockRejectedValue(new Error(errorMessage));

      render(
        <TestWrapper>
          <SignUp onSwitchToSignIn={mockOnSwitchToSignIn} />
        </TestWrapper>
      );

      await user.type(
        screen.getByLabelText(/email address/i),
        'existing@example.com'
      );
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Sign up failed',
          description: errorMessage,
          variant: 'destructive',
        });
      });
    });

    it('should handle network errors gracefully', async () => {
      const user = userEvent.setup();
      mockSignup.mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <SignUp onSwitchToSignIn={mockOnSwitchToSignIn} />
        </TestWrapper>
      );

      await user.type(
        screen.getByLabelText(/email address/i),
        'test@example.com'
      );
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Sign up failed',
            variant: 'destructive',
          })
        );
      });
    });
  });

  describe('Navigation', () => {
    it('should call onSwitchToSignIn when sign in link is clicked', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <SignUp onSwitchToSignIn={mockOnSwitchToSignIn} />
        </TestWrapper>
      );

      const signInButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(signInButton);

      expect(mockOnSwitchToSignIn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Form Input Behavior', () => {
    it('should update email field value when typing', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <SignUp onSwitchToSignIn={mockOnSwitchToSignIn} />
        </TestWrapper>
      );

      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'test@example.com');

      expect(emailInput).toHaveValue('test@example.com');
    });

    it('should update password field value when typing', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <SignUp onSwitchToSignIn={mockOnSwitchToSignIn} />
        </TestWrapper>
      );

      const passwordInput = screen.getByLabelText(/password/i);
      await user.type(passwordInput, 'password123');

      expect(passwordInput).toHaveValue('password123');
    });

    it('should handle form submission with Enter key', async () => {
      const user = userEvent.setup();

      mockSignup.mockResolvedValue({
        accessToken: 'mock-token',
        refreshToken: 'mock-refresh',
        user: { id: 1, email: 'test@example.com' },
      });

      render(
        <TestWrapper>
          <SignUp onSwitchToSignIn={mockOnSwitchToSignIn} />
        </TestWrapper>
      );

      await user.type(
        screen.getByLabelText(/email address/i),
        'test@example.com'
      );
      await user.type(screen.getByLabelText(/password/i), 'password123{Enter}');

      await waitFor(() => {
        expect(mockSignup).toHaveBeenCalled();
      });
    });
  });
});
