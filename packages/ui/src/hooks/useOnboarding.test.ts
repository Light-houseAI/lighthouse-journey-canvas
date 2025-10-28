/**
 * useOnboarding Hooks Tests
 *
 * Tests for onboarding hooks including:
 * - useExtractProfile
 * - useSaveInterest
 * - useSaveProfile
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as onboardingApi from '../services/onboarding-api';
import {
  useExtractProfile,
  useSaveInterest,
  useSaveProfile,
} from './useOnboarding';

// Mock dependencies
vi.mock('../services/onboarding-api');
vi.mock('./useAuth', () => ({
  authKeys: {
    currentUser: () => ['auth', 'currentUser'],
  },
}));

const mockOnboardingApi = vi.mocked(onboardingApi);

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useOnboarding Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useExtractProfile', () => {
    it('should extract profile successfully', async () => {
      const mockProfileData = {
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          headline: 'Software Engineer',
          experiences: [
            {
              title: 'Senior Engineer',
              company: 'Tech Corp',
              startDate: '2020-01',
              endDate: null,
              description: 'Building software',
            },
          ],
          education: [],
          skills: ['JavaScript', 'TypeScript'],
        },
      };

      mockOnboardingApi.extractProfile.mockResolvedValue(mockProfileData);

      const { result } = renderHook(() => useExtractProfile(), {
        wrapper: createWrapper(),
      });

      const username = 'johndoe';
      result.current.mutate(username);

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(mockOnboardingApi.extractProfile).toHaveBeenCalledWith(username);
      expect(result.current.data).toEqual(mockProfileData.profile);
    });

    it('should return profile via mutateAsync', async () => {
      const mockProfileData = {
        profile: {
          firstName: 'Jane',
          lastName: 'Smith',
          headline: 'Product Manager',
          experiences: [],
          education: [],
          skills: [],
        },
      };

      mockOnboardingApi.extractProfile.mockResolvedValue(mockProfileData);

      const { result } = renderHook(() => useExtractProfile(), {
        wrapper: createWrapper(),
      });

      const profile = await result.current.mutateAsync('janesmith');

      expect(profile).toEqual(mockProfileData.profile);
    });

    it('should handle extraction errors', async () => {
      const error = new Error('LinkedIn profile not found');
      mockOnboardingApi.extractProfile.mockRejectedValue(error);

      const { result } = renderHook(() => useExtractProfile(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('invaliduser');

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toBe('LinkedIn profile not found');
    });

    it('should handle invalid username format', async () => {
      const error = new Error(
        'Username can only contain letters, numbers, hyphens, and underscores'
      );
      mockOnboardingApi.extractProfile.mockRejectedValue(error);

      const { result } = renderHook(() => useExtractProfile(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('invalid@username');

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });

    it('should set isPending during extraction', async () => {
      let resolveExtract: (value: any) => void;
      const extractPromise = new Promise((resolve) => {
        resolveExtract = resolve;
      });
      mockOnboardingApi.extractProfile.mockReturnValue(extractPromise);

      const { result } = renderHook(() => useExtractProfile(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('johndoe');

      await waitFor(() => {
        expect(result.current.isPending).toBe(true);
      });

      resolveExtract!({ profile: {} });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });
    });

    it('should not retry on failure', async () => {
      const error = new Error('Network error');
      mockOnboardingApi.extractProfile.mockRejectedValue(error);

      const { result } = renderHook(() => useExtractProfile(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('johndoe');

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      // Should only be called once (no retries)
      expect(mockOnboardingApi.extractProfile).toHaveBeenCalledTimes(1);
    });
  });

  describe('useSaveInterest', () => {
    it('should save interest successfully', async () => {
      const mockResponse = {
        user: {
          id: 1,
          email: 'test@example.com',
          interest: 'find-job',
          hasCompletedOnboarding: false,
        },
      };

      mockOnboardingApi.saveInterest.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useSaveInterest(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('find-job');

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(mockOnboardingApi.saveInterest).toHaveBeenCalledWith('find-job');
    });

    it('should save different interest types', async () => {
      const interests = [
        'find-job',
        'grow-career',
        'change-careers',
        'start-startup',
      ] as const;

      for (const interest of interests) {
        mockOnboardingApi.saveInterest.mockResolvedValue({
          user: { id: 1, interest },
        });

        const { result } = renderHook(() => useSaveInterest(), {
          wrapper: createWrapper(),
        });

        result.current.mutate(interest);

        await waitFor(() => {
          expect(result.current.isPending).toBe(false);
        });

        expect(mockOnboardingApi.saveInterest).toHaveBeenCalledWith(interest);
      }
    });

    it('should invalidate current user query on success', async () => {
      mockOnboardingApi.saveInterest.mockResolvedValue({
        user: { id: 1, interest: 'grow-career' },
      });

      const queryClient = new QueryClient();
      const spy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useSaveInterest(), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        ),
      });

      result.current.mutate('grow-career');

      await waitFor(() => {
        expect(spy).toHaveBeenCalledWith({
          queryKey: ['auth', 'currentUser'],
        });
      });
    });

    it('should handle save interest errors', async () => {
      const error = new Error('Validation failed');
      mockOnboardingApi.saveInterest.mockRejectedValue(error);

      const { result } = renderHook(() => useSaveInterest(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('find-job');

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toBe('Validation failed');
    });

    it('should work with mutateAsync', async () => {
      const mockResponse = {
        user: {
          id: 1,
          email: 'test@example.com',
          interest: 'change-careers',
        },
      };

      mockOnboardingApi.saveInterest.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useSaveInterest(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync('change-careers');

      expect(mockOnboardingApi.saveInterest).toHaveBeenCalledWith(
        'change-careers'
      );
    });

    it('should not retry on failure', async () => {
      const error = new Error('Server error');
      mockOnboardingApi.saveInterest.mockRejectedValue(error);

      const { result } = renderHook(() => useSaveInterest(), {
        wrapper: createWrapper(),
      });

      result.current.mutate('find-job');

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(mockOnboardingApi.saveInterest).toHaveBeenCalledTimes(1);
    });
  });

  describe('useSaveProfile', () => {
    const mockProfileData = {
      username: 'johndoe',
      rawData: {
        firstName: 'John',
        lastName: 'Doe',
        headline: 'Software Engineer',
        experiences: [],
        education: [],
        skills: [],
      },
      filteredData: {
        firstName: 'John',
        lastName: 'Doe',
        headline: 'Software Engineer',
        experiences: [],
        education: [],
        skills: [],
      },
    };

    it('should save profile successfully', async () => {
      mockOnboardingApi.saveProfile.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useSaveProfile(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockProfileData);

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(mockOnboardingApi.saveProfile).toHaveBeenCalledWith(
        mockProfileData
      );
    });

    it('should handle save profile errors', async () => {
      const error = new Error('Profile validation failed');
      mockOnboardingApi.saveProfile.mockRejectedValue(error);

      const { result } = renderHook(() => useSaveProfile(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockProfileData);

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error?.message).toBe('Profile validation failed');
    });

    it('should work with mutateAsync', async () => {
      mockOnboardingApi.saveProfile.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useSaveProfile(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync(mockProfileData);

      expect(mockOnboardingApi.saveProfile).toHaveBeenCalledWith(
        mockProfileData
      );
    });

    it('should handle missing required fields', async () => {
      const error = new Error('Username is required');
      mockOnboardingApi.saveProfile.mockRejectedValue(error);

      const invalidData = {
        username: '',
        rawData: mockProfileData.rawData,
        filteredData: mockProfileData.filteredData,
      };

      const { result } = renderHook(() => useSaveProfile(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(invalidData as Partial<any>);

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });

    it('should set isPending during save', async () => {
      let resolveSave: (value: any) => void;
      const savePromise = new Promise((resolve) => {
        resolveSave = resolve;
      });
      mockOnboardingApi.saveProfile.mockReturnValue(savePromise);

      const { result } = renderHook(() => useSaveProfile(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockProfileData);

      await waitFor(() => {
        expect(result.current.isPending).toBe(true);
      });

      resolveSave!({ success: true });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });
    });

    it('should not retry on failure', async () => {
      const error = new Error('Network error');
      mockOnboardingApi.saveProfile.mockRejectedValue(error);

      const { result } = renderHook(() => useSaveProfile(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockProfileData);

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(mockOnboardingApi.saveProfile).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integration: Complete Onboarding Flow', () => {
    it('should complete full onboarding sequence', async () => {
      // Step 1: Save interest
      mockOnboardingApi.saveInterest.mockResolvedValue({
        user: { id: 1, interest: 'find-job' },
      });

      const { result: interestResult } = renderHook(() => useSaveInterest(), {
        wrapper: createWrapper(),
      });

      await interestResult.current.mutateAsync('find-job');
      expect(mockOnboardingApi.saveInterest).toHaveBeenCalledWith('find-job');

      // Step 2: Extract profile
      const mockProfile = {
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          headline: 'Engineer',
          experiences: [],
          education: [],
          skills: [],
        },
      };

      mockOnboardingApi.extractProfile.mockResolvedValue(mockProfile);

      const { result: extractResult } = renderHook(
        () => useExtractProfile(),
        {
          wrapper: createWrapper(),
        }
      );

      const profile = await extractResult.current.mutateAsync('johndoe');
      expect(profile).toEqual(mockProfile.profile);

      // Step 3: Save profile
      mockOnboardingApi.saveProfile.mockResolvedValue({ success: true });

      const { result: saveResult } = renderHook(() => useSaveProfile(), {
        wrapper: createWrapper(),
      });

      await saveResult.current.mutateAsync({
        username: 'johndoe',
        rawData: mockProfile.profile,
        filteredData: mockProfile.profile,
      });

      expect(mockOnboardingApi.saveProfile).toHaveBeenCalled();
    });
  });
});
