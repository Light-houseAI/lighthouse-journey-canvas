/**
 * Desktop Track Routes
 * Mock API endpoints for desktop app track creation during onboarding
 *
 * Endpoints:
 * - POST /api/v2/desktop/track - Create a track from desktop app (mock for testing)
 */

import { Router } from 'express';

import { CONTROLLER_TOKENS } from '../core/container-tokens.js';
import { requireAuth, containerMiddleware } from '../middleware/index.js';

const router = Router();

// All desktop track routes require authentication
router.use(requireAuth, containerMiddleware);

/**
 * @route POST /api/v2/desktop/track
 * @summary Create a track from desktop app
 * @description Mock endpoint for receiving track data from the desktop app.
 *              Creates a job node with the provided company, role, and startDate.
 *              Automatically completes onboarding after first track is created.
 * @body {DesktopTrackRequest} Track data including companyName, role, startDate
 * @response {201} {DesktopTrackResponse} Track created successfully
 * @response {400} {ApiErrorResponse} Validation error
 * @response {401} {ApiErrorResponse} Authentication required
 * @security BearerAuth
 */
router.post('/track', async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTROLLER_TOKENS.DESKTOP_TRACK_CONTROLLER);
    await controller.createTrack(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;


