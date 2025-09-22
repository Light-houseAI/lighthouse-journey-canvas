import { useQuery } from '@tanstack/react-query';
import { useDebounce } from './use-debounce';
import { searchUsers, UserSearchResult } from '../services/user-api';

interface UseUserSearchOptions {
  enabled?: boolean;
  debounceDelay?: number;
}

export function useUserSearch(
  query: string,
  options: UseUserSearchOptions = {}
) {
  const { enabled = true, debounceDelay = 300 } = options;

  // Debounce the search query
  const debouncedQuery = useDebounce(query, debounceDelay);

  return useQuery<UserSearchResult[], Error>({
    queryKey: ['users', 'search', debouncedQuery],
    queryFn: () => searchUsers(debouncedQuery),
    enabled: enabled && debouncedQuery.trim().length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    retryDelay: 1000,
  });
}
