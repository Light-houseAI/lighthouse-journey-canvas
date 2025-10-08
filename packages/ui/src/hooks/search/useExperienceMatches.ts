/**
 * useExperienceMatches Hook (LIG-179)
 *
 * React hook for fetching and managing experience matches.
 * Integrates with TanStack Query for caching and state management.
 */

import type { TimelineNode } from '@journey/schema';
import { useQuery } from '@tanstack/react-query';

import type { GraphRAGSearchResponse } from '../../components/search/types/search.types';
import {
  canNodeHaveMatches,
  fetchExperienceMatches,
} from '../../services/experience-matches-api';
import { getStaleTime, matchQueryKeys } from './match-query-keys';

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
export function useExperienceMatches(
  node: TimelineNode
): UseExperienceMatchesResult {
  // Check if node is a current experience
  const isCurrentExperience = canNodeHaveMatches(node.type, node.meta?.endDate);

  // Only fetch if it's a current experience node
  const shouldFetch = isCurrentExperience;

  // Use TanStack Query for data fetching and caching
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: matchQueryKeys.detail(node.id),
    queryFn: () => fetchExperienceMatches(node.id),
    enabled: shouldFetch, // Only fetch for current experience nodes
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
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Calculate derived state
  const hasMatches = (data?.totalResults ?? 0) > 0;
  const matchCount = data?.totalResults ?? 0;
  const searchQuery = data?.query;

  // Determine if button should be shown
  // Show button only for current experiences with matches
  const shouldShowButton =
    isCurrentExperience && hasMatches && !isLoading && !error;

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
