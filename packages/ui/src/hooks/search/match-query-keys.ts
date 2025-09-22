/**
 * Match Query Keys Factory (LIG-179)
 *
 * Hierarchical query key factory for TanStack Query cache management.
 * Enables granular cache invalidation for experience matches.
 */

/**
 * Query key factory for experience matches
 * Follows TanStack Query best practices for hierarchical keys
 */
export const matchQueryKeys = {
  // Base key for all experience match queries
  all: ['experience-matches'] as const,

  // All list-type queries
  lists: () => [...matchQueryKeys.all, 'list'] as const,
  list: () => [...matchQueryKeys.all, 'list'] as const,

  // All detail-type queries
  details: () => [...matchQueryKeys.all, 'detail'] as const,

  // Specific node match query
  detail: (nodeId: string) => [...matchQueryKeys.all, 'detail', nodeId] as const,

  // Search query only (optional endpoint)
  searchQueries: () => [...matchQueryKeys.all, 'search-query'] as const,
  searchQuery: (nodeId: string) => [...matchQueryKeys.all, 'search-query', nodeId] as const,

  // Prefetch queries (for batch loading)
  prefetch: (nodeIds: string[]) => [...matchQueryKeys.all, 'prefetch', ...nodeIds] as const,
} as const;

/**
 * Helper to invalidate all match-related queries
 * Use when user data changes globally
 */
export function getInvalidateAllMatchesKey() {
  return matchQueryKeys.all;
}

/**
 * Helper to invalidate all detail queries
 * Use when match detection settings change
 */
export function getInvalidateDetailsKey() {
  return matchQueryKeys.details();
}

/**
 * Helper to invalidate a specific node's matches
 * Use when a node is updated
 */
export function getInvalidateNodeMatchesKey(nodeId: string) {
  return matchQueryKeys.detail(nodeId);
}

/**
 * Helper to check if a query key matches experience matches
 */
export function isMatchQueryKey(queryKey: readonly unknown[]): boolean {
  return Array.isArray(queryKey) && queryKey[0] === 'experience-matches';
}

/**
 * Helper to extract node ID from a detail query key
 */
export function extractNodeIdFromKey(queryKey: readonly unknown[]): string | null {
  if (
    Array.isArray(queryKey) &&
    queryKey[0] === 'experience-matches' &&
    queryKey[1] === 'detail' &&
    typeof queryKey[2] === 'string'
  ) {
    return queryKey[2];
  }
  return null;
}

/**
 * Create a query key for multiple nodes (useful for prefetching)
 */
export function createBatchQueryKey(nodeIds: string[]) {
  // Sort to ensure consistent key regardless of order
  const sortedIds = [...nodeIds].sort();
  return ['experience-matches', 'batch', ...sortedIds] as const;
}

/**
 * Helper to create stale time based on node update frequency
 * More recently updated nodes get shorter stale times
 */
export function getStaleTime(lastUpdated?: string): number {
  const DEFAULT_STALE_TIME = 5 * 60 * 1000; // 5 minutes

  if (!lastUpdated) {
    return DEFAULT_STALE_TIME;
  }

  try {
    const updatedDate = new Date(lastUpdated);
    const now = new Date();
    const hoursSinceUpdate = (now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60);

    // If updated within last hour, use shorter stale time
    if (hoursSinceUpdate < 1) {
      return 1 * 60 * 1000; // 1 minute
    }

    // If updated within last day, use medium stale time
    if (hoursSinceUpdate < 24) {
      return 3 * 60 * 1000; // 3 minutes
    }

    // Otherwise use default
    return DEFAULT_STALE_TIME;
  } catch {
    return DEFAULT_STALE_TIME;
  }
}