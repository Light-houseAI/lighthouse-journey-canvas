/**
 * OnboardingStep1 Component Tests
 *
 * Tests for interest selection during onboarding
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OnboardingStep1 from './onboarding-step1';

// Mock dependencies
vi.mock('../hooks/use-toast');
vi.mock('../hooks/useAuth', () => ({
  useLogout: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  }),
}));

vi.mock('../stores/profile-review-store', () => ({
  useProfileReviewStore: () => ({
    setSelectedInterest: vi.fn(),
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
    },
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
    label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
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

describe('OnboardingStep1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render step 1 title and description', () => {
      render(
        <TestWrapper>
          <OnboardingStep1 />
        </TestWrapper>
      );

      expect(
        screen.getByText('What are you most interested in?')
      ).toBeInTheDocument();
      expect(
        screen.getByText('This helps us tailor your experience to your goals')
      ).toBeInTheDocument();
    });

    it('should render progress indicator showing step 1 of 2', () => {
      render(
        <TestWrapper>
          <OnboardingStep1 />
        </TestWrapper>
      );

      expect(screen.getByText('Step 1 of 2')).toBeInTheDocument();
    });

    it('should render back to sign in button', () => {
      render(
        <TestWrapper>
          <OnboardingStep1 />
        </TestWrapper>
      );

      expect(
        screen.getByRole('button', { name: /back to sign in/i })
      ).toBeInTheDocument();
    });

    it('should render all 4 interest options', () => {
      render(
        <TestWrapper>
          <OnboardingStep1 />
        </TestWrapper>
      );

      expect(screen.getByText('Find a new job')).toBeInTheDocument();
      expect(screen.getByText('Grow in my career')).toBeInTheDocument();
      expect(screen.getByText('Change careers')).toBeInTheDocument();
      expect(screen.getByText('Start a startup')).toBeInTheDocument();
    });

    it('should render descriptions for each option', () => {
      render(
        <TestWrapper>
          <OnboardingStep1 />
        </TestWrapper>
      );

      expect(
        screen.getByText('Looking for new career opportunities')
      ).toBeInTheDocument();
      expect(screen.getByText('Advance in my current field')).toBeInTheDocument();
      expect(
        screen.getByText('Switch to a different industry')
      ).toBeInTheDocument();
      expect(screen.getByText('Build my own company')).toBeInTheDocument();
    });

    it('should render continue button', () => {
      render(
        <TestWrapper>
          <OnboardingStep1 />
        </TestWrapper>
      );

      expect(
        screen.getByRole('button', { name: /continue/i })
      ).toBeInTheDocument();
    });
  });

  describe('Interest Selection', () => {
    it('should allow selecting "Find a new job" interest', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <OnboardingStep1 />
        </TestWrapper>
      );

      const option = screen.getByLabelText(/find a new job/i);
      await user.click(option);

      expect(option).toBeChecked();
    });

    it('should allow selecting "Grow in my career" interest', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <OnboardingStep1 />
        </TestWrapper>
      );

      const option = screen.getByLabelText(/grow in my career/i);
      await user.click(option);

      expect(option).toBeChecked();
    });

    it('should allow selecting "Change careers" interest', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <OnboardingStep1 />
        </TestWrapper>
      );

      const option = screen.getByLabelText(/change careers/i);
      await user.click(option);

      expect(option).toBeChecked();
    });

    it('should allow selecting "Start a startup" interest', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <OnboardingStep1 />
        </TestWrapper>
      );

      const option = screen.getByLabelText(/start a startup/i);
      await user.click(option);

      expect(option).toBeChecked();
    });

    it('should allow changing selection', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <OnboardingStep1 />
        </TestWrapper>
      );

      const firstOption = screen.getByLabelText(/find a new job/i);
      const secondOption = screen.getByLabelText(/grow in my career/i);

      await user.click(firstOption);
      expect(firstOption).toBeChecked();

      await user.click(secondOption);
      expect(secondOption).toBeChecked();
      expect(firstOption).not.toBeChecked();
    });
  });

  describe('Form Submission', () => {
    it('should submit form when continue is clicked with selection', async () => {
      const user = userEvent.setup();
      const { useToast } = await import('../hooks/use-toast');
      const mockToast = vi.fn();
      vi.mocked(useToast).mockReturnValue({ toast: mockToast });

      render(
        <TestWrapper>
          <OnboardingStep1 />
        </TestWrapper>
      );

      const option = screen.getByLabelText(/find a new job/i);
      await user.click(option);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Success',
          description: "Let's extract your profile data!",
        });
      });
    });

    it('should show validation error if no selection made', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <OnboardingStep1 />
        </TestWrapper>
      );

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(
          screen.getByText(/please select your interest/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should call logout when back to sign in is clicked', async () => {
      const user = userEvent.setup();
      const mockLogoutAsync = vi.fn().mockResolvedValue(undefined);

      const { useLogout } = await import('../hooks/useAuth');
      vi.mocked(useLogout).mockReturnValue({
        mutate: vi.fn(),
        mutateAsync: mockLogoutAsync,
        isPending: false,
        error: null,
      });

      render(
        <TestWrapper>
          <OnboardingStep1 />
        </TestWrapper>
      );

      const backButton = screen.getByRole('button', {
        name: /back to sign in/i,
      });
      await user.click(backButton);

      await waitFor(() => {
        expect(mockLogoutAsync).toHaveBeenCalled();
      });
    });
  });
});
