/**
 * useExperienceMatches Hook (LIG-179)
 *
 * React hook for fetching and managing experience matches.
 * Integrates with TanStack Query for caching and state management.
 * Uses server response format for graceful error handling.
 */

import type { ApiErrorResponse, TimelineNode } from '@journey/schema';
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
  error: ApiErrorResponse['error'] | null;
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
  node: TimelineNode,
  manualTrigger: boolean = false
): UseExperienceMatchesResult {
  // Check if node is a current experience (LIG-206: now supports job applications)
  const isCurrentExperience = canNodeHaveMatches(
    node.type,
    node.meta?.endDate,
    node.meta
  );

  // Only fetch if it's a current experience node AND manual trigger is enabled
  const shouldFetch = isCurrentExperience && manualTrigger;

  // Use TanStack Query for data fetching and caching
  const queryResult = useQuery({
    queryKey: matchQueryKeys.detail(node.id),
    queryFn: () => fetchExperienceMatches(node.id),
    enabled: shouldFetch, // Only fetch when manually triggered
    staleTime: getStaleTime(node.updatedAt),
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
    retry: false, // Server handles errors
  });

  // Extract data (already unwrapped by http-client)
  const matchData = queryResult.data;
  const error = queryResult.error
    ? {
        code: 'FETCH_ERROR',
        message:
          queryResult.error instanceof Error
            ? queryResult.error.message
            : 'Failed to fetch matches',
      }
    : null;

  // Calculate derived state
  const hasMatches = (matchData?.totalResults ?? 0) > 0;
  const matchCount = matchData?.totalResults ?? 0;
  const searchQuery = matchData?.query;

  // Determine if button should be shown
  // Show button only for current experiences with matches
  const shouldShowButton =
    isCurrentExperience && hasMatches && !queryResult.isLoading && !error;

  return {
    data: matchData,
    isLoading: queryResult.isLoading,
    error,
    hasMatches,
    matchCount,
    searchQuery,
    isCurrentExperience,
    shouldShowButton,
    refetch: queryResult.refetch,
  };
}
