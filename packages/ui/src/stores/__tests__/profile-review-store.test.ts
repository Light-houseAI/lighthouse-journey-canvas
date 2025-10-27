/**
 * Profile Review Store Tests
 * Tests for persistence and state management
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useProfileReviewStore } from '../profile-review-store';

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

describe('ProfileReviewStore - Persistence', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorageMock.clear();
    // Reset the store
    useProfileReviewStore.getState().reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should persist selectedInterest to localStorage', () => {
    // Arrange
    const { setSelectedInterest } = useProfileReviewStore.getState();

    // Act
    setSelectedInterest('find-job');

    // Assert
    const state = useProfileReviewStore.getState();
    expect(state.selectedInterest).toBe('find-job');

    // Check if persisted to localStorage
    // Note: This will fail until we implement persist middleware in T008
    const persistedData = localStorage.getItem('lighthouse-onboarding-state');
    expect(persistedData).toBeTruthy();
    if (persistedData) {
      const parsed = JSON.parse(persistedData);
      expect(parsed.state.selectedInterest).toBe('find-job');
    }
  });

  it('should persist currentOnboardingStep to localStorage', () => {
    // Arrange
    const { setOnboardingStep } = useProfileReviewStore.getState();

    // Act
    setOnboardingStep(2);

    // Assert
    const state = useProfileReviewStore.getState();
    expect(state.currentOnboardingStep).toBe(2);

    // Check if persisted to localStorage
    // Note: This will fail until we implement persist middleware in T008
    const persistedData = localStorage.getItem('lighthouse-onboarding-state');
    expect(persistedData).toBeTruthy();
    if (persistedData) {
      const parsed = JSON.parse(persistedData);
      expect(parsed.state.currentOnboardingStep).toBe(2);
    }
  });

  it('should hydrate from localStorage on init', () => {
    // Arrange - Manually set localStorage data
    const persistedState = {
      state: {
        selectedInterest: 'grow-career',
        currentOnboardingStep: 3,
      },
      version: 0,
    };
    localStorage.setItem(
      'lighthouse-onboarding-state',
      JSON.stringify(persistedState)
    );

    // Act - Create new instance of the store (simulate page refresh)
    // Note: This is tricky with Zustand as stores are singletons
    // In a real scenario, we'd need to reload the module
    // For now, we'll test the pattern exists

    // This test will properly work once we implement persist middleware
    const state = useProfileReviewStore.getState();

    // Assert - Should have hydrated from localStorage
    expect(state.selectedInterest).toBe('grow-career');
    expect(state.currentOnboardingStep).toBe(3);
  });

  it('should clear persisted state on reset', () => {
    // Arrange - Set some state first
    const { setSelectedInterest, setOnboardingStep } =
      useProfileReviewStore.getState();
    setSelectedInterest('find-job');
    setOnboardingStep(2);

    // Verify state is set
    expect(useProfileReviewStore.getState().selectedInterest).toBe('find-job');
    expect(useProfileReviewStore.getState().currentOnboardingStep).toBe(2);

    // Act - Reset the store
    useProfileReviewStore.getState().reset();

    // Assert - State should be cleared
    const state = useProfileReviewStore.getState();
    expect(state.selectedInterest).toBeNull();
    expect(state.currentOnboardingStep).toBe(1);

    // Note: Persist middleware should also clear localStorage
    // This will work once we implement T008
  });

  it('should not persist selection state (only persist onboarding state)', () => {
    // Arrange
    const mockProfile = {
      name: 'Test User',
      headline: 'Software Engineer',
      location: 'San Francisco',
      about: 'About me',
      avatarUrl: 'https://example.com/avatar.jpg',
      experiences: [
        {
          title: 'Engineer',
          company: 'Tech Corp',
          start: '2020-01',
          end: '2023-01',
        },
      ],
      education: [
        {
          school: 'University',
          degree: 'BS Computer Science',
          start: '2016-09',
          end: '2020-05',
        },
      ],
      skills: [],
    };

    // Act
    useProfileReviewStore.getState().initializeSelection(mockProfile);

    // Assert - selection should exist in memory
    const state = useProfileReviewStore.getState();
    expect(state.selection).toBeTruthy();

    // But it should NOT be persisted to localStorage
    const persistedData = localStorage.getItem('lighthouse-onboarding-state');
    if (persistedData) {
      const parsed = JSON.parse(persistedData);
      // selection should not be in persisted state
      expect(parsed.state.selection).toBeUndefined();
    }
  });
});
