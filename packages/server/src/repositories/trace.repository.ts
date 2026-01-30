/**
 * Query Trace Repository
 *
 * Database queries for the query tracing dashboard.
 * Provides filtering, pagination, and aggregate statistics.
 */

import {
  queryTraces,
  agentTraces,
  dataSourceTraces,
  tracePayloads,
  type QueryTrace,
  type AgentTrace,
  type DataSourceTrace,
  type TracePayload,
} from '@journey/schema';
import { eq, desc, and, gte, lte, sql, count, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@journey/schema';
import type { Logger } from '../core/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface TraceFilters {
  userId?: number;
  status?: 'started' | 'completed' | 'failed';
  startDate?: Date;
  endDate?: Date;
  hasErrors?: boolean;
}

export interface TracePagination {
  limit: number;
  offset: number;
}

export interface TraceListResult {
  traces: QueryTraceSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface QueryTraceSummary {
  id: string;
  jobId: string | null;
  userId: number;
  rawQuery: string;
  agentPath: string | null;
  status: string;
  totalProcessingTimeMs: number | null;
  startedAt: Date;
  completedAt: Date | null;
  agentCount: number;
  hasErrors: boolean;
}

export interface TraceWithAgents extends QueryTrace {
  agentTraces: AgentTraceWithDataSources[];
}

export interface AgentTraceWithDataSources extends AgentTrace {
  dataSources: DataSourceTrace[];
  hasFullPayload: boolean;
}

export interface AggregateStats {
  period: { start: string; end: string };
  totalQueries: number;
  completedQueries: number;
  failedQueries: number;
  avgProcessingTimeMs: number;
  p50ProcessingTimeMs: number;
  p95ProcessingTimeMs: number;
  p99ProcessingTimeMs: number;
  agentStats: Record<
    string,
    {
      invocationCount: number;
      avgTimeMs: number;
      successRate: number;
      avgLLMCalls: number;
      avgTokensUsed: number;
    }
  >;
  routingStats: {
    mostCommonPaths: Array<{ path: string; count: number }>;
    intentDistribution: Record<string, number>;
    scopeDistribution: Record<string, number>;
  };
  errorStats: {
    totalErrors: number;
    errorsByAgent: Record<string, number>;
  };
}

// ============================================================================
// REPOSITORY
// ============================================================================

export class TraceRepository {
  private readonly db: NodePgDatabase<typeof schema>;
  private readonly logger: Logger;

  constructor({
    database,
    logger,
  }: {
    database: NodePgDatabase<typeof schema>;
    logger: Logger;
  }) {
    this.db = database;
    this.logger = logger;
  }

