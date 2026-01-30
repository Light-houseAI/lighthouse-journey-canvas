/**
 * Stats Overview Component
 *
 * Dashboard overview showing aggregate statistics for query traces:
 * - Total queries, success rate, avg processing time
 * - Per-agent performance metrics
 * - Most common routing paths
 * - Error distribution
 */

import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  GitBranch,
  Loader2,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import React from 'react';

import { useQueryTracingStats } from '../../hooks/useQueryTracing';
import { formatProcessingTime } from '../../services/query-tracing-api';
import { useQueryTracingStore } from '../../stores/query-tracing-store';
import type { AggregateStats } from '../../types/query-tracing.types';

// ============================================================================
// STAT CARD
// ============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    direction: 'up' | 'down';
    value: string;
    positive?: boolean;
  };
}

function StatCard({ title, value, subtitle, icon, trend }: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-gray-500">{title}</span>
        <span className="text-gray-400">{icon}</span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
        {trend && (
          <div
            className={`flex items-center gap-0.5 text-xs ${
              trend.positive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            <TrendingUp
              className={`h-3 w-3 ${trend.direction === 'down' ? 'rotate-180' : ''}`}
            />
            {trend.value}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// AGENT PERFORMANCE TABLE
// ============================================================================

interface AgentPerformanceTableProps {
  agentStats: AggregateStats['agentStats'];
}

function AgentPerformanceTable({ agentStats }: AgentPerformanceTableProps) {
  const agents = Object.entries(agentStats).sort(
    (a, b) => b[1].invocationCount - a[1].invocationCount
  );

  if (agents.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-400">
        No agent data available
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
              Agent
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
              Calls
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
              Avg Time
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
              Success
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
              LLM Calls
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">
              Tokens
            </th>
          </tr>
        </thead>
        <tbody>
          {agents.map(([agentId, stats]) => (
            <tr key={agentId} className="border-t border-gray-100">
              <td className="px-4 py-2 font-mono text-sm font-medium text-gray-800">
                {agentId}
              </td>
              <td className="px-4 py-2 text-right text-sm text-gray-600">
                {stats.invocationCount.toLocaleString()}
              </td>
              <td className="px-4 py-2 text-right text-sm text-gray-600">
                {formatProcessingTime(stats.avgTimeMs)}
              </td>
              <td className="px-4 py-2 text-right">
                <span
                  className={`text-sm font-medium ${
                    stats.successRate >= 95
                      ? 'text-green-600'
                      : stats.successRate >= 80
                      ? 'text-yellow-600'
                      : 'text-red-600'
                  }`}
                >
                  {stats.successRate}%
                </span>
              </td>
              <td className="px-4 py-2 text-right text-sm text-gray-600">
                {stats.avgLLMCalls.toFixed(1)}
              </td>
              <td className="px-4 py-2 text-right text-sm text-gray-600">
                {stats.avgTokensUsed.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// ROUTING PATHS
// ============================================================================

interface RoutingPathsProps {
  paths: Array<{ path: string; count: number }>;
}

function RoutingPaths({ paths }: RoutingPathsProps) {
  const maxCount = Math.max(...paths.map((p) => p.count), 1);

  if (paths.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-400">
        No routing data available
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {paths.slice(0, 5).map((item) => (
        <div key={item.path} className="flex items-center gap-3">
          <div className="flex-1">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-sm text-gray-700">{item.path}</span>
              <span className="text-xs text-gray-500">{item.count}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{ width: `${(item.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// ERROR BREAKDOWN
// ============================================================================

interface ErrorBreakdownProps {
  errorStats: AggregateStats['errorStats'];
}

function ErrorBreakdown({ errorStats }: ErrorBreakdownProps) {
  const { totalErrors, errorsByAgent } = errorStats;
  const agents = Object.entries(errorsByAgent).sort((a, b) => b[1] - a[1]);

  if (totalErrors === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-sm font-medium">No errors in this period</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-red-500" />
        <span className="text-lg font-bold text-red-600">{totalErrors}</span>
        <span className="text-sm text-gray-500">total errors</span>
      </div>

      <div className="space-y-1">
        {agents.map(([agentId, count]) => (
          <div key={agentId} className="flex items-center justify-between">
            <span className="font-mono text-sm text-gray-700">{agentId}</span>
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// DATE RANGE PICKER
// ============================================================================

function DateRangePicker() {
  const { statsDateRange, setStatsDateRange } = useQueryTracingStore();

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={statsDateRange.startDate}
        onChange={(e) => setStatsDateRange({ startDate: e.target.value })}
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
      />
      <span className="text-gray-400">to</span>
      <input
        type="date"
        value={statsDateRange.endDate}
        onChange={(e) => setStatsDateRange({ endDate: e.target.value })}
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
      />
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function StatsOverview() {
  const { statsDateRange } = useQueryTracingStore();
  const { data: stats, isLoading, error } = useQueryTracingStats(statsDateRange);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <XCircle className="mb-3 h-10 w-10 text-red-400" />
        <p className="text-sm text-gray-700">Failed to load statistics</p>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const successRate =
    stats.totalQueries > 0
      ? Math.round((stats.completedQueries / stats.totalQueries) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header with date picker */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Pipeline Overview</h2>
        <DateRangePicker />
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Queries"
          value={stats.totalQueries.toLocaleString()}
          icon={<Activity className="h-5 w-5" />}
        />
        <StatCard
          title="Success Rate"
          value={`${successRate}%`}
          subtitle={`${stats.completedQueries} completed`}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          title="Avg Processing Time"
          value={formatProcessingTime(stats.avgProcessingTimeMs)}
          subtitle={`P95: ${formatProcessingTime(stats.p95ProcessingTimeMs)}`}
          icon={<Clock className="h-5 w-5" />}
        />
        <StatCard
          title="Failed Queries"
          value={stats.failedQueries.toLocaleString()}
          icon={<XCircle className="h-5 w-5" />}
        />
      </div>

      {/* Processing time percentiles */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-700">
          <Zap className="h-4 w-4" />
          Processing Time Percentiles
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {formatProcessingTime(stats.p50ProcessingTimeMs)}
            </p>
            <p className="text-xs text-gray-500">P50 (Median)</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {formatProcessingTime(stats.p95ProcessingTimeMs)}
            </p>
            <p className="text-xs text-gray-500">P95</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">
              {formatProcessingTime(stats.p99ProcessingTimeMs)}
            </p>
            <p className="text-xs text-gray-500">P99</p>
          </div>
        </div>
      </div>

      {/* Agent performance */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-700">
          <BarChart3 className="h-4 w-4" />
          Agent Performance
        </h3>
        <AgentPerformanceTable agentStats={stats.agentStats} />
      </div>

      {/* Two-column layout for routing and errors */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Most common paths */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-700">
            <GitBranch className="h-4 w-4" />
            Most Common Routing Paths
          </h3>
          <RoutingPaths paths={stats.routingStats.mostCommonPaths} />
        </div>

        {/* Error breakdown */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-700">
            <AlertTriangle className="h-4 w-4" />
            Error Breakdown
          </h3>
          <ErrorBreakdown errorStats={stats.errorStats} />
        </div>
      </div>
    </div>
  );
}
