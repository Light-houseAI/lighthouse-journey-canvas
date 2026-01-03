/**
 * useAIUsageOverview Hook
 *
 * React Query hook for fetching and managing AI usage overview data.
 * Uses the hybrid graph RAG system to analyze AI tool usage patterns.
 */

import type { AIUsageOverviewResult } from '@journey/schema';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getAIUsageOverview, triggerAIUsageAnalysis } from '../services/workflow-api';

interface UseAIUsageOverviewOptions {
  lookbackDays?: number;
  limit?: number;
  enabled?: boolean;
}

/**
 * Hook to fetch AI usage overview for a node
 */
export function useAIUsageOverview(
  nodeId: string,
  options: UseAIUsageOverviewOptions = {}
) {
  const { lookbackDays = 30, limit = 10, enabled = true } = options;
  const queryClient = useQueryClient();

  // Query for fetching AI usage overview
  const query = useQuery<AIUsageOverviewResult | null>({
    queryKey: ['ai-usage-overview', nodeId, { lookbackDays, limit }],
    queryFn: () => getAIUsageOverview(nodeId, { lookbackDays, limit }),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    enabled: enabled && !!nodeId,
  });

  // Mutation for triggering new analysis
  const triggerMutation = useMutation({
    mutationFn: (opts?: { forceReanalysis?: boolean; lookbackDays?: number }) =>
      triggerAIUsageAnalysis(nodeId, {
        forceReanalysis: opts?.forceReanalysis ?? true,
        lookbackDays: opts?.lookbackDays ?? lookbackDays,
      }),
    onSuccess: (data) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({
        queryKey: ['ai-usage-overview', nodeId],
      });
      // Optionally set the data immediately
      if (data) {
        queryClient.setQueryData(
          ['ai-usage-overview', nodeId, { lookbackDays, limit }],
          data
        );
      }
    },
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    trigger: triggerMutation.mutateAsync,
    isTriggering: triggerMutation.isPending,
  };
}
