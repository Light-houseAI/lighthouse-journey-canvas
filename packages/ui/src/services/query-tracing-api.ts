/**
 * Query Tracing API Service
 *
 * Client-side API functions for the internal query tracing dashboard.
 * Provides access to trace data for monitoring the insight generation pipeline.
 */

import type {
  TraceListResponse,
  QueryTraceWithAgents,
  TracePayload,
  AggregateStats,
  TraceFilters,
  TracePagination,
} from '../types/query-tracing.types';
import { httpClient } from './http-client';

const BASE_URL = '/api/v2/admin/traces';

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * List query traces with filtering and pagination
 */
export async function listTraces(
  filters?: TraceFilters,
  pagination?: TracePagination
): Promise<TraceListResponse> {
  const params = new URLSearchParams();

  // Filters
  if (filters?.userId !== undefined) {
    params.set('userId', String(filters.userId));
  }
  if (filters?.status && filters.status !== 'all') {
    params.set('status', filters.status);
  }
  if (filters?.startDate) {
    params.set('startDate', filters.startDate);
  }
  if (filters?.endDate) {
    params.set('endDate', filters.endDate);
  }
  if (filters?.hasErrors !== undefined) {
    params.set('hasErrors', String(filters.hasErrors));
  }

  // Pagination
  if (pagination?.limit) {
    params.set('limit', String(pagination.limit));
  }
  if (pagination?.offset) {
    params.set('offset', String(pagination.offset));
  }

  const queryString = params.toString();
  const url = queryString ? `${BASE_URL}?${queryString}` : BASE_URL;

  const data = await httpClient.get<TraceListResponse>(url);
  return data;
}

/**
 * Get a single trace with all agent traces and data sources
 */
export async function getTrace(traceId: string): Promise<QueryTraceWithAgents> {
  const data = await httpClient.get<QueryTraceWithAgents>(
    `${BASE_URL}/${traceId}`
  );
  return data;
}

/**
 * Get the full payload for an agent trace
 */
export async function getAgentPayload(
  traceId: string,
  agentTraceId: string,
  payloadType: 'input' | 'output'
): Promise<TracePayload | null> {
  const params = new URLSearchParams();
  params.set('type', payloadType);

  const data = await httpClient.get<{ payload: TracePayload | null }>(
    `${BASE_URL}/${traceId}/agents/${agentTraceId}/payload?${params.toString()}`
  );
  return data.payload;
}

/**
 * Get aggregate statistics for a date range
 */
export async function getStats(dateRange?: {
  startDate?: string;
  endDate?: string;
}): Promise<AggregateStats> {
  const params = new URLSearchParams();

  if (dateRange?.startDate) {
    params.set('startDate', dateRange.startDate);
  }
  if (dateRange?.endDate) {
    params.set('endDate', dateRange.endDate);
  }

  const queryString = params.toString();
  const url = queryString
    ? `${BASE_URL}/stats?${queryString}`
    : `${BASE_URL}/stats`;

  const data = await httpClient.get<AggregateStats>(url);
  return data;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse agent path string into array of agent IDs
 * @example "A1→A2→A3→A5" => ["A1", "A2", "A3", "A5"]
 */
export function parseAgentPath(agentPath: string | null): string[] {
  if (!agentPath) return [];
  return agentPath.split('→').map((s) => s.trim());
}

/**
 * Format processing time for display
 */
export function formatProcessingTime(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Get status color for display
 */
export function getStatusColor(
  status: 'started' | 'completed' | 'failed' | 'pending' | 'running' | 'skipped'
): 'blue' | 'green' | 'red' | 'gray' | 'yellow' {
  switch (status) {
    case 'started':
    case 'running':
      return 'blue';
    case 'completed':
      return 'green';
    case 'failed':
      return 'red';
    case 'skipped':
    case 'pending':
      return 'gray';
    default:
      return 'gray';
  }
}
