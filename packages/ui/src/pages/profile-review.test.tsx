import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useToast } from '../hooks/use-toast';
import { useAuthStore } from '../stores/auth-store';
import { useProfileReviewStore } from '../stores/profile-review-store';
import ProfileReview from './profile-review';

vi.mock('../stores/auth-store');
vi.mock('../stores/profile-review-store');
vi.mock('../hooks/use-toast');
vi.mock('wouter', () => ({
  useLocation: () => ['/', vi.fn()],
}));

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
  },
}));

const mockUseAuthStore = vi.mocked(useAuthStore);
const mockUseProfileReviewStore = vi.mocked(useProfileReviewStore);
const mockUseToast = vi.mocked(useToast);

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

describe('ProfileReview Component - Loading States', () => {
  const mockProfile = {
    name: 'John Doe',
    headline: 'Software Engineer',
    location: 'San Francisco',
    about: 'Passionate developer',
    avatarUrl: 'https://example.com/avatar.jpg',
    experiences: [
      {
        title: 'Senior Engineer',
        company: 'Tech Corp',
        start: '2020-01',
        end: 'Present',
        current: true,
        description: 'Leading development team',
      },
    ],
    education: [
      {
        school: 'University',
        degree: 'BS Computer Science',
        field: 'Computer Science',
        start: '2016',
        end: '2020',
      },
    ],
    skills: [],
  };

  const mockSelection = {
    name: true,
    headline: true,
    location: true,
    about: true,
    avatarUrl: true,
    experiences: [true],
    education: [true],
  };

  const mockSaveProfile = vi.fn();
  const mockToast = vi.fn();
  const mockCompleteOnboarding = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();

    mockUseAuthStore.mockReturnValue({
      user: {
        id: 1,
        email: 'test@example.com',
        hasCompletedOnboarding: false,
        createdAt: '2024-01-01T00:00:00Z',
      },
      completeOnboarding: mockCompleteOnboarding,
      isLoading: false,
      error: null,
      isAuthenticated: true,
      setUser: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
      checkAuth: vi.fn(),
      updateUserInterest: vi.fn(),
      updateProfile: vi.fn(),
      clearError: vi.fn(),
      organizations: [],
      isLoadingOrganizations: false,
      loadOrganizations: vi.fn(),
    });

    mockUseToast.mockReturnValue({
      toast: mockToast,
    });
  });

  it('shows loading state when saving profile', async () => {
    const user = userEvent.setup();
    let resolveSave: (value: any) => void;
    const savePromise = new Promise((resolve) => {
      resolveSave = resolve;
    });
    mockSaveProfile.mockReturnValue(savePromise);

    mockUseProfileReviewStore.mockReturnValue({
      extractedProfile: mockProfile,
      selection: mockSelection,
      showSuccess: false,
      error: null,
      username: null,
      selectedInterest: null,
      currentOnboardingStep: 3,
      setExtractedProfile: vi.fn(),
      updateSelection: vi.fn(),
      toggleSelection: vi.fn(),
      toggleExperience: vi.fn(),
      toggleEducation: vi.fn(),
      toggleSectionSelection: vi.fn(),
      setShowSuccess: vi.fn(),
      saveProfile: mockSaveProfile,
      setLoading: vi.fn(),
      setError: vi.fn(),
      clearProfile: vi.fn(),
      reset: vi.fn(),
      setSelectedInterest: vi.fn(),
      setOnboardingStep: vi.fn(),
      goBackToStep1: vi.fn(),
    });

    render(
      <TestWrapper>
        <ProfileReview />
      </TestWrapper>
    );

    await user.click(screen.getByRole('button', { name: 'Save Profile' }));

    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /saving/i });
      expect(saveButton).toBeInTheDocument();
      expect(saveButton).toBeDisabled();
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    resolveSave!(undefined);
  });

  it('shows normal state when not loading', async () => {
    mockUseProfileReviewStore.mockReturnValue({
      extractedProfile: mockProfile,
      selection: mockSelection,
      showSuccess: false,
      error: null,
      username: null,
      selectedInterest: null,
      currentOnboardingStep: 3,
      setExtractedProfile: vi.fn(),
      updateSelection: vi.fn(),
      toggleSelection: vi.fn(),
      toggleExperience: vi.fn(),
      toggleEducation: vi.fn(),
      toggleSectionSelection: vi.fn(),
      setShowSuccess: vi.fn(),
      saveProfile: mockSaveProfile,
      setLoading: vi.fn(),
      setError: vi.fn(),
      clearProfile: vi.fn(),
      reset: vi.fn(),
      setSelectedInterest: vi.fn(),
      setOnboardingStep: vi.fn(),
      goBackToStep1: vi.fn(),
    });

    render(
      <TestWrapper>
        <ProfileReview />
      </TestWrapper>
    );

    const saveButton = screen.getByRole('button', { name: 'Save Profile' });
    expect(saveButton).toBeInTheDocument();
    expect(saveButton).not.toBeDisabled();
  });

  it('calls saveProfile with completeOnboarding when Save Profile is clicked', async () => {
    const user = userEvent.setup();
    mockSaveProfile.mockResolvedValue(undefined);

    mockUseProfileReviewStore.mockReturnValue({
      extractedProfile: mockProfile,
      selection: mockSelection,
      showSuccess: false,
      error: null,
      username: null,
      selectedInterest: null,
      currentOnboardingStep: 3,
      setExtractedProfile: vi.fn(),
      updateSelection: vi.fn(),
      toggleSelection: vi.fn(),
      toggleExperience: vi.fn(),
      toggleEducation: vi.fn(),
      toggleSectionSelection: vi.fn(),
      setShowSuccess: vi.fn(),
      saveProfile: mockSaveProfile,
      setLoading: vi.fn(),
      setError: vi.fn(),
      clearProfile: vi.fn(),
      reset: vi.fn(),
      setSelectedInterest: vi.fn(),
      setOnboardingStep: vi.fn(),
      goBackToStep1: vi.fn(),
    });

    render(
      <TestWrapper>
        <ProfileReview />
      </TestWrapper>
    );

    const saveButton = screen.getByRole('button', { name: 'Save Profile' });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockSaveProfile).toHaveBeenCalledWith(mockCompleteOnboarding);
    });
  });

  it('shows success toast on successful save', async () => {
    const user = userEvent.setup();
    mockSaveProfile.mockResolvedValue(undefined);

    mockUseProfileReviewStore.mockReturnValue({
      extractedProfile: mockProfile,
      selection: mockSelection,
      showSuccess: false,
      error: null,
      username: null,
      selectedInterest: null,
      currentOnboardingStep: 3,
      setExtractedProfile: vi.fn(),
      updateSelection: vi.fn(),
      toggleSelection: vi.fn(),
      toggleExperience: vi.fn(),
      toggleEducation: vi.fn(),
      toggleSectionSelection: vi.fn(),
      setShowSuccess: vi.fn(),
      saveProfile: mockSaveProfile,
      setLoading: vi.fn(),
      setError: vi.fn(),
      clearProfile: vi.fn(),
      reset: vi.fn(),
      setSelectedInterest: vi.fn(),
      setOnboardingStep: vi.fn(),
      goBackToStep1: vi.fn(),
    });

    render(
      <TestWrapper>
        <ProfileReview />
      </TestWrapper>
    );

    const saveButton = screen.getByRole('button', { name: 'Save Profile' });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Profile saved successfully!',
        description: 'Your professional journey is ready to explore.',
      });
    });
  });

  it('shows error toast on save failure', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Network error';
    mockSaveProfile.mockRejectedValue(new Error(errorMessage));

    mockUseProfileReviewStore.mockReturnValue({
      extractedProfile: mockProfile,
      selection: mockSelection,
      showSuccess: false,
      error: null,
      username: null,
      selectedInterest: null,
      currentOnboardingStep: 3,
      setExtractedProfile: vi.fn(),
      updateSelection: vi.fn(),
      toggleSelection: vi.fn(),
      toggleExperience: vi.fn(),
      toggleEducation: vi.fn(),
      toggleSectionSelection: vi.fn(),
      setShowSuccess: vi.fn(),
      saveProfile: mockSaveProfile,
      setLoading: vi.fn(),
      setError: vi.fn(),
      clearProfile: vi.fn(),
      reset: vi.fn(),
      setSelectedInterest: vi.fn(),
      setOnboardingStep: vi.fn(),
      goBackToStep1: vi.fn(),
    });

    render(
      <TestWrapper>
        <ProfileReview />
      </TestWrapper>
    );

    const saveButton = screen.getByRole('button', { name: 'Save Profile' });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Save Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    });
  });
});
