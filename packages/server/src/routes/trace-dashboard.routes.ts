/**
 * Trace Dashboard Routes
 *
 * Admin-only API endpoints for the internal query tracing dashboard.
 * Provides visibility into the insight generation pipeline.
 *
 * Endpoints:
 * - GET  /api/v2/admin/traces           - List query traces with filtering
 * - GET  /api/v2/admin/traces/stats     - Get aggregate statistics
 * - GET  /api/v2/admin/traces/:traceId  - Get detailed trace with agents
 * - GET  /api/v2/admin/traces/:traceId/agents/:agentTraceId/payload - Get full payload
 */

import { Router } from 'express';

import { CONTAINER_TOKENS } from '../core/container-tokens.js';
import { requireAuth, containerMiddleware, requireAdmin } from '../middleware/index.js';

const router = Router();

// All trace dashboard routes require authentication and admin role
router.use(requireAuth);
router.use(requireAdmin);

/**
 * @route GET /api/v2/admin/traces
 * @summary List query traces
 * @description List query traces with filtering and pagination
 * @query {userId} Filter by user ID
 * @query {status} Filter by status (started, completed, failed)
 * @query {startDate} Filter by start date (ISO 8601)
 * @query {endDate} Filter by end date (ISO 8601)
 * @query {hasErrors} Filter by error presence (true/false)
 * @query {limit} Page size (default 50, max 100)
 * @query {offset} Offset for pagination
 * @response {200} {TraceListResponse} List of traces with pagination
 * @response {401} {ApiErrorResponse} Authentication required
 * @response {403} {ApiErrorResponse} Admin access required
 * @security BearerAuth
 */
router.get('/traces', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.TRACE_DASHBOARD_CONTROLLER);
    await controller.listTraces(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v2/admin/traces/stats
 * @summary Get aggregate statistics
 * @description Get aggregate statistics for the query tracing dashboard
 * @query {startDate} Start of date range (ISO 8601)
 * @query {endDate} End of date range (ISO 8601)
 * @response {200} {AggregateStatsResponse} Aggregate statistics
 * @response {401} {ApiErrorResponse} Authentication required
 * @response {403} {ApiErrorResponse} Admin access required
 * @security BearerAuth
 */
router.get('/traces/stats', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.TRACE_DASHBOARD_CONTROLLER);
    await controller.getStats(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v2/admin/traces/:traceId
 * @summary Get trace details
 * @description Get detailed trace information with all agent traces and data sources
 * @param {traceId} UUID of the query trace
 * @response {200} {TraceDetailResponse} Full trace details
 * @response {404} {ApiErrorResponse} Trace not found
 * @response {401} {ApiErrorResponse} Authentication required
 * @response {403} {ApiErrorResponse} Admin access required
 * @security BearerAuth
 */
router.get('/traces/:traceId', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.TRACE_DASHBOARD_CONTROLLER);
    await controller.getTraceDetails(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v2/admin/traces/:traceId/agents/:agentTraceId/payload
 * @summary Get agent payload
 * @description Get full input/output payload for an agent trace (if stored)
 * @param {traceId} UUID of the query trace
 * @param {agentTraceId} UUID of the agent trace
 * @query {type} Payload type (input or output)
 * @response {200} {PayloadResponse} Full payload data
 * @response {404} {ApiErrorResponse} Payload not found
 * @response {401} {ApiErrorResponse} Authentication required
 * @response {403} {ApiErrorResponse} Admin access required
 * @security BearerAuth
 */
router.get(
  '/traces/:traceId/agents/:agentTraceId/payload',
  containerMiddleware,
  async (req: any, res: any, next: any) => {
    try {
      const controller = req.scope.resolve(CONTAINER_TOKENS.TRACE_DASHBOARD_CONTROLLER);
      await controller.getAgentPayload(req, res);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
