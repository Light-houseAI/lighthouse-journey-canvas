/**
 * Query Tracing Store
 *
 * Zustand store for query tracing dashboard UI state.
 * Works alongside TanStack Query for server state management.
 * - Zustand: UI state (selected trace, filters, expanded agents)
 * - TanStack Query: Server state (trace data, caching, background updates)
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { TraceFilters, TracePagination } from '../types/query-tracing.types';

// ============================================================================
// TYPES
// ============================================================================

type TabId = 'overview' | 'traces' | 'agent-performance';

interface QueryTracingState {
  // Navigation
  activeTab: TabId;

  // Selection state
  selectedTraceId: string | null;

  // Filters
  filters: TraceFilters;

  // Pagination
  pagination: TracePagination;

  // Expanded agents in detail view
  expandedAgentIds: Set<string>;

  // Date range for stats
  statsDateRange: {
    startDate: string;
    endDate: string;
  };

  // Actions
  setActiveTab: (tab: TabId) => void;
  setSelectedTraceId: (traceId: string | null) => void;
  setFilters: (filters: Partial<TraceFilters>) => void;
  resetFilters: () => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  toggleAgentExpanded: (agentId: string) => void;
  expandAllAgents: (agentIds: string[]) => void;
  collapseAllAgents: () => void;
  setStatsDateRange: (range: { startDate?: string; endDate?: string }) => void;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_FILTERS: TraceFilters = {
  status: 'all',
};

const DEFAULT_PAGINATION: TracePagination = {
  limit: 20,
  offset: 0,
};

// Default to last 7 days
const getDefaultDateRange = () => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
};

// ============================================================================
// STORE
// ============================================================================

export const useQueryTracingStore = create<QueryTracingState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        activeTab: 'overview',
        selectedTraceId: null,
        filters: DEFAULT_FILTERS,
        pagination: DEFAULT_PAGINATION,
        expandedAgentIds: new Set<string>(),
        statsDateRange: getDefaultDateRange(),

        // Actions
        setActiveTab: (tab) => {
          set({ activeTab: tab }, false, 'setActiveTab');
        },

        setSelectedTraceId: (traceId) => {
          set(
            {
              selectedTraceId: traceId,
              // Reset expanded agents when selecting a new trace
              expandedAgentIds: new Set<string>(),
            },
            false,
            'setSelectedTraceId'
          );
        },

        setFilters: (newFilters) => {
          const currentFilters = get().filters;
          set(
            {
              filters: { ...currentFilters, ...newFilters },
              // Reset pagination when filters change
              pagination: { ...get().pagination, offset: 0 },
            },
            false,
            'setFilters'
          );
        },

        resetFilters: () => {
          set(
            {
              filters: DEFAULT_FILTERS,
              pagination: DEFAULT_PAGINATION,
            },
            false,
            'resetFilters'
          );
        },

        setPage: (page) => {
          const { limit } = get().pagination;
          set(
            {
              pagination: { limit, offset: page * limit },
            },
            false,
            'setPage'
          );
        },

        setPageSize: (size) => {
          set(
            {
              pagination: { limit: size, offset: 0 },
            },
            false,
            'setPageSize'
          );
        },

        toggleAgentExpanded: (agentId) => {
          const expanded = new Set(get().expandedAgentIds);
          if (expanded.has(agentId)) {
            expanded.delete(agentId);
          } else {
            expanded.add(agentId);
          }
          set({ expandedAgentIds: expanded }, false, 'toggleAgentExpanded');
        },

        expandAllAgents: (agentIds) => {
          set(
            { expandedAgentIds: new Set(agentIds) },
            false,
            'expandAllAgents'
          );
        },

        collapseAllAgents: () => {
          set({ expandedAgentIds: new Set<string>() }, false, 'collapseAllAgents');
        },

        setStatsDateRange: (range) => {
          const current = get().statsDateRange;
          set(
            {
              statsDateRange: {
                startDate: range.startDate ?? current.startDate,
                endDate: range.endDate ?? current.endDate,
              },
            },
            false,
            'setStatsDateRange'
          );
        },
      }),
      {
        name: 'query-tracing-store',
        // Only persist certain fields
        partialize: (state) => ({
          filters: state.filters,
          pagination: { limit: state.pagination.limit, offset: 0 }, // Don't persist offset
          statsDateRange: state.statsDateRange,
        }),
        // Handle Set serialization for localStorage
        storage: {
          getItem: (name) => {
            const str = localStorage.getItem(name);
            if (!str) return null;
            const value = JSON.parse(str);
            return value;
          },
          setItem: (name, value) => {
            localStorage.setItem(name, JSON.stringify(value));
          },
          removeItem: (name) => {
            localStorage.removeItem(name);
          },
        },
      }
    ),
    {
      name: 'query-tracing-store',
    }
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

export const selectCurrentPage = (state: QueryTracingState) =>
  Math.floor(state.pagination.offset / state.pagination.limit);

export const selectHasActiveFilters = (state: QueryTracingState) => {
  const { filters } = state;
  return (
    filters.userId !== undefined ||
    (filters.status !== undefined && filters.status !== 'all') ||
    filters.startDate !== undefined ||
    filters.endDate !== undefined ||
    filters.hasErrors !== undefined
  );
};
