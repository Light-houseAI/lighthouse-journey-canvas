/**
 * useOrganizations Hook
 *
 * TanStack Query hooks for organization data
 */

import { useQuery } from '@tanstack/react-query';

import {
  getAllOrganizations,
  getOrganizationsByIds,
} from '../services/organization-api';

// Query key factory for consistent cache management
export const organizationKeys = {
  all: ['organizations'] as const,
  byIds: (ids: number[]) => ['organizations', 'byIds', ids.sort()] as const,
};

/**
 * Hook to fetch all available organizations
 */
export function useGetAllOrganizations() {
  return useQuery({
    queryKey: organizationKeys.all,
    queryFn: getAllOrganizations,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to fetch organizations by IDs
 */
export function useGetOrganizationsByIds(orgIds: number[]) {
  return useQuery({
    queryKey: organizationKeys.byIds(orgIds),
    queryFn: () => getOrganizationsByIds(orgIds),
    enabled: orgIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
