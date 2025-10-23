/**
 * useSearchResults Hook
 *
 * TanStack Query hook for GraphRAG profile search WITHOUT debouncing
 * Modified version of useProfileSearch for search results page
 * Uses server response format for graceful error handling
 */

import type { ApiErrorResponse } from '@journey/schema';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import type { ProfileResult } from '../../components/search/types/search.types';
import { searchProfiles } from '../../services/graphrag-api';
import { useSearchStore } from '../../stores/search-store';

// Query key factory for consistent cache management (same as useProfileSearch)
const createSearchQueryKey = (query: string) => [
  'search-results',
  query.trim().toLowerCase(),
];

export interface UseSearchResultsReturn {
  results: ProfileResult[];
  isLoading: boolean;
  error: ApiErrorResponse['error'] | null;
  refetch: () => void;
}

export function useSearchResults(query: string): UseSearchResultsReturn {
  const { preloadedMatchData, clearPreloadedData } = useSearchStore();

  // Use preloaded match data directly (already in GraphRAGSearchResponse format)
  const preloadedResults = useMemo(() => {
    if (!preloadedMatchData?.results) return null;
    return preloadedMatchData.results;
  }, [preloadedMatchData]);

  // Check if we should use preloaded data
  const shouldUsePreloaded =
    preloadedResults && preloadedMatchData?.query === query;

  // Clear preloaded data when query changes
  useEffect(() => {
    if (preloadedMatchData && preloadedMatchData.query !== query) {
      clearPreloadedData();
    }
  }, [query, preloadedMatchData, clearPreloadedData]);

  // TanStack Query for the actual search (no debouncing)
  const queryResult = useQuery({
    queryKey: createSearchQueryKey(query),
    queryFn: () => searchProfiles(query, { limit: 50 }), // Increased limit for full page
    enabled:
      query.trim().length > 0 && query.length <= 500 && !shouldUsePreloaded, // Don't search if using preloaded
    staleTime: 5 * 60 * 1000, // 5 minutes cache (same as useProfileSearch)
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
    retry: false, // Server handles errors
  });

  // Extract data (already unwrapped by http-client)
  const searchResults = queryResult.data ?? [];
  const error = queryResult.error
    ? {
        code: 'SEARCH_ERROR',
        message:
          queryResult.error instanceof Error
            ? queryResult.error.message
            : 'Search failed',
      }
    : null;

  // Use preloaded results if available, otherwise use search results
  const results = shouldUsePreloaded ? preloadedResults! : searchResults;
  const isLoading = shouldUsePreloaded ? false : queryResult.isLoading;

  return {
    results,
    isLoading: isLoading && query.trim().length > 0,
    error,
    refetch: queryResult.refetch,
  };
}
