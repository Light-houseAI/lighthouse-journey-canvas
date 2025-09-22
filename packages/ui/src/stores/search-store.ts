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

interface SearchState {
  // Selected profile state
  selectedProfileId: string | undefined;
  currentQuery: string;

  // Actions
  setSelectedProfile: (profileId: string | undefined) => void;
  setCurrentQuery: (query: string) => void;
  clearSelection: () => void;
}

export const useSearchStore = create<SearchState>()(
  devtools(
    (set, get) => ({
      // Initial state
      selectedProfileId: undefined,
      currentQuery: '',

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
    }),
    {
      name: 'search-store',
    }
  )
);
