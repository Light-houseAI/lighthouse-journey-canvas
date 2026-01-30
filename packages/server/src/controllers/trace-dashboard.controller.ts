/**
 * Trace Dashboard Controller
 *
 * HTTP request handlers for the internal query tracing dashboard.
 * Provides visibility into the insight generation pipeline for debugging and monitoring.
 *
 * Note: All endpoints require admin authentication.
 */

import { type Request, type Response } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';

import type { Logger } from '../core/logger.js';
import type { TraceRepository } from '../repositories/trace.repository.js';

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

const listTracesQuerySchema = z.object({
  userId: z.coerce.number().optional(),
  status: z.enum(['started', 'completed', 'failed']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  hasErrors: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

const getStatsQuerySchema = z.object({
  // Accept both date (YYYY-MM-DD) and datetime formats
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const getPayloadQuerySchema = z.object({
  type: z.enum(['input', 'output']),
});

// ============================================================================
// CONTROLLER
// ============================================================================

export class TraceDashboardController {
  private readonly traceRepository: TraceRepository;
  private readonly logger: Logger;

  constructor({
    traceRepository,
    logger,
  }: {
    traceRepository: TraceRepository;
    logger: Logger;
  }) {
    this.traceRepository = traceRepository;
    this.logger = logger;
  }

  /**
   * GET /api/v2/admin/traces
   * List query traces with filtering and pagination
   */
  listTraces = async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = listTracesQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: fromZodError(parsed.error).message,
          },
        });
        return;
      }

      const { userId, status, startDate, endDate, hasErrors, limit, offset } = parsed.data;

      const result = await this.traceRepository.findTraces(
        {
          userId,
          status,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          hasErrors,
        },
        { limit, offset }
      );

      res.status(200).json({
        success: true,
        data: {
          traces: result.traces,
          pagination: {
            total: result.total,
            limit: result.limit,
            offset: result.offset,
          },
        },
      });
    } catch (error) {
      this.logger.error('Failed to list traces', { error });
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to list traces' },
      });
    }
  };

  /**
   * GET /api/v2/admin/traces/:traceId
   * Get detailed trace with all agent traces and data sources
   */
  getTraceDetails = async (req: Request, res: Response): Promise<void> => {
    try {
      const { traceId } = req.params;

      if (!traceId) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'traceId is required' },
        });
        return;
      }

      const trace = await this.traceRepository.getTraceWithAgents(traceId);

      if (!trace) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Trace not found' },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: trace,
      });
    } catch (error) {
      this.logger.error('Failed to get trace details', { error, traceId: req.params.traceId });
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get trace details' },
      });
    }
  };

  /**
   * GET /api/v2/admin/traces/:traceId/agents/:agentTraceId/payload
   * Get full payload for an agent trace (if stored)
   */
  getAgentPayload = async (req: Request, res: Response): Promise<void> => {
    try {
      const { agentTraceId } = req.params;

      const parsed = getPayloadQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: fromZodError(parsed.error).message,
          },
        });
        return;
      }

      const payload = await this.traceRepository.getAgentPayload(
        agentTraceId,
        parsed.data.type
      );

      if (!payload) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Payload not found' },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: payload,
      });
    } catch (error) {
      this.logger.error('Failed to get agent payload', {
        error,
        agentTraceId: req.params.agentTraceId,
      });
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get agent payload' },
      });
    }
  };

  /**
   * GET /api/v2/admin/traces/stats
   * Get aggregate statistics for monitoring
   */
  getStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const parsed = getStatsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: fromZodError(parsed.error).message,
          },
        });
        return;
      }

      const { startDate, endDate } = parsed.data;

      const stats = await this.traceRepository.getAggregateStats({
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      });

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      this.logger.error('Failed to get trace stats', { error });
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to get trace stats' },
      });
    }
  };
}
