/**
 * TanStack Query hook for fetching node insights
 *
 * This hook fetches insights for a specific timeline node using TanStack Query,
 * following the pattern of server state management separate from client state.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  NodeInsight,
  InsightCreateDTO,
  InsightUpdateDTO,
} from '@shared/schema';

import { httpClient } from '../services/http-client';

// Query key factory for insights
const insightsKeys = {
  all: ['insights'] as const,
  byNode: (nodeId: string) => ['insights', 'node', nodeId] as const,
  byId: (insightId: string) => ['insights', 'id', insightId] as const,
};

/**
 * Hook to fetch insights for a specific node
 */
export const useNodeInsights = (nodeId: string, enabled = true) => {
  return useQuery({
    queryKey: insightsKeys.byNode(nodeId),
    queryFn: async () => {
      const data = await httpClient.get<NodeInsight[]>(
        `/api/v2/timeline/nodes/${nodeId}/insights`
      );
      return data;
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    enabled: enabled && !!nodeId, // Only fetch if enabled and nodeId exists
  });
};

/**
 * Hook to create a new insight
 */
export const useCreateInsight = (nodeId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InsightCreateDTO) => {
      const result = await httpClient.post<NodeInsight>(
        `/api/v2/timeline/nodes/${nodeId}/insights`,
        data
      );
      return result;
    },
    onSuccess: (newInsight) => {
      // Optimistically update the cache
      queryClient.setQueryData<NodeInsight[]>(
        insightsKeys.byNode(nodeId),
        (old = []) => [...old, newInsight]
      );
      // Invalidate to refetch
      queryClient.invalidateQueries({ queryKey: insightsKeys.byNode(nodeId) });
    },
  });
};

/**
 * Hook to update an existing insight
 */
export const useUpdateInsight = (nodeId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      insightId,
      data,
    }: {
      insightId: string;
      data: InsightUpdateDTO;
    }) => {
      const result = await httpClient.put<NodeInsight>(
        `/api/v2/timeline/insights/${insightId}`,
        data
      );
      return result;
    },
    onSuccess: (updatedInsight, variables) => {
      // Update cache
      queryClient.setQueryData<NodeInsight[]>(
        insightsKeys.byNode(nodeId),
        (old = []) =>
          old.map((insight) =>
            insight.id === variables.insightId ? updatedInsight : insight
          )
      );
      // Invalidate to refetch
      queryClient.invalidateQueries({ queryKey: insightsKeys.byNode(nodeId) });
    },
  });
};

/**
 * Hook to delete an insight
 */
export const useDeleteInsight = (nodeId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (insightId: string) => {
      await httpClient.delete(`/api/v2/timeline/insights/${insightId}`);
      return insightId;
    },
    onSuccess: (deletedId) => {
      // Update cache
      queryClient.setQueryData<NodeInsight[]>(
        insightsKeys.byNode(nodeId),
        (old = []) => old.filter((insight) => insight.id !== deletedId)
      );
      // Invalidate to refetch
      queryClient.invalidateQueries({ queryKey: insightsKeys.byNode(nodeId) });
    },
  });
};