  /**
   * Find traces with filtering and pagination.
   */
  async findTraces(
    filters: TraceFilters,
    pagination: TracePagination
  ): Promise<TraceListResult> {
    const conditions = [];

    if (filters.userId !== undefined) {
      conditions.push(eq(queryTraces.userId, filters.userId));
    }

    if (filters.status) {
      conditions.push(eq(queryTraces.status, filters.status));
    }

    if (filters.startDate) {
      conditions.push(gte(queryTraces.startedAt, filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(lte(queryTraces.startedAt, filters.endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await this.db
      .select({ count: count() })
      .from(queryTraces)
      .where(whereClause);

    const total = countResult?.count ?? 0;

    // Get traces with agent count
    const traces = await this.db
      .select({
        id: queryTraces.id,
        jobId: queryTraces.jobId,
        userId: queryTraces.userId,
        rawQuery: queryTraces.rawQuery,
        agentPath: queryTraces.agentPath,
        status: queryTraces.status,
        totalProcessingTimeMs: queryTraces.totalProcessingTimeMs,
        startedAt: queryTraces.startedAt,
        completedAt: queryTraces.completedAt,
      })
      .from(queryTraces)
      .where(whereClause)
      .orderBy(desc(queryTraces.startedAt))
      .limit(pagination.limit)
      .offset(pagination.offset);

    // Get agent counts for each trace
    const traceIds = traces.map((t) => t.id);

    const agentCounts =
      traceIds.length > 0
        ? await this.db
            .select({
              queryTraceId: agentTraces.queryTraceId,
              count: count(),
              hasErrors: sql<boolean>`bool_or(${agentTraces.status} = 'failed')`,
            })
            .from(agentTraces)
            .where(inArray(agentTraces.queryTraceId, traceIds))
            .groupBy(agentTraces.queryTraceId)
        : [];

    const agentCountMap = new Map(
      agentCounts.map((c) => [
        c.queryTraceId,
        { count: c.count, hasErrors: c.hasErrors },
      ])
    );

    const result: QueryTraceSummary[] = traces.map((t) => ({
      id: t.id,
      jobId: t.jobId,
      userId: t.userId,
      rawQuery: t.rawQuery,
      agentPath: t.agentPath,
      status: t.status,
      totalProcessingTimeMs: t.totalProcessingTimeMs,
      startedAt: t.startedAt,
      completedAt: t.completedAt,
      agentCount: agentCountMap.get(t.id)?.count ?? 0,
      hasErrors:
        t.status === 'failed' || (agentCountMap.get(t.id)?.hasErrors ?? false),
    }));

    // Apply hasErrors filter if specified
    const filteredResult = filters.hasErrors !== undefined
      ? result.filter((t) => t.hasErrors === filters.hasErrors)
      : result;

    return {
      traces: filteredResult,
      total,
      limit: pagination.limit,
      offset: pagination.offset,
    };
  }

  /**
   * Get a single trace with all agent traces and data sources.
   */
  async getTraceWithAgents(traceId: string): Promise<TraceWithAgents | null> {
    // Get the trace
    const [trace] = await this.db
      .select()
      .from(queryTraces)
      .where(eq(queryTraces.id, traceId))
      .limit(1);

    if (!trace) {
      return null;
    }

    // Get agent traces
    const agents = await this.db
      .select()
      .from(agentTraces)
      .where(eq(agentTraces.queryTraceId, traceId))
      .orderBy(agentTraces.executionOrder);

    // Get data sources for all agents
    const agentIds = agents.map((a) => a.id);

    const dataSources =
      agentIds.length > 0
        ? await this.db
            .select()
            .from(dataSourceTraces)
            .where(inArray(dataSourceTraces.agentTraceId, agentIds))
        : [];

    // Check which agents have full payloads
    const payloadInfo =
      agentIds.length > 0
        ? await this.db
            .select({
              agentTraceId: tracePayloads.agentTraceId,
            })
            .from(tracePayloads)
            .where(inArray(tracePayloads.agentTraceId, agentIds))
        : [];

    const agentsWithPayloads = new Set(payloadInfo.map((p) => p.agentTraceId));

    // Build data source map
    const dataSourceMap = new Map<string, DataSourceTrace[]>();
    for (const ds of dataSources) {
      const existing = dataSourceMap.get(ds.agentTraceId) ?? [];
      existing.push(ds);
      dataSourceMap.set(ds.agentTraceId, existing);
    }

    // Combine agent traces with data sources
    const agentTracesWithDataSources: AgentTraceWithDataSources[] = agents.map(
      (agent) => ({
        ...agent,
        dataSources: dataSourceMap.get(agent.id) ?? [],
        hasFullPayload: agentsWithPayloads.has(agent.id),
      })
    );

    return {
      ...trace,
      agentTraces: agentTracesWithDataSources,
    };
  }

  /**
   * Get full payload for an agent trace.
   */
  async getAgentPayload(
    agentTraceId: string,
    payloadType: 'input' | 'output'
  ): Promise<TracePayload | null> {
    const [payload] = await this.db
      .select()
      .from(tracePayloads)
      .where(
        and(
          eq(tracePayloads.agentTraceId, agentTraceId),
          eq(tracePayloads.payloadType, payloadType)
        )
      )
      .limit(1);

    return payload ?? null;
  }

  /**
   * Get aggregate statistics for a date range.
   */
  async getAggregateStats(dateRange?: {
    startDate?: Date;
    endDate?: Date;
  }): Promise<AggregateStats> {
    const conditions = [];

    const startDate = dateRange?.startDate ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = dateRange?.endDate ?? new Date();

    conditions.push(gte(queryTraces.startedAt, startDate));
    conditions.push(lte(queryTraces.startedAt, endDate));

    const whereClause = and(...conditions);

    // Get basic query stats
    const queryStats = await this.db
      .select({
        totalQueries: count(),
        completedQueries: sql<number>`count(*) filter (where ${queryTraces.status} = 'completed')`,
        failedQueries: sql<number>`count(*) filter (where ${queryTraces.status} = 'failed')`,
        avgProcessingTimeMs: sql<number>`avg(${queryTraces.totalProcessingTimeMs})`,
        p50ProcessingTimeMs: sql<number>`percentile_cont(0.5) within group (order by ${queryTraces.totalProcessingTimeMs})`,
        p95ProcessingTimeMs: sql<number>`percentile_cont(0.95) within group (order by ${queryTraces.totalProcessingTimeMs})`,
        p99ProcessingTimeMs: sql<number>`percentile_cont(0.99) within group (order by ${queryTraces.totalProcessingTimeMs})`,
      })
      .from(queryTraces)
      .where(whereClause);

    // Get agent stats
    const agentStatsRaw = await this.db
      .select({
        agentId: agentTraces.agentId,
        invocationCount: count(),
        avgTimeMs: sql<number>`avg(${agentTraces.processingTimeMs})`,
        successCount: sql<number>`count(*) filter (where ${agentTraces.status} = 'completed')`,
        avgLLMCalls: sql<number>`avg(${agentTraces.llmCallCount})`,
        avgTokensUsed: sql<number>`avg(${agentTraces.llmTokensUsed})`,
      })
      .from(agentTraces)
      .innerJoin(queryTraces, eq(agentTraces.queryTraceId, queryTraces.id))
      .where(whereClause)
      .groupBy(agentTraces.agentId);

    const agentStats: AggregateStats['agentStats'] = {};
    for (const stat of agentStatsRaw) {
      agentStats[stat.agentId] = {
        invocationCount: stat.invocationCount,
        avgTimeMs: Math.round(stat.avgTimeMs ?? 0),
        successRate:
          stat.invocationCount > 0
            ? Math.round((stat.successCount / stat.invocationCount) * 100)
            : 0,
        avgLLMCalls: Math.round(stat.avgLLMCalls ?? 0),
        avgTokensUsed: Math.round(stat.avgTokensUsed ?? 0),
      };
    }

    // Get routing stats (most common paths)
    const pathStats = await this.db
      .select({
        path: queryTraces.agentPath,
        count: count(),
      })
      .from(queryTraces)
      .where(whereClause)
      .groupBy(queryTraces.agentPath)
      .orderBy(desc(count()))
      .limit(10);

    // Get error stats by agent
    const errorStats = await this.db
      .select({
        agentId: agentTraces.agentId,
        count: count(),
      })
      .from(agentTraces)
      .innerJoin(queryTraces, eq(agentTraces.queryTraceId, queryTraces.id))
      .where(and(whereClause, eq(agentTraces.status, 'failed')))
      .groupBy(agentTraces.agentId);

    const errorsByAgent: Record<string, number> = {};
    let totalErrors = 0;
    for (const stat of errorStats) {
      errorsByAgent[stat.agentId] = stat.count;
      totalErrors += stat.count;
    }

    return {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      totalQueries: queryStats[0]?.totalQueries ?? 0,
      completedQueries: queryStats[0]?.completedQueries ?? 0,
      failedQueries: queryStats[0]?.failedQueries ?? 0,
      avgProcessingTimeMs: Math.round(queryStats[0]?.avgProcessingTimeMs ?? 0),
      p50ProcessingTimeMs: Math.round(queryStats[0]?.p50ProcessingTimeMs ?? 0),
      p95ProcessingTimeMs: Math.round(queryStats[0]?.p95ProcessingTimeMs ?? 0),
      p99ProcessingTimeMs: Math.round(queryStats[0]?.p99ProcessingTimeMs ?? 0),
      agentStats,
      routingStats: {
        mostCommonPaths: pathStats.map((p) => ({
          path: p.path ?? 'unknown',
          count: p.count,
        })),
        intentDistribution: {}, // Would need to parse queryClassification JSON
        scopeDistribution: {}, // Would need to parse queryClassification JSON
      },
      errorStats: {
        totalErrors,
        errorsByAgent,
      },
    };
  }
}
