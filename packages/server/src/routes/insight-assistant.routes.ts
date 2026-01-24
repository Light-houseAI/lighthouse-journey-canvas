/**
 * Insight Assistant Routes
 *
 * API endpoints for the Insight Assistant feature.
 *
 * Endpoints:
 * - POST /api/v2/insight-assistant/proposals          - Generate strategy proposals
 * - POST /api/v2/insight-assistant/proposals/:id/feedback - Submit proposal feedback
 * - GET  /api/v2/insight-assistant/proposals          - Get saved proposals
 *
 * Multi-Agent Insight Generation:
 * - POST /api/v2/insight-assistant/generate           - Start async insight generation job
 * - GET  /api/v2/insight-assistant/jobs/:jobId        - Get job status and result
 * - GET  /api/v2/insight-assistant/jobs/:jobId/stream - SSE stream for progress
 * - POST /api/v2/insight-assistant/quick-insights     - Sync quick analysis
 * - DELETE /api/v2/insight-assistant/jobs/:jobId      - Cancel a running job
 */

import { Router } from 'express';

import { CONTAINER_TOKENS } from '../core/container-tokens.js';
import { requireAuth, containerMiddleware } from '../middleware/index.js';

const router = Router();

// All insight assistant routes require authentication
router.use(requireAuth);

/**
 * @route POST /api/v2/insight-assistant/proposals
 * @summary Generate strategy proposals
 * @description Generate AI-powered strategy proposals based on workflow analysis
 * @body {GenerateProposalsRequest} Query and optional context for proposal generation
 * @response {200} {GenerateProposalsResponse} Generated proposals
 * @response {400} {ApiErrorResponse} Validation error
 * @response {401} {ApiErrorResponse} Authentication required
 * @security BearerAuth
 */
router.post('/proposals', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.INSIGHT_ASSISTANT_CONTROLLER);
    await controller.generateProposals(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v2/insight-assistant/proposals
 * @summary Get saved proposals
 * @description Get saved/bookmarked strategy proposals for the user
 * @query {GetProposalsQuery} Filtering and pagination options
 * @response {200} {GetProposalsResponse} Proposal list
 * @response {401} {ApiErrorResponse} Authentication required
 * @security BearerAuth
 */
router.get('/proposals', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.INSIGHT_ASSISTANT_CONTROLLER);
    await controller.getProposals(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/v2/insight-assistant/proposals/:id/feedback
 * @summary Submit proposal feedback
 * @description Submit feedback (thumbs up/down, bookmark) for a strategy proposal
 * @param {string} id - Proposal ID
 * @body {ProposalFeedbackRequest} Feedback data
 * @response {200} {ProposalFeedbackResponse} Feedback submitted
 * @response {401} {ApiErrorResponse} Authentication required
 * @response {404} {ApiErrorResponse} Proposal not found
 * @security BearerAuth
 */
router.post('/proposals/:id/feedback', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.INSIGHT_ASSISTANT_CONTROLLER);
    await controller.submitFeedback(req, res);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// MULTI-AGENT INSIGHT GENERATION ROUTES
// ============================================================================

/**
 * @route POST /api/v2/insight-assistant/generate
 * @summary Start async insight generation job
 * @description Start a multi-agent insight generation job that analyzes workflows
 * @body {GenerateInsightsRequest} Query and options for insight generation
 * @response {202} {GenerateInsightsResponse} Job started
 * @response {400} {ApiErrorResponse} Validation error
 * @response {401} {ApiErrorResponse} Authentication required
 * @security BearerAuth
 */
router.post('/generate', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.INSIGHT_ASSISTANT_CONTROLLER);
    await controller.generateInsights(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v2/insight-assistant/jobs/:jobId
 * @summary Get job status and result
 * @description Get the status and result of an insight generation job
 * @param {string} jobId - Job ID
 * @response {200} {InsightJob} Job details
 * @response {401} {ApiErrorResponse} Authentication required
 * @response {404} {ApiErrorResponse} Job not found
 * @security BearerAuth
 */
router.get('/jobs/:jobId', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.INSIGHT_ASSISTANT_CONTROLLER);
    await controller.getJob(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v2/insight-assistant/jobs/:jobId/stream
 * @summary SSE stream for job progress
 * @description Get real-time progress updates for an insight generation job
 * @param {string} jobId - Job ID
 * @response {200} {text/event-stream} Progress updates
 * @response {401} {ApiErrorResponse} Authentication required
 * @response {404} {ApiErrorResponse} Job not found
 * @security BearerAuth
 */
router.get('/jobs/:jobId/stream', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.INSIGHT_ASSISTANT_CONTROLLER);
    await controller.streamJobProgress(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/v2/insight-assistant/quick-insights
 * @summary Generate quick insights synchronously
 * @description Generate quick insights without async job management
 * @body {GenerateInsightsRequest} Query and options
 * @response {200} {InsightGenerationResult} Generated insights
 * @response {400} {ApiErrorResponse} Validation error
 * @response {401} {ApiErrorResponse} Authentication required
 * @security BearerAuth
 */
router.post('/quick-insights', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.INSIGHT_ASSISTANT_CONTROLLER);
    await controller.quickInsights(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /api/v2/insight-assistant/jobs/:jobId
 * @summary Cancel a running job
 * @description Cancel an insight generation job that is still processing
 * @param {string} jobId - Job ID
 * @response {200} {CancelJobResponse} Cancellation result
 * @response {401} {ApiErrorResponse} Authentication required
 * @response {404} {ApiErrorResponse} Job not found
 * @security BearerAuth
 */
router.delete('/jobs/:jobId', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.INSIGHT_ASSISTANT_CONTROLLER);
    await controller.cancelJob(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
