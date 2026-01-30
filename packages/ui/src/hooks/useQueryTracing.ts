/**
 * Query Tracing Hooks
 *
 * TanStack Query hooks for the internal query tracing dashboard.
 * Provides data fetching and caching for trace data.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import * as queryTracingApi from '../services/query-tracing-api';
import type {
  TraceFilters,
  TracePagination,
  QueryTraceWithAgents,
  AggregateStats,
  TracePayload,
} from '../types/query-tracing.types';

// ============================================================================
// QUERY KEYS
// ============================================================================

export const queryTracingKeys = {
  all: ['query-tracing'] as const,
  lists: () => [...queryTracingKeys.all, 'list'] as const,
  list: (filters: TraceFilters, pagination: TracePagination) =>
    [...queryTracingKeys.lists(), { filters, pagination }] as const,
  details: () => [...queryTracingKeys.all, 'detail'] as const,
  detail: (traceId: string) => [...queryTracingKeys.details(), traceId] as const,
  stats: () => [...queryTracingKeys.all, 'stats'] as const,
  statsRange: (startDate?: string, endDate?: string) =>
    [...queryTracingKeys.stats(), { startDate, endDate }] as const,
  payloads: () => [...queryTracingKeys.all, 'payload'] as const,
  payload: (traceId: string, agentTraceId: string, type: 'input' | 'output') =>
    [...queryTracingKeys.payloads(), traceId, agentTraceId, type] as const,
};

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to fetch list of query traces with filtering and pagination
 */
export function useQueryTraces(
  filters: TraceFilters = {},
  pagination: TracePagination = { limit: 20, offset: 0 }
) {
  return useQuery({
    queryKey: queryTracingKeys.list(filters, pagination),
    queryFn: () => queryTracingApi.listTraces(filters, pagination),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

/**
 * Hook to fetch a single trace with all agent traces and data sources
 */
export function useQueryTraceDetail(traceId: string | null) {
  return useQuery({
    queryKey: queryTracingKeys.detail(traceId ?? ''),
    queryFn: () => queryTracingApi.getTrace(traceId!),
    enabled: !!traceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch aggregate statistics
 */
export function useQueryTracingStats(dateRange?: {
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: queryTracingKeys.statsRange(dateRange?.startDate, dateRange?.endDate),
    queryFn: () => queryTracingApi.getStats(dateRange),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

/**
 * Hook to fetch agent payload (lazy loading)
 */
export function useAgentPayload(
  traceId: string | null,
  agentTraceId: string | null,
  payloadType: 'input' | 'output',
  enabled: boolean = false
) {
  return useQuery({
    queryKey: queryTracingKeys.payload(traceId ?? '', agentTraceId ?? '', payloadType),
    queryFn: () => queryTracingApi.getAgentPayload(traceId!, agentTraceId!, payloadType),
    enabled: enabled && !!traceId && !!agentTraceId,
    staleTime: 10 * 60 * 1000, // 10 minutes (payloads don't change)
  });
}

// ============================================================================
// PREFETCHING
// ============================================================================

/**
 * Hook to prefetch trace details when hovering over a trace in the list
 */
export function usePrefetchTraceDetail() {
  const queryClient = useQueryClient();

  return useCallback(
    (traceId: string) => {
      queryClient.prefetchQuery({
        queryKey: queryTracingKeys.detail(traceId),
        queryFn: () => queryTracingApi.getTrace(traceId),
        staleTime: 5 * 60 * 1000,
      });
    },
    [queryClient]
  );
}

// ============================================================================
// INVALIDATION
// ============================================================================

/**
 * Hook to invalidate trace queries (useful after new traces are created)
 */
export function useInvalidateTraces() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryTracingKeys.lists() });
    queryClient.invalidateQueries({ queryKey: queryTracingKeys.stats() });
  }, [queryClient]);
}
