/**
 * useSearchResults Hook
 *
 * TanStack Query hook for GraphRAG profile search WITHOUT debouncing
 * Modified version of useProfileSearch for search results page
 */

import { useQuery } from '@tanstack/react-query';

import { searchProfiles } from '../../services/graphrag-api';

import type { ProfileResult } from '../types/search.types';

// Query key factory for consistent cache management (same as useProfileSearch)
const createSearchQueryKey = (query: string) => ['search-results', query.trim().toLowerCase()];

export interface UseSearchResultsReturn {
  results: ProfileResult[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useSearchResults(query: string): UseSearchResultsReturn {

  
  // TanStack Query for the actual search (no debouncing)
  const {
    data: results = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: createSearchQueryKey(query),
    queryFn: () => searchProfiles(query, { limit: 50 }), // Increased limit for full page
    enabled: query.trim().length > 0 && query.length <= 500, // Only search if valid query
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

  return {
    results,
    isLoading: isLoading && query.trim().length > 0,
    error: error as Error | null,
    refetch,
  };
}