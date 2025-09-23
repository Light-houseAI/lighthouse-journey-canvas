/**
 * useExperienceMatches Hook (LIG-179)
 *
 * React hook for fetching and managing experience matches.
 * Integrates with TanStack Query for caching and state management.
 */

import { useQuery } from '@tanstack/react-query';
import type { TimelineNode } from '@journey/schema';
import type { GraphRAGSearchResponse } from '../../components/search/types/search.types';
import { fetchExperienceMatches, canNodeHaveMatches } from '../../services/experience-matches-api';
import { matchQueryKeys, getStaleTime } from './match-query-keys';

export interface UseExperienceMatchesResult {
  data: GraphRAGSearchResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  hasMatches: boolean;
  matchCount: number;
  searchQuery: string | undefined;
  isCurrentExperience: boolean;
  shouldShowButton: boolean;
  refetch: () => void;
}

/**
 * Hook to fetch and manage experience matches for a timeline node
 */
export function useExperienceMatches(node: TimelineNode): UseExperienceMatchesResult {
  // Check if node is a current experience
  const isCurrentExperience = canNodeHaveMatches(node.type, node.meta?.endDate);

  // Only fetch if it's a current experience node
  const shouldFetch = isCurrentExperience;

  // Use TanStack Query for data fetching and caching
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: matchQueryKeys.detail(node.id),
    queryFn: () => fetchExperienceMatches(node.id),
    enabled: shouldFetch,
    staleTime: getStaleTime(node.updatedAt),
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors (client errors)
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (
          message.includes('not found') ||
          message.includes('authentication') ||
          message.includes('access denied') ||
          message.includes('not an experience')
        ) {
          return false;
        }
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Calculate derived state
  const hasMatches = (data?.totalResults ?? 0) > 0;
  const matchCount = data?.totalResults ?? 0;
  const searchQuery = data?.query;

  // Determine if button should be shown
  // Show button only for current experiences with matches
  const shouldShowButton = isCurrentExperience && hasMatches && !isLoading && !error;

  return {
    data,
    isLoading,
    error: error as Error | null,
    hasMatches,
    matchCount,
    searchQuery,
    isCurrentExperience,
    shouldShowButton,
    refetch,
  };
}

/**
 * Hook to prefetch matches for multiple nodes
 * Useful for preloading when timeline loads
 */
export function usePrefetchMatches(nodes: TimelineNode[]) {
  // Filter to only current experience nodes
  const experienceNodes = nodes.filter(node => canNodeHaveMatches(node.type, node.meta?.endDate));

  return useQuery({
    queryKey: matchQueryKeys.prefetch(experienceNodes.map(n => n.id)),
    queryFn: async () => {
      const results = new Map<string, GraphRAGSearchResponse>();

      // Fetch in parallel
      await Promise.all(
        experienceNodes.map(async node => {
          try {
            const data = await fetchExperienceMatches(node.id);
            results.set(node.id, data);
          } catch (error) {
            console.warn(`Failed to prefetch matches for node ${node.id}:`, error);
          }
        })
      );

      return results;
    },
    enabled: experienceNodes.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to get just the search query for a node
 * Lighter weight alternative when full match data isn't needed
 */
export function useSearchQuery(nodeId: string, enabled = true) {
  return useQuery({
    queryKey: matchQueryKeys.searchQuery(nodeId),
    queryFn: async () => {
      const response = await fetch(`/api/v2/experience/${nodeId}/search-query`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch search query');
      }

      const data = await response.json();
      return data.data?.searchQuery as string;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}