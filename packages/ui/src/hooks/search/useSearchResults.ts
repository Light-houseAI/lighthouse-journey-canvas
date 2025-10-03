/**
 * useSearchResults Hook
 *
 * TanStack Query hook for GraphRAG profile search WITHOUT debouncing
 * Modified version of useProfileSearch for search results page
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { searchProfiles } from '../../services/graphrag-api';
import type { ProfileResult } from '../../components/search/types/search.types';
import { useSearchStore } from '../../stores/search-store';

// Query key factory for consistent cache management (same as useProfileSearch)
const createSearchQueryKey = (query: string) => ['search-results', query.trim().toLowerCase()];

export interface UseSearchResultsReturn {
  results: ProfileResult[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useSearchResults(query: string): UseSearchResultsReturn {
  const { preloadedMatchData, clearPreloadedData } = useSearchStore();

  // Use preloaded match data directly (already in GraphRAGSearchResponse format)
  const preloadedResults = useMemo(() => {
    if (!preloadedMatchData?.profiles) return null;
    return preloadedMatchData.profiles;
  }, [preloadedMatchData]);

  // Check if we should use preloaded data
  const shouldUsePreloaded = preloadedResults &&
    preloadedMatchData?.query === query;

  // Clear preloaded data when query changes
  useEffect(() => {
    if (preloadedMatchData && preloadedMatchData.query !== query) {
      clearPreloadedData();
    }
  }, [query, preloadedMatchData, clearPreloadedData]);

  // TanStack Query for the actual search (no debouncing)
  const {
    data: searchResults = [],
    isLoading: searchLoading,
    error,
    refetch
  } = useQuery({
    queryKey: createSearchQueryKey(query),
    queryFn: () => searchProfiles(query, { limit: 50 }), // Increased limit for full page
    enabled: query.trim().length > 0 && query.length <= 500 && !shouldUsePreloaded, // Don't search if using preloaded
    staleTime: 5 * 60 * 1000, // 5 minutes cache (same as useProfileSearch)
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
    retry: (failureCount, error) => {
      // Only retry on network errors, not on user input errors (same logic)
      if (error instanceof Error && error.message.includes('temporarily unavailable')) {
        return failureCount < 2;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000), // Exponential backoff
  });

  // Use preloaded results if available, otherwise use search results
  const results = shouldUsePreloaded ? preloadedResults! : searchResults;
  const isLoading = shouldUsePreloaded ? false : searchLoading;

  return {
    results,
    isLoading: isLoading && query.trim().length > 0,
    error: error as Error | null,
    refetch,
  };
}