/**
 * TanStack Query hook for fetching node sessions
 * (LIG-247: Desktop Session to Work Track Mapping)
 *
 * Fetches desktop sessions mapped to a specific timeline node.
 * Sessions represent work activities pushed from the desktop app.
 */

import { useQuery } from '@tanstack/react-query';
import type { NodeSessionsResponse } from '@journey/schema';

import { getNodeSessions, type NodeSessionsOptions } from '../services/session-api';

// Query key factory for sessions
export const sessionKeys = {
  all: ['sessions'] as const,
  byNode: (nodeId: string) => ['sessions', 'node', nodeId] as const,
  byNodePaginated: (nodeId: string, page: number, limit: number) =>
    ['sessions', 'node', nodeId, { page, limit }] as const,
};

/**
 * Hook to fetch sessions for a specific node
 * 
 * @param nodeId - The timeline node ID to fetch sessions for
 * @param options - Pagination options (page, limit)
 * @param enabled - Whether to enable the query (useful for lazy loading)
 */
export function useNodeSessions(
  nodeId: string,
  options: NodeSessionsOptions = {},
  enabled = true
) {
  const { page = 1, limit = 10 } = options;

  return useQuery({
    queryKey: sessionKeys.byNodePaginated(nodeId, page, limit),
    queryFn: () => getNodeSessions(nodeId, { page, limit }),
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    enabled: enabled && !!nodeId, // Only fetch if enabled and nodeId exists
  });
}

/**
 * Type for the sessions response data
 */
export type NodeSessionsData = NodeSessionsResponse['data'];
