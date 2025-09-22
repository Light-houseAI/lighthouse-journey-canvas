/**
 * useSearchPageQuery Hook
 *
 * Manages URL query parameters for search page following wouter patterns
 * Pattern from user-timeline.tsx using useLocation for navigation
 */

import { useCallback, useMemo } from 'react';
import { useLocation } from 'wouter';

export interface UseSearchPageQueryReturn {
  query: string;
  setQuery: (query: string) => void;
}

export function useSearchPageQuery(): UseSearchPageQueryReturn {
  const [location, setLocation] = useLocation();

  // Extract query from URL parameters
  const query = useMemo(() => {
    if (typeof window === 'undefined') return '';

    const urlParams = new URLSearchParams(window.location.search);
    const q = urlParams.get('q');
    return q ? decodeURIComponent(q) : '';
  }, [location]);

  // Update URL when query changes
  const setQuery = useCallback((newQuery: string) => {
    if (newQuery.trim() === '') {
      setLocation('/search');
    } else {
      const encodedQuery = encodeURIComponent(newQuery);
      setLocation(`/search?q=${encodedQuery}`);
    }
  }, [setLocation]);

  return {
    query,
    setQuery,
  };
}