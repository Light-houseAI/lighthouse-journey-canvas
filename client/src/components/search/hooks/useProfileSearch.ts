/**
 * useProfileSearch Hook
 * 
 * TanStack Query hook for GraphRAG profile search with debouncing and caching
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { searchProfiles } from '@/services/graphrag-api';
import type { 
  UseProfileSearchReturn, 
  ProfileResult,
  SearchError 
} from '../types/search.types';

// Query key factory for consistent cache management
const createSearchQueryKey = (query: string) => ['graphrag-search', query.trim().toLowerCase()];

// Debounce delay in milliseconds (300ms as per PRD)
const DEBOUNCE_DELAY = 300;

export function useProfileSearch(): UseProfileSearchReturn {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const queryClient = useQueryClient();

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(timer);
  }, [query]);

  // TanStack Query for the actual search
  const {
    data: results = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: createSearchQueryKey(debouncedQuery),
    queryFn: () => searchProfiles(debouncedQuery),
    enabled: debouncedQuery.trim().length > 0, // Only search if query is not empty
    staleTime: 5 * 60 * 1000, // 5 minutes cache as per PRD
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
    retry: (failureCount, error) => {
      // Only retry on network errors, not on user input errors
      if (error instanceof Error && error.message.includes('temporarily unavailable')) {
        return failureCount < 2;
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000), // Exponential backoff
  });

  // Search function with query validation
  const search = useCallback((searchQuery: string) => {
    // Validate query length
    if (searchQuery.length > 500) {
      return;
    }
    setQuery(searchQuery);
  }, []);

  // Clear function to reset search state
  const clear = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    
    // Clear all cached search results
    queryClient.removeQueries({
      queryKey: ['graphrag-search'],
      exact: false
    });
  }, [queryClient]);

  return {
    search,
    results,
    isLoading: isLoading && debouncedQuery.trim().length > 0,
    error: error as Error | null,
    clear,
    query
  };
}