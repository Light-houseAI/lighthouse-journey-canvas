/**
 * Experience Matches Routes (LIG-179)
 *
 * Route definitions for experience matches endpoints.
 * Integrates with Awilix DI container for dependency injection.
 */

import { Router } from 'express';
import { CONTROLLER_TOKENS } from '../core/container-tokens.js';
import {
  containerMiddleware,
  requireAuth,
  validateRequestSize,
} from '../middleware/index.js';

const router: any = Router();

// Apply middleware to all routes
router.use(requireAuth, validateRequestSize, containerMiddleware);

/**
 * GET /api/v2/experience/:nodeId/matches
 * Get matches for an experience node
 *
 * Response:
 * - 200: Success with match data
 * - 400: Invalid request (bad UUID)
 * - 401: Authentication required
 * - 403: Access denied (node belongs to another user)
 * - 404: Node not found
 * - 422: Not an experience node (not job or education)
 * - 503: Search service unavailable
 */
router.get('/:nodeId/matches', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.EXPERIENCE_MATCHES_CONTROLLER
  );
  await controller.getMatches(req, res);
});

/**
 * GET /api/v2/experience/:nodeId/search-query
 * Get just the search query for an experience node
 * (Optional endpoint - useful for getting query without full match data)
 *
 * Response:
 * - 200: Success with search query
 * - 400: Invalid request (bad UUID)
 * - 401: Authentication required
 * - 404: Node not found or not a current experience
 */
router.get('/:nodeId/search-query', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.EXPERIENCE_MATCHES_CONTROLLER
  );
  await controller.getSearchQuery(req, res);
});

export default router;