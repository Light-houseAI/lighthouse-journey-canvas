/**
 * TanStack Query hooks for organization management
 */

import { Organization, OrganizationType } from '@journey/schema';
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
  });
}

/**
 * Hook to search organizations with debouncing handled by the component
 */
export function useSearchOrganizations(query: string, enabled: boolean = true) {
  return useQuery({
    queryKey: organizationKeys.search(query),
    queryFn: () => searchOrganizations(query),
    enabled: enabled && query.trim().length >= 2,
    staleTime: 2 * 60 * 1000, // Consider search results fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // Keep search results in cache for 5 minutes
  });
}

/**
 * Hook to create a new organization
 */
export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; type: OrganizationType }) =>
      createOrganization(data),
    onSuccess: (newOrganization) => {
      // Invalidate and refetch user organizations
      queryClient.invalidateQueries({ queryKey: organizationKeys.user() });

      // Optionally: Optimistically update the cache
      queryClient.setQueryData<Organization[]>(
        organizationKeys.user(),
        (old) => (old ? [...old, newOrganization] : [newOrganization])
      );
    },
  });
}
