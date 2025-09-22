/**
 * Search Store
 *
 * Zustand store for local search UI state (selections, current query)
 * Works alongside TanStack Query for server state management
 * - Zustand: UI state (selected profile, current query)
 * - TanStack Query: Server state (search results, caching, background updates)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { GraphRAGSearchResponse } from '../components/search/types/search.types';

interface SearchState {
  // Selected profile state
  selectedProfileId: string | undefined;
  currentQuery: string;

  // Pre-loaded match data from experience matches
  preloadedMatchData: GraphRAGSearchResponse | undefined;

  // Actions
  setSelectedProfile: (profileId: string | undefined) => void;
  setCurrentQuery: (query: string) => void;
  clearSelection: () => void;
  setPreloadedMatchData: (data: GraphRAGSearchResponse | undefined) => void;
  clearPreloadedData: () => void;
}

export const useSearchStore = create<SearchState>()(
  devtools(
    (set, get) => ({
      // Initial state
      selectedProfileId: undefined,
      currentQuery: '',
      preloadedMatchData: undefined,

      // Actions
      setSelectedProfile: (profileId) => {
        set({ selectedProfileId: profileId }, false, 'setSelectedProfile');
      },

      setCurrentQuery: (query) => {
        const currentQuery = get().currentQuery;

        // If query changed, clear selection and sync with TanStack Query
        if (query !== currentQuery) {
          set(
            {
              currentQuery: query,
              selectedProfileId: undefined
            },
            false,
            'setCurrentQuery'
          );
        }
      },

      clearSelection: () => {
        set({ selectedProfileId: undefined }, false, 'clearSelection');
      },

      setPreloadedMatchData: (data) => {
        set({ preloadedMatchData: data }, false, 'setPreloadedMatchData');
      },

      clearPreloadedData: () => {
        set({ preloadedMatchData: undefined }, false, 'clearPreloadedData');
      },
    }),
    {
      name: 'search-store',
    }
  )
);
