/**
 * usePersonaSuggestions Hook
 *
 * TanStack Query hook for fetching persona-based query suggestions.
 * Returns suggestions as buttons that users can click to quickly ask relevant questions.
 */

import { useQuery } from '@tanstack/react-query';
import {
  getPersonaSuggestions,
  type PersonaSuggestion,
  type PersonaSummary,
  type PersonaType,
} from '../services/insight-assistant-api';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const personaSuggestionKeys = {
  all: ['persona-suggestions'] as const,
  list: (options?: { limit?: number; personaTypes?: PersonaType[] }) =>
    [...personaSuggestionKeys.all, 'list', options] as const,
};

// ============================================================================
// TYPES
// ============================================================================

export interface UsePersonaSuggestionsOptions {
  /** Maximum number of suggestions to fetch (default: 4) */
  limit?: number;
  /** Filter by specific persona types */
  personaTypes?: PersonaType[];
  /** Whether the query is enabled (default: true) */
  enabled?: boolean;
  /** Stale time in milliseconds (default: 5 minutes) */
  staleTime?: number;
}

export interface UsePersonaSuggestionsResult {
  /** List of persona-based query suggestions */
  suggestions: PersonaSuggestion[];
  /** User's active personas */
  activePersonas: PersonaSummary[];
  /** Whether the query is loading */
  isLoading: boolean;
  /** Whether the query is fetching (including background refetch) */
  isFetching: boolean;
  /** Error if the query failed */
  error: Error | null;
  /** Refetch the suggestions */
  refetch: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook to fetch persona-based query suggestions
 *
 * @example
 * ```tsx
 * const { suggestions, isLoading } = usePersonaSuggestions({ limit: 4 });
 *
 * return (
 *   <div className="flex gap-2">
 *     {suggestions.map(s => (
 *       <button key={s.id} onClick={() => onSelectSuggestion(s.suggestedQuery)}>
 *         {s.buttonLabel}
 *       </button>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function usePersonaSuggestions(
  options?: UsePersonaSuggestionsOptions
): UsePersonaSuggestionsResult {
  const { limit = 4, personaTypes, enabled = true, staleTime = 5 * 60 * 1000 } = options ?? {};

  const query = useQuery({
    queryKey: personaSuggestionKeys.list({ limit, personaTypes }),
    queryFn: () => getPersonaSuggestions({ limit, personaTypes }),
    enabled,
    staleTime,
    // Retry once on failure
    retry: 1,
    // Don't refetch on window focus for suggestions
    refetchOnWindowFocus: false,
  });

  return {
    suggestions: query.data?.suggestions ?? [],
    activePersonas: query.data?.activePersonas ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

// Re-export types for convenience
export type { PersonaSuggestion, PersonaSummary, PersonaType };
