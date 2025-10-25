/**
 * TanStack Query hooks for application materials
 */

import { ApplicationMaterials, ResumeVersion } from '@journey/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  applicationMaterialsKeys,
  hierarchyApi,
} from '../services/hierarchy-api';

/**
 * Hook to fetch application materials for a career transition node
 */
export function useApplicationMaterials(
  careerTransitionId: string | undefined
) {
  return useQuery({
    queryKey: applicationMaterialsKeys.materials(careerTransitionId || ''),
    queryFn: async () => {
      if (!careerTransitionId) return null;
      return hierarchyApi.getApplicationMaterials(careerTransitionId);
    },
    enabled: !!careerTransitionId,
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

/**
 * Hook to update application materials
 * Includes optimistic updates and cache invalidation
 * Supports partial updates - merges with existing data
 */
export function useUpdateApplicationMaterials(careerTransitionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (partialMaterials: Partial<ApplicationMaterials>) => {
      // Get current data from cache
      const currentMaterials = queryClient.getQueryData<ApplicationMaterials>(
        applicationMaterialsKeys.materials(careerTransitionId)
      );

      // Merge partial update with current data
      const mergedMaterials: ApplicationMaterials = {
        items:
          partialMaterials.items !== undefined
            ? partialMaterials.items
            : currentMaterials?.items || [],
        summary:
          partialMaterials.summary !== undefined
            ? partialMaterials.summary
            : currentMaterials?.summary,
      };

      return hierarchyApi.updateApplicationMaterials(
        careerTransitionId,
        mergedMaterials
      );
    },
    onMutate: async (partialMaterials) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({
        queryKey: applicationMaterialsKeys.materials(careerTransitionId),
      });

      // Snapshot previous value
      const previousMaterials = queryClient.getQueryData<ApplicationMaterials>(
        applicationMaterialsKeys.materials(careerTransitionId)
      );

      // Merge partial update with current data for optimistic update
      const mergedMaterials: ApplicationMaterials = {
        items:
          partialMaterials.items !== undefined
            ? partialMaterials.items
            : previousMaterials?.items || [],
        summary:
          partialMaterials.summary !== undefined
            ? partialMaterials.summary
            : previousMaterials?.summary,
      };

      // Optimistically update to the merged value
      queryClient.setQueryData(
        applicationMaterialsKeys.materials(careerTransitionId),
        mergedMaterials
      );

      // Return context with the snapshot
      return { previousMaterials };
    },
    onError: (_err, _materials, context) => {
      // Rollback on error
      if (context?.previousMaterials) {
        queryClient.setQueryData(
          applicationMaterialsKeys.materials(careerTransitionId),
          context.previousMaterials
        );
      }
    },
    onSettled: () => {
      // Always refetch after success or error to ensure consistency
      queryClient.invalidateQueries({
        queryKey: applicationMaterialsKeys.materials(careerTransitionId),
      });
      // Also invalidate the node query to update the full node data
      queryClient.invalidateQueries({
        queryKey: ['career-transition-node', careerTransitionId],
      });
    },
  });
}

/**
 * Hook to update a single resume entry
 */
export function useUpdateResumeEntry(careerTransitionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      resumeType,
      resumeVersion,
    }: {
      resumeType: string;
      resumeVersion: ResumeVersion;
    }) => {
      return hierarchyApi.updateResumeEntry(
        careerTransitionId,
        resumeType,
        resumeVersion
      );
    },
    onSuccess: () => {
      // Invalidate queries on success
      queryClient.invalidateQueries({
        queryKey: applicationMaterialsKeys.materials(careerTransitionId),
      });
      queryClient.invalidateQueries({
        queryKey: ['career-transition-node', careerTransitionId],
      });
    },
  });
}

/**
 * Hook to remove a resume entry
 */
export function useRemoveResumeEntry(careerTransitionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (resumeType: string) => {
      return hierarchyApi.removeResumeEntry(careerTransitionId, resumeType);
    },
    onSuccess: () => {
      // Invalidate queries on success
      queryClient.invalidateQueries({
        queryKey: applicationMaterialsKeys.materials(careerTransitionId),
      });
      queryClient.invalidateQueries({
        queryKey: ['career-transition-node', careerTransitionId],
      });
    },
  });
}

/**
 * Hook to get the career transition node
 * Useful for checking permissions and accessing full node data
 */
export function useCareerTransitionNode(
  careerTransitionId: string | undefined
) {
  return useQuery({
    queryKey: ['career-transition-node', careerTransitionId || ''],
    queryFn: async () => {
      if (!careerTransitionId) return null;
      return hierarchyApi.getNode(careerTransitionId);
    },
    enabled: !!careerTransitionId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
