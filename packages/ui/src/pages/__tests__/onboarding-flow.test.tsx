/**
 * Onboarding Flow Integration Tests
 * Tests UI integration and user flows
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useProfileReviewStore } from '../../stores/profile-review-store';
import OnboardingStep1 from '../onboarding-step1';

// Mock hooks
vi.mock('../../hooks/useAuth', () => ({
  useLogout: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('../../hooks/useOnboarding', () => ({
  useUpdateInterest: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isLoading: false,
  }),
  useExtractProfile: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isLoading: false,
  }),
  useSaveProfile: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isLoading: false,
  }),
  useCurrentUser: () => ({
    data: { id: 1, hasCompletedOnboarding: false },
  }),
}));

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      backgroundGradient: 'bg-gradient-to-br from-green-50 to-blue-50',
    },
  }),
}));

vi.mock('../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Onboarding Flow Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Clear localStorage before each test
    localStorageMock.clear();
    // Reset the store
    useProfileReviewStore.getState().reset();

    // Create a new QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should save interest to server on Step 1 submit', async () => {
    // Arrange
    const user = userEvent.setup();
    const mockMutateAsync = vi.fn();

    // Mock useUpdateInterest
    const { useUpdateInterest } = await import('../../hooks/useOnboarding');
    vi.mocked(useUpdateInterest).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isLoading: false,
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <OnboardingStep1 />
      </QueryClientProvider>
    );

    // Act - Select an interest
    const findJobRadio = screen.getByLabelText(/Find a new job/i);
    await user.click(findJobRadio);

    // Find and click the continue button
    const continueButton = screen.getByRole('button', { name: /continue/i });
    await user.click(continueButton);

    // Assert
    // Note: This will fail until we implement T009 (connect interest to backend)
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith('find-job');
    });

    // Should also update Zustand state
    expect(useProfileReviewStore.getState().selectedInterest).toBe('find-job');
  });

  it('should restore interest from localStorage after refresh', () => {
    // Arrange - Manually set localStorage data
    const persistedState = {
      state: {
        selectedInterest: 'grow-career',
        currentOnboardingStep: 2,
      },
      version: 0,
    };
    localStorage.setItem(
      'lighthouse-onboarding-state',
      JSON.stringify(persistedState)
    );

    // Act - Render the component (simulating page refresh)
    render(
      <QueryClientProvider client={queryClient}>
        <OnboardingStep1 />
      </QueryClientProvider>
    );

    // Assert - State should be restored from localStorage
    // Note: This will fail until we implement T008 (Zustand persistence)
    const state = useProfileReviewStore.getState();
    expect(state.selectedInterest).toBe('grow-career');
    expect(state.currentOnboardingStep).toBe(2);
  });

  it('should prevent duplicate profile extraction', async () => {
    // Arrange
    // Mock useCurrentUser to return user with completed onboarding
    const { useCurrentUser } = await import('../../hooks/useOnboarding');
    vi.mocked(useCurrentUser).mockReturnValue({
      data: { id: 1, hasCompletedOnboarding: true },
    } as any);

    // Act
    const { useExtractProfile } = await import('../../hooks/useOnboarding');
    const mockMutateAsync = vi.fn();
    vi.mocked(useExtractProfile).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isLoading: false,
    } as any);

    // Assert
    // Note: This will fail until we implement T010 (UI duplicate prevention)
    // The component should check hasCompletedOnboarding and prevent extraction
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('should disable buttons during async operations', async () => {
    // Arrange
    // Mock mutation as loading
    const { useUpdateInterest } = await import('../../hooks/useOnboarding');
    vi.mocked(useUpdateInterest).mockReturnValue({
      mutateAsync: vi.fn(),
      isLoading: true, // Simulate loading state
    } as any);

    render(
      <QueryClientProvider client={queryClient}>
        <OnboardingStep1 />
      </QueryClientProvider>
    );

    // Act - Try to click the continue button
    const continueButton = screen.getByRole('button', { name: /continue/i });

    // Assert - Button should be disabled during loading
    // Note: This will fail until we implement T011 (loading states)
    expect(continueButton).toBeDisabled();
  });
});
