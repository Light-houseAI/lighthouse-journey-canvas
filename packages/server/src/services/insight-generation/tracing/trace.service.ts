/**
 * Query Trace Service
 *
 * Manages trace lifecycle with minimal impact on agent performance.
 * Uses async batching to avoid blocking the main pipeline.
 *
 * Features:
 * - Async batched writes (10 writes / 1 second flush)
 * - Zero-overhead when tracing disabled
 * - Summarized payloads by default, full payloads for failed queries
 */

import { eq, lt } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@journey/schema';
import { queryTraces, agentTraces, dataSourceTraces, tracePayloads } from '@journey/schema';
import type { Logger } from '../../../core/logger.js';
import type {
  StartTraceInput,
  StartAgentTraceInput,
  CompleteAgentTraceInput,
  CompleteTraceInput,
  RecordDataSourceInput,
  StorePayloadInput,
  TraceServiceConfig,
  TraceContext,
} from './types.js';
import { DEFAULT_TRACE_CONFIG } from './types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface TraceServiceDeps {
  logger: Logger;
  database: NodePgDatabase<typeof schema>;
  config?: Partial<TraceServiceConfig>;
}

type WriteOperation = () => Promise<void>;

// ============================================================================
// SERVICE
// ============================================================================

export class TraceService {
  private readonly logger: Logger;
  private readonly database: NodePgDatabase<typeof schema>;
  private readonly config: TraceServiceConfig;

