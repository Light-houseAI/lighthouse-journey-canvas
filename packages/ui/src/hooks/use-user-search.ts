import type { ApiErrorResponse, UserSearchResult } from '@journey/schema';
import { useQuery } from '@tanstack/react-query';

import { searchUsers } from '../services/user-api';
import { useDebounce } from './use-debounce';

interface UseUserSearchOptions {
  enabled?: boolean;
  debounceDelay?: number;
}

export interface UseUserSearchReturn {
  users: UserSearchResult[];
  error: ApiErrorResponse['error'] | null;
  isLoading: boolean;
  refetch: () => void;
  data: UserSearchResult[];
}

export function useUserSearch(
  query: string,
  options: UseUserSearchOptions = {}
): UseUserSearchReturn {
  const { enabled = true, debounceDelay = 300 } = options;

  // Debounce the search query
  const debouncedQuery = useDebounce(query, debounceDelay);

  const queryResult = useQuery({
    queryKey: ['users', 'search', debouncedQuery],
    queryFn: () => searchUsers(debouncedQuery),
    enabled: enabled && debouncedQuery.trim().length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: false, // Server handles errors
  });

  // Extract data (already unwrapped by http-client)
  const users = queryResult.data ?? [];
  const error = queryResult.error
    ? {
        code: 'SEARCH_ERROR',
        message:
          queryResult.error instanceof Error
            ? queryResult.error.message
            : 'User search failed',
      }
    : null;

  return {
    users,
    error,
    isLoading: queryResult.isLoading,
    refetch: queryResult.refetch,
    data: users, // Expose data property for compatibility
  };
}
