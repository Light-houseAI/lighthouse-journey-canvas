/**
 * useCrossSessionContext Hook
 *
 * React Query hook for fetching cross-session Graph RAG context
 */

import type {
  CrossSessionContextResponse,
  GetCrossSessionContextQuery,
} from '@journey/schema';
import { useQuery } from '@tanstack/react-query';

import { getCrossSessionContext } from '../services/workflow-api';

interface UseCrossSessionContextOptions extends Partial<GetCrossSessionContextQuery> {
  enabled?: boolean;
}

/**
 * Hook to fetch cross-session context from Graph RAG
 * Shows entities, concepts, patterns from previous sessions
 */
export function useCrossSessionContext(
  nodeId: string | undefined,
  options?: UseCrossSessionContextOptions
) {
  const { enabled = true, ...queryParams } = options || {};

  const query = useQuery<CrossSessionContextResponse>({
    queryKey: ['cross-session-context', nodeId, queryParams],
    queryFn: () => {
      if (!nodeId) throw new Error('Node ID is required');
      return getCrossSessionContext(nodeId, queryParams as GetCrossSessionContextQuery);
    },
    enabled: enabled && !!nodeId,
    staleTime: 2 * 60 * 1000, // 2 minutes - cross-session data changes less frequently
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    // Computed flags for easier UI logic
    hasEntities: (query.data?.entities?.length ?? 0) > 0,
    hasConcepts: (query.data?.concepts?.length ?? 0) > 0,
    hasPatterns: (query.data?.workflowPatterns?.length ?? 0) > 0,
    hasRelatedSessions: (query.data?.relatedSessions?.length ?? 0) > 0,
    isEmpty:
      !query.isLoading &&
      !query.error &&
      (query.data?.entities?.length ?? 0) === 0 &&
      (query.data?.concepts?.length ?? 0) === 0 &&
      (query.data?.workflowPatterns?.length ?? 0) === 0,
  };
}
