/**
 * OnboardingStep2 Component Tests
 *
 * Tests for LinkedIn profile extraction during onboarding
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OnboardingStep2 from './onboarding-step2';

// Mock dependencies
const mockExtractProfile = vi.fn();
const mockInitializeSelection = vi.fn();
const mockGoBackToStep1 = vi.fn();

vi.mock('../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));
vi.mock('../hooks/useAuth', () => ({
  useCurrentUser: () => ({
    data: null,
    isLoading: false,
  }),
}));

vi.mock('../hooks/useOnboarding', () => ({
  useExtractProfile: () => ({
    mutate: vi.fn(),
    mutateAsync: mockExtractProfile,
    isPending: false,
    error: null,
    data: null,
  }),
}));

vi.mock('../stores/profile-review-store', () => ({
  useProfileReviewStore: () => ({
    initializeSelection: mockInitializeSelection,
    goBackToStep1: mockGoBackToStep1,
  }),
}));

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      backgroundGradient: 'bg-gradient',
      cardBackground: 'bg-white',
      primaryBorder: 'border-blue',
      cardShadow: 'shadow-xl',
      primaryText: 'text-gray-900',
      secondaryText: 'text-gray-600',
      inputBackground: 'bg-gray-50',
      placeholderText: 'text-gray-400',
    },
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
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

describe('OnboardingStep2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render step 2 title and description', () => {
      render(
        <TestWrapper>
          <OnboardingStep2 />
        </TestWrapper>
      );

      expect(
        screen.getByText("Let's extract your professional data")
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Enter your LinkedIn username/i)
      ).toBeInTheDocument();
    });

    it('should render progress indicator showing step 2 of 2', () => {
      render(
        <TestWrapper>
          <OnboardingStep2 />
        </TestWrapper>
      );

      expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
    });

    it('should render back to step 1 button', () => {
      render(
        <TestWrapper>
          <OnboardingStep2 />
        </TestWrapper>
      );

      expect(
        screen.getByRole('button', { name: /back to step 1/i })
      ).toBeInTheDocument();
    });

    it('should render LinkedIn username input', () => {
      render(
        <TestWrapper>
          <OnboardingStep2 />
        </TestWrapper>
      );

      expect(screen.getByLabelText(/LinkedIn Profile URL/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/john-smith/i)).toBeInTheDocument();
    });

    it('should render extract profile button', () => {
      render(
        <TestWrapper>
          <OnboardingStep2 />
        </TestWrapper>
      );

      expect(
        screen.getByRole('button', { name: /Extract Profile Data/i })
      ).toBeInTheDocument();
    });

    it('should show linkedin.com/in/ prefix', () => {
      render(
        <TestWrapper>
          <OnboardingStep2 />
        </TestWrapper>
      );

      expect(screen.getByText('linkedin.com/in/')).toBeInTheDocument();
    });
  });

  describe('Username Input', () => {
    it('should allow typing username', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <OnboardingStep2 />
        </TestWrapper>
      );

      const input = screen.getByLabelText(/LinkedIn Profile URL/i);
      await user.type(input, 'john-smith-123');

      expect(input).toHaveValue('john-smith-123');
    });

    it('should extract username from full LinkedIn URL', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <OnboardingStep2 />
        </TestWrapper>
      );

      const input = screen.getByLabelText(/LinkedIn Profile URL/i);
      await user.type(input, 'https://www.linkedin.com/in/john-smith-123/');

      await waitFor(() => {
        expect(input).toHaveValue('john-smith-123');
      });
    });

    it('should show validation warning for spaces in username', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <OnboardingStep2 />
        </TestWrapper>
      );

      const input = screen.getByLabelText(/LinkedIn Profile URL/i);
      await user.type(input, 'john smith');

      await waitFor(() => {
        expect(
          screen.getByText(/doesn't look like a LinkedIn username/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Profile Extraction', () => {
    it('should call extractProfile with username on submit', async () => {
      const user = userEvent.setup();

      const mockProfile = {
        firstName: 'John',
        lastName: 'Smith',
        headline: 'Software Engineer',
        experiences: [],
        education: [],
        skills: [],
      };

      mockExtractProfile.mockResolvedValue(mockProfile);

      render(
        <TestWrapper>
          <OnboardingStep2 />
        </TestWrapper>
      );

      const input = screen.getByLabelText(/LinkedIn Profile URL/i);
      await user.type(input, 'john-smith-123');

      const submitButton = screen.getByRole('button', {
        name: /Extract Profile Data/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockExtractProfile).toHaveBeenCalledWith('john-smith-123');
      });
    });

    it('should initialize selection with extracted profile', async () => {
      const user = userEvent.setup();

      const mockProfile = {
        firstName: 'John',
        lastName: 'Smith',
        headline: 'Software Engineer',
        experiences: [],
        education: [],
        skills: [],
      };

      mockExtractProfile.mockResolvedValue(mockProfile);

      render(
        <TestWrapper>
          <OnboardingStep2 />
        </TestWrapper>
      );

      const input = screen.getByLabelText(/LinkedIn Profile URL/i);
      await user.type(input, 'john-smith-123');

      const submitButton = screen.getByRole('button', {
        name: /Extract Profile Data/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockInitializeSelection).toHaveBeenCalledWith(mockProfile);
      });
    });

    it('should show success toast after extraction', async () => {
      const user = userEvent.setup();
      const { useToast } = await import('../hooks/use-toast');
      const mockToast = vi.fn();
      vi.mocked(useToast).mockReturnValue({ toast: mockToast });

      const mockProfile = {
        firstName: 'John',
        lastName: 'Smith',
        headline: 'Engineer',
        experiences: [],
        education: [],
        skills: [],
      };

      mockExtractProfile.mockResolvedValue(mockProfile);

      render(
        <TestWrapper>
          <OnboardingStep2 />
        </TestWrapper>
      );

      const input = screen.getByLabelText(/LinkedIn Profile URL/i);
      await user.type(input, 'john-smith-123');

      const submitButton = screen.getByRole('button', {
        name: /Extract Profile Data/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Profile extracted successfully!',
          description: 'Review and save your profile data.',
        });
      });
    });

    it('should show error toast on extraction failure', async () => {
      const user = userEvent.setup();
      const { useToast } = await import('../hooks/use-toast');
      const mockToast = vi.fn();
      vi.mocked(useToast).mockReturnValue({ toast: mockToast });

      mockExtractProfile.mockRejectedValue(
        new Error('LinkedIn profile not found')
      );

      render(
        <TestWrapper>
          <OnboardingStep2 />
        </TestWrapper>
      );

      const input = screen.getByLabelText(/LinkedIn Profile URL/i);
      await user.type(input, 'invalid-user');

      const submitButton = screen.getByRole('button', {
        name: /Extract Profile Data/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Extraction failed',
          description: 'LinkedIn profile not found',
          variant: 'destructive',
        });
      });
    });

    it('should show validation error for empty username', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <OnboardingStep2 />
        </TestWrapper>
      );

      const submitButton = screen.getByRole('button', {
        name: /Extract Profile Data/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/username is required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should call goBackToStep1 when back button clicked', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <OnboardingStep2 />
        </TestWrapper>
      );

      const backButton = screen.getByRole('button', {
        name: /back to step 1/i,
      });
      await user.click(backButton);

      expect(mockGoBackToStep1).toHaveBeenCalled();
    });
  });
});
