/**
 * Query List View Component
 *
 * Filterable list of query traces with pagination.
 * Shows summary info for each trace with clickable rows to view details.
 */

import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import React, { useMemo } from 'react';

import { useQueryTraces, usePrefetchTraceDetail } from '../../hooks/useQueryTracing';
import {
  formatProcessingTime,
  getStatusColor,
  parseAgentPath,
} from '../../services/query-tracing-api';
import {
  useQueryTracingStore,
  selectCurrentPage,
  selectHasActiveFilters,
} from '../../stores/query-tracing-store';
import type { QueryTraceSummary, QueryTraceStatus } from '../../types/query-tracing.types';

// ============================================================================
// STATUS BADGE
// ============================================================================

interface StatusBadgeProps {
  status: QueryTraceStatus;
  hasErrors?: boolean;
}

function StatusBadge({ status, hasErrors }: StatusBadgeProps) {
  const color = getStatusColor(status);
  const showError = hasErrors && status !== 'failed';

  const colorClasses = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    gray: 'bg-gray-100 text-gray-700',
    yellow: 'bg-yellow-100 text-yellow-700',
  };

  const icons = {
    started: <Loader2 className="h-3 w-3 animate-spin" />,
    completed: <CheckCircle2 className="h-3 w-3" />,
    failed: <XCircle className="h-3 w-3" />,
  };

  return (
    <div className="flex items-center gap-1">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colorClasses[color]}`}
      >
        {icons[status]}
        {status}
      </span>
      {showError && (
        <AlertCircle className="h-4 w-4 text-amber-500" title="Has agent errors" />
      )}
    </div>
  );
}

// ============================================================================
// AGENT PATH DISPLAY
// ============================================================================

interface AgentPathDisplayProps {
  agentPath: string | null;
}

function AgentPathDisplay({ agentPath }: AgentPathDisplayProps) {
  const agents = parseAgentPath(agentPath);

  if (agents.length === 0) {
    return <span className="text-xs text-gray-400">-</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {agents.map((agent, index) => (
        <React.Fragment key={index}>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-600">
            {agent}
          </span>
          {index < agents.length - 1 && (
            <span className="text-xs text-gray-400">→</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================================================
// FILTER BAR
// ============================================================================

function FilterBar() {
  const { filters, setFilters, resetFilters } = useQueryTracingStore();
  const hasActiveFilters = useQueryTracingStore(selectHasActiveFilters);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <Filter className="h-4 w-4 text-gray-500" />

      {/* Status filter */}
      <select
        value={filters.status ?? 'all'}
        onChange={(e) =>
          setFilters({ status: e.target.value as QueryTraceStatus | 'all' })
        }
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
      >
        <option value="all">All Status</option>
        <option value="completed">Completed</option>
        <option value="failed">Failed</option>
        <option value="started">In Progress</option>
      </select>

      {/* Error filter */}
      <select
        value={filters.hasErrors === undefined ? 'all' : String(filters.hasErrors)}
        onChange={(e) => {
          const value = e.target.value;
          setFilters({
            hasErrors: value === 'all' ? undefined : value === 'true',
          });
        }}
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
      >
        <option value="all">All Traces</option>
        <option value="true">With Errors</option>
        <option value="false">No Errors</option>
      </select>

      {/* Date range - simplified */}
      <input
        type="date"
        value={filters.startDate ?? ''}
        onChange={(e) => setFilters({ startDate: e.target.value || undefined })}
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
        placeholder="Start date"
      />
      <span className="text-gray-400">to</span>
      <input
        type="date"
        value={filters.endDate ?? ''}
        onChange={(e) => setFilters({ endDate: e.target.value || undefined })}
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
        placeholder="End date"
      />

      {/* Reset button */}
      {hasActiveFilters && (
        <button
          onClick={resetFilters}
          className="text-sm text-indigo-600 hover:text-indigo-700"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

// ============================================================================
// TRACE ROW
// ============================================================================

interface TraceRowProps {
  trace: QueryTraceSummary;
  isSelected: boolean;
  onSelect: () => void;
  onHover: () => void;
}

function TraceRow({ trace, isSelected, onSelect, onHover }: TraceRowProps) {
  const formattedTime = useMemo(() => {
    const date = new Date(trace.startedAt);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [trace.startedAt]);

  return (
    <tr
      className={`cursor-pointer border-b border-gray-100 transition-colors hover:bg-gray-50 ${
        isSelected ? 'bg-indigo-50' : ''
      }`}
      onClick={onSelect}
      onMouseEnter={onHover}
    >
      <td className="px-4 py-3">
        <div className="max-w-md">
          <p className="truncate text-sm font-medium text-gray-900" title={trace.rawQuery}>
            {trace.rawQuery}
          </p>
          <p className="text-xs text-gray-500">{formattedTime}</p>
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={trace.status} hasErrors={trace.hasErrors} />
      </td>
      <td className="px-4 py-3">
        <AgentPathDisplay agentPath={trace.agentPath} />
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-gray-600">{trace.agentCount}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <Clock className="h-3.5 w-3.5" />
          {formatProcessingTime(trace.totalProcessingTimeMs)}
        </div>
      </td>
    </tr>
  );
}

// ============================================================================
// PAGINATION
// ============================================================================

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  total: number;
  limit: number;
  offset: number;
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  total,
  limit,
  offset,
}: PaginationProps) {
  const start = offset + 1;
  const end = Math.min(offset + limit, total);

  return (
    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3">
      <p className="text-sm text-gray-600">
        Showing <span className="font-medium">{start}</span> to{' '}
        <span className="font-medium">{end}</span> of{' '}
        <span className="font-medium">{total}</span> traces
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0}
          className="rounded-md border border-gray-300 bg-white p-1.5 disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm text-gray-600">
          Page {currentPage + 1} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          className="rounded-md border border-gray-300 bg-white p-1.5 disabled:opacity-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function QueryListView() {
  const { filters, pagination, selectedTraceId, setSelectedTraceId, setPage } =
    useQueryTracingStore();
  const currentPage = useQueryTracingStore(selectCurrentPage);
  const prefetchDetail = usePrefetchTraceDetail();

  const { data, isLoading, error, refetch, isFetching } = useQueryTraces(
    filters,
    pagination
  );

  const totalPages = data
    ? Math.ceil(data.pagination.total / data.pagination.limit)
    : 0;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <XCircle className="mb-3 h-10 w-10 text-red-400" />
        <p className="mb-1 text-sm font-medium text-gray-700">
          Failed to load traces
        </p>
        <p className="mb-4 text-xs text-gray-500">{error.message}</p>
        <button
          onClick={() => refetch()}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Query Traces</h2>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <FilterBar />

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Query
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Agent Path
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Agents
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Duration
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
                  <p className="mt-2 text-sm text-gray-500">Loading traces...</p>
                </td>
              </tr>
            ) : !data?.traces.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Search className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                  <p className="text-sm font-medium text-gray-600">No traces found</p>
                  <p className="text-xs text-gray-400">
                    Try adjusting your filters or check back later
                  </p>
                </td>
              </tr>
            ) : (
              data.traces.map((trace) => (
                <TraceRow
                  key={trace.id}
                  trace={trace}
                  isSelected={trace.id === selectedTraceId}
                  onSelect={() => setSelectedTraceId(trace.id)}
                  onHover={() => prefetchDetail(trace.id)}
                />
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {data && data.pagination.total > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            total={data.pagination.total}
            limit={data.pagination.limit}
            offset={data.pagination.offset}
          />
        )}
      </div>
    </div>
  );
}
