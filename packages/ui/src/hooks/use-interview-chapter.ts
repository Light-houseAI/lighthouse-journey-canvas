/**
 * TanStack Query hooks for interview chapter detail page
 */

import { useQuery } from '@tanstack/react-query';

import { hierarchyApi } from '../services/hierarchy-api';
import { getNodePermissions } from '../services/permission-api';

/**
 * Query keys for interview chapter queries
 */
export const interviewChapterKeys = {
  all: ['interview-chapter'] as const,
  application: (id: string) =>
    [...interviewChapterKeys.all, 'application', id] as const,
  permissions: (id: string) =>
    [...interviewChapterKeys.all, 'permissions', id] as const,
  allNodes: () => ['all-nodes'] as const,
};

/**
 * Hook to fetch application node data
 */
export function useApplicationNode(applicationId: string | undefined) {
  return useQuery({
    queryKey: interviewChapterKeys.application(applicationId || ''),
    queryFn: async () => {
      if (!applicationId) return null;
      return hierarchyApi.getNode(applicationId);
    },
    enabled: !!applicationId,
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

/**
 * Hook to fetch all nodes for sharing functionality
 */
export function useAllNodes() {
  return useQuery({
    queryKey: interviewChapterKeys.allNodes(),
    queryFn: async () => {
      return hierarchyApi.listNodes();
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

/**
 * Hook to fetch permissions for an application node
 * Only fetches if user is the owner
 */
export function useNodePermissions(
  applicationId: string | undefined,
  isOwner: boolean
) {
  return useQuery({
    queryKey: interviewChapterKeys.permissions(applicationId || ''),
    queryFn: async () => {
      if (!applicationId) return [];
      try {
        return await getNodePermissions(applicationId);
      } catch {
        // If we can't fetch permissions (e.g., not owner), return empty array
        return [];
      }
    },
    enabled: !!applicationId && isOwner,
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}
