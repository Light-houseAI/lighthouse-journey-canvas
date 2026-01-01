/**
 * useTopWorkflows Hook
 *
 * React Query hook for fetching and managing top workflow patterns data
 * Uses hybrid search (Graph RAG + semantic + BM25) to identify common patterns
 */

import type { TopWorkflowsResult, GetTopWorkflowsRequest } from '@journey/schema';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getTopWorkflows, getTopWorkflowsForNode } from '../services/workflow-api';

interface UseTopWorkflowsOptions {
  nodeId?: string;
  limit?: number;
  minOccurrences?: number;
  lookbackDays?: number;
  includeGraphRAG?: boolean;
  enabled?: boolean;
}

/**
 * Hook to fetch top workflow patterns
 * Can be used for all nodes or a specific node
 */
export function useTopWorkflows(options: UseTopWorkflowsOptions = {}) {
  const queryClient = useQueryClient();
  const {
    nodeId,
    limit = 5,
    minOccurrences = 2,
    lookbackDays = 30,
    includeGraphRAG = true,
    enabled = true,
  } = options;

  // Query key includes all params to enable proper caching
  const queryKey = ['top-workflows', nodeId, limit, minOccurrences, lookbackDays, includeGraphRAG];

  // Query for fetching top workflows
  const query = useQuery<TopWorkflowsResult | null>({
    queryKey,
    queryFn: async () => {
      const params: Partial<GetTopWorkflowsRequest> = {
        limit,
        minOccurrences,
        lookbackDays,
        includeGraphRAG,
      };

      if (nodeId) {
        return getTopWorkflowsForNode(nodeId, params);
      }
      return getTopWorkflows(params);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: 1,
    enabled,
  });

  // Mutation for triggering a refresh with different parameters
  const refreshMutation = useMutation({
    mutationFn: async (newParams?: Partial<GetTopWorkflowsRequest>) => {
      const params: Partial<GetTopWorkflowsRequest> = {
        limit: newParams?.limit ?? limit,
        minOccurrences: newParams?.minOccurrences ?? minOccurrences,
        lookbackDays: newParams?.lookbackDays ?? lookbackDays,
        includeGraphRAG: newParams?.includeGraphRAG ?? includeGraphRAG,
      };

      if (nodeId) {
        return getTopWorkflowsForNode(nodeId, params);
      }
      return getTopWorkflows(params);
    },
    onSuccess: (data) => {
      // Update the cache with new data
      queryClient.setQueryData(queryKey, data);
    },
  });

  return {
    data: query.data,
    patterns: query.data?.patterns || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    refresh: refreshMutation.mutateAsync,
    isRefreshing: refreshMutation.isPending,
    // Computed properties
    hasPatterns: (query.data?.patterns?.length || 0) > 0,
    totalScreenshots: query.data?.totalScreenshotsAnalyzed || 0,
    searchStrategy: query.data?.searchStrategy,
  };
}
