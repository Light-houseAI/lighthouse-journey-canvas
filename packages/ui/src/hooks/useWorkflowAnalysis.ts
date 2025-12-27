/**
 * useWorkflowAnalysis Hook
 *
 * React Query hook for fetching and managing workflow analysis data
 */

import type { WorkflowAnalysisResult } from '@journey/schema';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getWorkflowAnalysis, triggerWorkflowAnalysis } from '../services/workflow-api';

/**
 * Hook to fetch workflow analysis for a node
 */
export function useWorkflowAnalysis(nodeId: string) {
  const queryClient = useQueryClient();

  // Query for fetching analysis
  const query = useQuery<WorkflowAnalysisResult | null>({
    queryKey: ['workflow-analysis', nodeId],
    queryFn: () => getWorkflowAnalysis(nodeId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: 1,
  });

  // Mutation for triggering new analysis
  const triggerMutation = useMutation({
    mutationFn: () => triggerWorkflowAnalysis(nodeId),
    onSuccess: (data) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['workflow-analysis', nodeId] });
      // Optionally set the data immediately
      if (data) {
        queryClient.setQueryData(['workflow-analysis', nodeId], data);
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
