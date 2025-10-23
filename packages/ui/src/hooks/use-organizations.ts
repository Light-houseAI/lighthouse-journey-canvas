/**
 * TanStack Query hooks for organization management
 * Uses server response format for error handling
 */

import {
  type ApiErrorResponse,
  Organization,
  OrganizationType,
} from '@journey/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createOrganization,
  getUserOrganizations,
  searchOrganizations,
} from '../services/organization-api';

/**
 * Query keys for organization-related queries
 */
export const organizationKeys = {
  all: ['organizations'] as const,
  user: () => [...organizationKeys.all, 'user'] as const,
  search: (query: string) =>
    [...organizationKeys.all, 'search', query] as const,
};

/**
 * Hook to fetch user's organizations with caching
 */
export function useUserOrganizations() {
  return useQuery({
    queryKey: organizationKeys.user(),
    queryFn: getUserOrganizations,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (formerly cacheTime)
    retry: false, // Server handles errors
  });
}

export interface UseSearchOrganizationsReturn {
  organizations: Organization[];
  error: ApiErrorResponse['error'] | null;
  isLoading: boolean;
  refetch: () => void;
  data: Organization[];
}

/**
 * Hook to search organizations with debouncing handled by the component
 */
export function useSearchOrganizations(
  query: string,
  enabled: boolean = true
): UseSearchOrganizationsReturn {
  const queryResult = useQuery({
    queryKey: organizationKeys.search(query),
    queryFn: () => searchOrganizations(query),
    enabled: enabled && query.trim().length >= 2,
    staleTime: 2 * 60 * 1000, // Consider search results fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // Keep search results in cache for 5 minutes
    retry: false, // Server handles errors
  });

  // Extract data (already unwrapped by http-client)
  const organizations = queryResult.data ?? [];
  const error = queryResult.error
    ? {
        code: 'SEARCH_ERROR',
        message:
          queryResult.error instanceof Error
            ? queryResult.error.message
            : 'Organization search failed',
      }
    : null;

  return {
    organizations,
    error,
    isLoading: queryResult.isLoading,
    refetch: queryResult.refetch,
    data: organizations, // Expose data property for compatibility
  };
}

interface UseCreateOrganizationReturn {
  mutate: (data: { name: string; type: OrganizationType }) => void;
  mutateAsync: (data: {
    name: string;
    type: OrganizationType;
  }) => Promise<Organization | null>;
  isPending: boolean;
  error: ApiErrorResponse['error'] | null;
}

/**
 * Hook to create a new organization
 */
export function useCreateOrganization(): UseCreateOrganizationReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: { name: string; type: OrganizationType }) =>
      createOrganization(data),
    onSuccess: (newOrganization) => {
      // Invalidate and refetch user organizations
      queryClient.invalidateQueries({ queryKey: organizationKeys.user() });

      // Optimistically update the cache
      queryClient.setQueryData<Organization[]>(
        organizationKeys.user(),
        (old) => (old ? [...old, newOrganization] : [newOrganization])
      );
    },
    retry: false, // Server handles errors
  });

  // Extract data (already unwrapped by http-client)
  const error = mutation.error
    ? {
        code: 'CREATE_ERROR',
        message:
          mutation.error instanceof Error
            ? mutation.error.message
            : 'Failed to create organization',
      }
    : null;

  return {
    mutate: mutation.mutate,
    mutateAsync: async (data) => {
      const newOrganization = await mutation.mutateAsync(data);
      return newOrganization;
    },
    isPending: mutation.isPending,
    error,
  };
}
