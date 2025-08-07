/**
 * Actions Routes
 * 
 * Defines REST API routes for action operations.
 * All routes are prefixed with /api/v1/profiles/:profileId/actions
 * 
 * NOTE: Only CRUD operations as per PRD requirements - no advanced query endpoints
 */

import { Router } from 'express';
import { requireAuth } from '../../../auth';
import { validate } from '../../../middleware/validation';
import { ActionController } from '../../../controllers/action-controller';
import { actionCreateSchema, actionUpdateSchema } from '@shared/schema';
import { z } from 'zod';

// Parameter validation schemas
const profileIdSchema = z.object({
  profileId: z.string().regex(/^\d+$/, 'Profile ID must be a number').transform(Number),
});

const actionIdSchema = z.object({
  profileId: z.string().regex(/^\d+$/, 'Profile ID must be a number').transform(Number),
  id: z.string().min(1, 'Action ID is required'),
});

const router = Router({ mergeParams: true });

// Initialize controller (will be done in the main router)
let actionController: ActionController;

export function initializeActionsRouter(controller: ActionController): Router {
  actionController = controller;
  return router;
}

/**
 * GET /api/v1/profiles/:profileId/actions
 * Get all actions for a profile
 * 
 * Query parameters:
 * - page: number (default: 1)
 * - limit: number (default: 10, max: 100)
 * - sort: string (title|actionType|category|status|startDate|endDate)
 * - order: string (asc|desc, default: asc)
 */
router.get(
  '/',
  requireAuth,
  validate(profileIdSchema, 'params'),
  async (req, res) => {
    await actionController.list(req, res);
  }
);

/**
 * GET /api/v1/profiles/:profileId/actions/:id
 * Get a specific action by ID
 */
router.get(
  '/:id',
  requireAuth,
  validate(actionIdSchema, 'params'),
  async (req, res) => {
    await actionController.getById(req, res);
  }
);

/**
 * POST /api/v1/profiles/:profileId/actions
 * Create a new action
 */
router.post(
  '/',
  requireAuth,
  validate(profileIdSchema, 'params'),
  validate(actionCreateSchema, 'body'),
  async (req, res) => {
    await actionController.create(req, res);
  }
);

/**
 * PUT /api/v1/profiles/:profileId/actions/:id
 * Update an existing action
 */
router.put(
  '/:id',
  requireAuth,
  validate(actionIdSchema, 'params'),
  validate(actionUpdateSchema, 'body'),
  async (req, res) => {
    await actionController.update(req, res);
  }
);

/**
 * DELETE /api/v1/profiles/:profileId/actions/:id
 * Delete an action
 */
router.delete(
  '/:id',
  requireAuth,
  validate(actionIdSchema, 'params'),
  async (req, res) => {
    await actionController.delete(req, res);
  }
);

export default router;