  private pendingWrites: WriteOperation[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private isShuttingDown = false;

  constructor(deps: TraceServiceDeps) {
    this.logger = deps.logger;
    this.database = deps.database;
    this.config = { ...DEFAULT_TRACE_CONFIG, ...deps.config };

    this.startBatchFlush();
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  /**
   * Start a new query trace.
   * This is synchronous to return the traceId immediately.
   */
  async startTrace(input: StartTraceInput): Promise<string> {
    try {
      const [trace] = await this.database
        .insert(queryTraces)
        .values({
          jobId: input.jobId ?? null,
          userId: input.userId,
          rawQuery: input.rawQuery,
          queryClassification: input.queryClassification ?? null,
          hasAttachedSessions: input.hasAttachedSessions,
          attachedSessionCount: input.attachedSessionCount,
          hasConversationMemory: input.hasConversationMemory,
          status: 'started',
          startedAt: new Date(),
        })
        .returning({ id: queryTraces.id });

      this.logger.info('Started query trace', { traceId: trace.id, userId: input.userId });
      return trace.id;
    } catch (error) {
      this.logger.error('Failed to start query trace', { error, input });
      throw error;
    }
  }

  /**
   * Start tracing an agent execution.
   * This is synchronous to return the agentTraceId immediately.
   */
  async startAgentTrace(input: StartAgentTraceInput): Promise<string> {
    try {
      const [agentTrace] = await this.database
        .insert(agentTraces)
        .values({
          queryTraceId: input.queryTraceId,
          agentId: input.agentId,
          agentName: input.agentName,
          executionOrder: input.executionOrder,
          inputSummary: input.inputSummary,
          status: 'running',
          startedAt: new Date(),
        })
        .returning({ id: agentTraces.id });

      this.logger.debug('Started agent trace', {
        agentTraceId: agentTrace.id,
        agentId: input.agentId,
        queryTraceId: input.queryTraceId,
      });

      return agentTrace.id;
    } catch (error) {
      this.logger.error('Failed to start agent trace', { error, input });
      throw error;
    }
  }

  /**
   * Complete an agent trace.
   * This is batched/async to avoid blocking the agent pipeline.
   */
  completeAgentTrace(input: CompleteAgentTraceInput): void {
    this.queueWrite(async () => {
      await this.database
        .update(agentTraces)
        .set({
          status: input.status,
          outputSummary: input.outputSummary,
          processingTimeMs: input.processingTimeMs,
          llmCallCount: input.llmCallCount ?? 0,
          llmTokensUsed: input.llmTokensUsed ?? 0,
          modelUsed: input.modelUsed ?? null,
          critiqueResult: input.critiqueResult ?? null,
          retryCount: input.retryCount ?? 0,
          completedAt: new Date(),
        })
        .where(eq(agentTraces.id, input.agentTraceId));
    });
  }

  /**
   * Record a data source access.
   * This is batched/async.
   */
  recordDataSourceAccess(input: RecordDataSourceInput): void {
    this.queueWrite(async () => {
      await this.database.insert(dataSourceTraces).values({
        agentTraceId: input.agentTraceId,
        sourceName: input.sourceName,
        sourceType: input.sourceType,
        queryDescription: input.queryDescription ?? null,
        parametersUsed: input.parametersUsed ?? null,
        resultCount: input.resultCount ?? null,
        resultSummary: input.resultSummary ?? null,
        latencyMs: input.latencyMs ?? null,
      });
    });
  }

  /**
   * Store full payload for debugging (used for failed queries).
   * This is batched/async.
   */
  storePayload(input: StorePayloadInput): void {
    const payloadStr = JSON.stringify(input.payload);
    const sizeBytes = Buffer.byteLength(payloadStr, 'utf8');

    // Truncate if too large
    const truncatedPayload =
      sizeBytes > this.config.maxPayloadSizeBytes
        ? { _truncated: true, _originalSize: sizeBytes, preview: payloadStr.slice(0, 1000) }
        : input.payload;

    this.queueWrite(async () => {
      await this.database.insert(tracePayloads).values({
        agentTraceId: input.agentTraceId,
        payloadType: input.payloadType,
        payload: truncatedPayload,
        sizeBytes: Math.min(sizeBytes, this.config.maxPayloadSizeBytes),
      });
    });
  }

  /**
   * Complete the overall query trace.
   * This is batched/async.
   */
  completeTrace(input: CompleteTraceInput): void {
    this.queueWrite(async () => {
      await this.database
        .update(queryTraces)
        .set({
          status: input.status,
          agentPath: input.agentPath,
          totalProcessingTimeMs: input.totalProcessingTimeMs,
          routingDecision: input.routingDecision ?? null,
          completedAt: new Date(),
        })
        .where(eq(queryTraces.id, input.traceId));
    });

    this.logger.info('Completed query trace', {
      traceId: input.traceId,
      status: input.status,
      agentPath: input.agentPath,
      totalProcessingTimeMs: input.totalProcessingTimeMs,
    });
  }

  /**
   * Update query classification on an existing trace.
   * This is batched/async.
   */
  updateQueryClassification(
    traceId: string,
    classification: StartTraceInput['queryClassification']
  ): void {
    this.queueWrite(async () => {
      await this.database
        .update(queryTraces)
        .set({
          queryClassification: classification ?? null,
        })
        .where(eq(queryTraces.id, traceId));
    });
  }

  /**
   * Create a trace context for passing through the pipeline.
   */
  createTraceContext(traceId: string | null): TraceContext {
    return {
      traceId,
      executionOrder: 0,
      enabled: traceId !== null,
    };
  }

  /**
   * Clean up old traces based on retention policy.
   * Should be called by a scheduled job.
   */
  async cleanupOldTraces(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    try {
      // Delete cascades to agent_traces, trace_payloads, and data_source_traces
      const result = await this.database
        .delete(queryTraces)
        .where(lt(queryTraces.createdAt, cutoffDate))
        .returning({ id: queryTraces.id });

      const deletedCount = result.length;
      this.logger.info('Cleaned up old traces', {
        deletedCount,
        retentionDays: this.config.retentionDays,
        cutoffDate: cutoffDate.toISOString(),
      });

      return deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup old traces', { error });
      throw error;
    }
  }

  /**
   * Gracefully shutdown the service, flushing any pending writes.
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Flush any remaining writes
    await this.flush();

    this.logger.info('TraceService shutdown complete');
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Queue a write operation for batched execution.
   */
  private queueWrite(writeFn: WriteOperation): void {
    if (this.isShuttingDown) {
      this.logger.warn('TraceService is shutting down, skipping write');
      return;
    }

    this.pendingWrites.push(writeFn);

    // Flush immediately if we've reached the batch size
    if (this.pendingWrites.length >= this.config.batchSize) {
      void this.flush();
    }
  }

  /**
   * Start the periodic batch flush.
   */
  private startBatchFlush(): void {
    this.flushInterval = setInterval(() => {
      void this.flush();
    }, this.config.flushIntervalMs);
  }

  /**
   * Flush all pending writes to the database.
   */
  private async flush(): Promise<void> {
    if (this.pendingWrites.length === 0) {
      return;
    }

    // Take all pending writes
    const writes = this.pendingWrites.splice(0, this.pendingWrites.length);

    // Execute all writes in parallel
    const results = await Promise.allSettled(writes.map((w) => w()));

    // Log any failures
    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      this.logger.error('Some trace writes failed', {
        failedCount: failures.length,
        totalCount: writes.length,
        errors: failures.map((f) => (f as PromiseRejectedResult).reason),
      });
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a TraceService instance.
 * Returns null if tracing is disabled (TRACE_ENABLED !== 'true').
 */
export function createTraceService(
  deps: TraceServiceDeps,
  enabled: boolean = process.env.TRACE_ENABLED === 'true'
): TraceService | null {
  deps.logger.info('TraceService factory called', {
    enabled,
    envValue: process.env.TRACE_ENABLED
  });

  if (!enabled) {
    deps.logger.info('Query tracing is disabled (TRACE_ENABLED !== "true")');
    return null;
  }

  deps.logger.info('✅ TraceService created - query tracing enabled');
  return new TraceService(deps);
}
