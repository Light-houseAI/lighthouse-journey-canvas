/**
 * TanStack Query hooks for onboarding operations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as onboardingApi from '../services/onboarding-api';
import { authKeys } from './useAuth';

/**
 * Hook to extract profile from LinkedIn username
 */
export function useExtractProfile() {
  const mutation = useMutation({
    mutationFn: (username: string) => onboardingApi.extractProfile(username),
    retry: false,
  });

  const response = mutation.data;

  return {
    mutate: mutation.mutate,
    mutateAsync: async (username: string) => {
      const response = await mutation.mutateAsync(username);
      return response.profile;
    },
    isPending: mutation.isPending,
    error: mutation.error,
    data: response?.profile,
  };
}

type InterestType =
  | 'find-job'
  | 'grow-career'
  | 'change-careers'
  | 'start-startup';

/**
 * Hook to save user's interest during onboarding
 */
export function useSaveInterest() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (interest: InterestType) =>
      onboardingApi.saveInterest(interest),
    onSuccess: () => {
      // Invalidate current user to refetch updated interest
      queryClient.invalidateQueries({ queryKey: authKeys.currentUser() });
    },
    retry: false,
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Hook to save profile data during onboarding
 */
export function useSaveProfile() {
  const mutation = useMutation({
    mutationFn: (data: onboardingApi.InsertProfile) =>
      onboardingApi.saveProfile(data),
    retry: false,
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Hook to complete onboarding process
 */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => onboardingApi.completeOnboarding(),
    onSuccess: () => {
      // Invalidate current user to refetch with hasCompletedOnboarding: true
      queryClient.invalidateQueries({ queryKey: authKeys.currentUser() });
    },
    retry: false,
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Hook to create a track from desktop app data
 * Used by the download screen mock button and the desktop app
 */
export function useCreateDesktopTrack() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (trackData: onboardingApi.DesktopTrackData) =>
      onboardingApi.createDesktopTrack(trackData),
    onSuccess: (data) => {
      // If onboarding was completed, invalidate current user to trigger navigation
      // Note: httpClient.post already unwraps the 'data' field from the response
      if (data.onboardingCompleted) {
        queryClient.invalidateQueries({ queryKey: authKeys.currentUser() });
      }
    },
    retry: false,
  });

  return {
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
}
