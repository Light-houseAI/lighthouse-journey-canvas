/**
 * usePermissions Hook
 *
 * TanStack Query hooks for permission data management
 * Separates server state from UI state for better testing and architecture
 */

import { useQuery } from '@tanstack/react-query';
import { getBulkNodePermissions } from '@/services/permission-api';
import { getUserOrganizations } from '@/services/organization-api';

// Query key factory for consistent cache management
export const permissionKeys = {
  all: ['permissions'] as const,
  bulk: (nodeIds: string[]) => ['permissions', 'bulk', nodeIds.sort()] as const,
  userOrgs: ['permissions', 'user-organizations'] as const,
};

/**
 * Hook to fetch bulk permissions for multiple nodes
 */
export function useBulkNodePermissions(nodeIds: string[]) {
  return useQuery({
    queryKey: permissionKeys.bulk(nodeIds),
    queryFn: () => getBulkNodePermissions(nodeIds),
    enabled: nodeIds.length > 0,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch user's organizations
 */
export function useUserOrganizations() {
  return useQuery({
    queryKey: permissionKeys.userOrgs,
    queryFn: () => getUserOrganizations(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
