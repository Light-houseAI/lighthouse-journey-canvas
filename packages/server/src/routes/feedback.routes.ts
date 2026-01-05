/**
 * Feedback Routes
 * API endpoints for user feedback (thumbs up/down)
 *
 * Endpoints:
 * - POST /api/v2/feedback         - Submit feedback
 * - GET  /api/v2/feedback         - List feedback
 * - GET  /api/v2/feedback/stats   - Get feedback statistics
 * - DELETE /api/v2/feedback/:id   - Delete feedback
 */

import { Router } from 'express';

import { CONTAINER_TOKENS } from '../core/container-tokens.js';
import { requireAuth, containerMiddleware } from '../middleware/index.js';

const router = Router();

// All feedback routes require authentication
router.use(requireAuth);

/**
 * @route POST /api/v2/feedback
 * @summary Submit feedback for a feature
 * @description Submit thumbs up/down feedback for desktop summary or web analysis features
 * @body {SubmitUserFeedbackRequest} Feedback data including rating and feature type
 * @response {201} {SubmitUserFeedbackResponse} Feedback submitted successfully
 * @response {400} {ApiErrorResponse} Validation error
 * @response {401} {ApiErrorResponse} Authentication required
 * @security BearerAuth
 */
router.post('/', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.USER_FEEDBACK_CONTROLLER);
    await controller.submitFeedback(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v2/feedback
 * @summary List feedback
 * @description List all feedback for the authenticated user with optional filters
 * @query {ListFeedbackQuery} Filtering and pagination options
 * @response {200} {ListFeedbackResponse} Feedback list
 * @response {401} {ApiErrorResponse} Authentication required
 * @security BearerAuth
 */
router.get('/', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.USER_FEEDBACK_CONTROLLER);
    await controller.listFeedback(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v2/feedback/stats
 * @summary Get feedback statistics
 * @description Get aggregate statistics for user feedback
 * @query {featureType} Optional filter by feature type
 * @response {200} {FeedbackStats} Feedback statistics
 * @response {401} {ApiErrorResponse} Authentication required
 * @security BearerAuth
 */
router.get('/stats', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.USER_FEEDBACK_CONTROLLER);
    await controller.getStats(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /api/v2/feedback/:id
 * @summary Delete feedback
 * @description Delete a specific feedback entry
 * @param {string} id - Feedback ID
 * @response {200} {Object} Feedback deleted successfully
 * @response {401} {ApiErrorResponse} Authentication required
 * @response {404} {ApiErrorResponse} Feedback not found
 * @security BearerAuth
 */
router.delete('/:id', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.USER_FEEDBACK_CONTROLLER);
    await controller.deleteFeedback(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
