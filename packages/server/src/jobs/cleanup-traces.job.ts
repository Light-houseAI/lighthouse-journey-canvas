/**
 * Cleanup Traces Job
 *
 * Scheduled job to delete old query traces based on retention policy.
 * Default retention is 30 days.
 *
 * Can be run:
 * - Manually via API endpoint
 * - Via cron job (external scheduler)
 * - Via node-schedule (if added as dependency)
 */

import type { TraceService } from '../services/insight-generation/tracing/trace.service.js';
import type { Logger } from '../core/logger.js';

export interface CleanupTracesJobDeps {
  traceService: TraceService;
  logger: Logger;
}

/**
 * Run the cleanup job once
 * Returns the number of traces deleted
 */
export async function runCleanupTracesJob(deps: CleanupTracesJobDeps): Promise<{
  success: boolean;
  deletedCount: number;
  error?: string;
}> {
  const { traceService, logger } = deps;

  logger.info('[CleanupTracesJob] Starting trace cleanup...');
  const startTime = Date.now();

  try {
    const deletedCount = await traceService.cleanupOldTraces();
    const duration = Date.now() - startTime;

    logger.info(
      `[CleanupTracesJob] Completed in ${duration}ms. Deleted ${deletedCount} traces.`
    );

    return { success: true, deletedCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[CleanupTracesJob] Failed: ${message}`);

    return { success: false, deletedCount: 0, error: message };
  }
}

/**
 * Create a scheduled cleanup job using setInterval
 * Runs every 24 hours by default
 *
 * @param deps - Job dependencies
 * @param intervalMs - Interval in milliseconds (default: 24 hours)
 * @returns Stop function to cancel the scheduled job
 */
export function scheduleCleanupTracesJob(
  deps: CleanupTracesJobDeps,
  intervalMs: number = 24 * 60 * 60 * 1000
): () => void {
  const { logger } = deps;

  logger.info(
    `[CleanupTracesJob] Scheduling cleanup job to run every ${intervalMs / 1000 / 60 / 60} hours`
  );

  // Run immediately on startup
  runCleanupTracesJob(deps).catch((err) => {
    logger.error(`[CleanupTracesJob] Initial run failed: ${err}`);
  });

  // Schedule recurring runs
  const intervalId = setInterval(() => {
    runCleanupTracesJob(deps).catch((err) => {
      logger.error(`[CleanupTracesJob] Scheduled run failed: ${err}`);
    });
  }, intervalMs);

  // Return stop function
  return () => {
    logger.info('[CleanupTracesJob] Stopping scheduled cleanup job');
    clearInterval(intervalId);
  };
}
