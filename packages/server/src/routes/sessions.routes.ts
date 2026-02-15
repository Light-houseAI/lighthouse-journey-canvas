/**
 * Session Routes
 * API endpoints for desktop session management
 * (LIG-247: Desktop Session to Work Track Mapping)
 *
 * Endpoints:
 * - POST /api/v2/sessions/push        - Push session from desktop app
 * - GET  /api/v2/sessions             - List sessions with filters
 * - GET  /api/v2/sessions/categories  - Get category definitions
 * - POST /api/v2/sessions/:id/reclassify - Reclassify session
 * - POST /api/v2/sessions/:id/remap   - Remap session to different node
 * - POST /api/v2/sessions/feedback    - Submit RLHF feedback
 * - POST /api/v2/sessions/stitch-context - Pre-compute cumulative context stitching
 */

import { Router } from 'express';

import { CONTAINER_TOKENS } from '../core/container-tokens.js';
import { requireAuth, containerMiddleware } from '../middleware/index.js';

const router = Router();

// All session routes require authentication
router.use(requireAuth);

/**
 * @route POST /api/v2/sessions/push
 * @summary Push a session from desktop app
 * @description Receives session data from desktop app, classifies it into a work track category,
 *              and matches it to an existing timeline node or creates a new one.
 * @body {PushSessionRequest} Session data including summary and chapters
 * @response {201} {PushSessionResponse} Session pushed successfully
 * @response {400} {ApiErrorResponse} Validation error
 * @response {401} {ApiErrorResponse} Authentication required
 * @security BearerAuth
 */
router.post('/push', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.SESSION_CONTROLLER);
    await controller.pushSession(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v2/sessions
 * @summary List sessions
 * @description List all sessions for the authenticated user with optional filters
 * @query {ListSessionsQuery} Filtering and pagination options
 * @response {200} {ListSessionsResponse} Sessions list
 * @response {401} {ApiErrorResponse} Authentication required
 * @security BearerAuth
 */
router.get('/', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.SESSION_CONTROLLER);
    await controller.listSessions(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v2/sessions/categories
 * @summary Get category definitions
 * @description Get all 27 work track categories with their labels, node types, and groups
 * @response {200} {CategoriesResponse} Category definitions
 */
router.get('/categories', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.SESSION_CONTROLLER);
    await controller.getCategories(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/v2/sessions/:id/reclassify
 * @summary Reclassify a session
 * @description Change the category of a session (logs feedback for RLHF)
 * @param {string} id - Session mapping ID
 * @body {ReclassifySessionRequest} New category and optional reason
 * @response {200} {SessionUpdateResponse} Session reclassified
 * @response {400} {ApiErrorResponse} Validation error
 * @response {401} {ApiErrorResponse} Authentication required
 * @response {404} {ApiErrorResponse} Session not found
 * @security BearerAuth
 */
router.post('/:id/reclassify', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.SESSION_CONTROLLER);
    await controller.reclassifySession(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/v2/sessions/:id/remap
 * @summary Remap a session to different node
 * @description Change which timeline node a session is mapped to (logs feedback for RLHF)
 * @param {string} id - Session mapping ID
 * @body {RemapSessionRequest} New node ID and optional reason
 * @response {200} {SessionUpdateResponse} Session remapped
 * @response {400} {ApiErrorResponse} Validation error
 * @response {401} {ApiErrorResponse} Authentication required
 * @response {404} {ApiErrorResponse} Session not found
 * @security BearerAuth
 */
router.post('/:id/remap', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.SESSION_CONTROLLER);
    await controller.remapSession(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/v2/sessions/feedback
 * @summary Submit RLHF feedback
 * @description Submit explicit feedback for improving classification accuracy
 * @body {SubmitFeedbackRequest} Feedback data
 * @response {201} {SubmitFeedbackResponse} Feedback submitted
 * @response {400} {ApiErrorResponse} Validation error
 * @response {401} {ApiErrorResponse} Authentication required
 * @security BearerAuth
 */
router.post('/feedback', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.SESSION_CONTROLLER);
    await controller.submitFeedback(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/v2/sessions/stitch-context
 * @summary Pre-compute cumulative context stitching for a session
 * @description Called by the desktop app during the "analyzing" phase. Runs 3-tier
 *              context stitching (workstreams, tool mastery, pattern detection) using
 *              a chain-based O(1) approach that builds on the previous session's context.
 * @body {StitchContextRequest} Session data including summary, screenshots, gap analysis
 * @response {200} {PerSessionStitchedContext} Stitched context result
 * @response {400} {ApiErrorResponse} Validation error
 * @response {401} {ApiErrorResponse} Authentication required
 * @security BearerAuth
 */
router.post('/stitch-context', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { sessionId, workflowName, summary, screenshotDescriptions, gapAnalysis, appsUsed, startTime, endTime } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const service = req.scope.resolve(CONTAINER_TOKENS.CONTEXT_STITCHING_ENDPOINT_SERVICE);
    const stitchedContext = await service.stitchForNewSession(
      { sessionId, workflowName, summary, screenshotDescriptions, gapAnalysis, appsUsed: appsUsed || [], startTime, endTime },
      userId
    );

    return res.json({ stitchedContext });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/v2/sessions/progress-snapshot
 * @summary Generate LLM-powered progress snapshot
 * @description Generate an outcome-oriented progress snapshot for status updates
 * @body {GenerateProgressSnapshotRequest} Node ID, time range, and journey name
 * @response {200} {GenerateProgressSnapshotResponse} Snapshot generated successfully
 * @response {400} {ApiErrorResponse} Validation error
 * @response {401} {ApiErrorResponse} Authentication required
 * @security BearerAuth
 */
router.post('/progress-snapshot', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.SESSION_CONTROLLER);
    await controller.generateProgressSnapshot(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;


