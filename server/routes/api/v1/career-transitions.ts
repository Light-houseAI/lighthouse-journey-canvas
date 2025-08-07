/**
 * Career Transitions Routes
 * 
 * Defines REST API routes for career transition operations.
 * All routes are prefixed with /api/v1/profiles/:profileId/career-transitions
 * 
 * NOTE: Only CRUD operations as per PRD requirements - no advanced query endpoints
 */

import { Router } from 'express';
import { requireAuth } from '../../../auth';
import { validate } from '../../../middleware/validation';
import { CareerTransitionController } from '../../../controllers/career-transition-controller';
import { careerTransitionCreateSchema, careerTransitionUpdateSchema } from '@shared/schema';
import { z } from 'zod';

// Parameter validation schemas
const profileIdSchema = z.object({
  profileId: z.string().regex(/^\d+$/, 'Profile ID must be a number').transform(Number),
});

const careerTransitionIdSchema = z.object({
  profileId: z.string().regex(/^\d+$/, 'Profile ID must be a number').transform(Number),
  id: z.string().min(1, 'Career transition ID is required'),
});

const router = Router({ mergeParams: true });

// Initialize controller (will be done in the main router)
let careerTransitionController: CareerTransitionController;

export function initializeCareerTransitionsRouter(controller: CareerTransitionController): Router {
  careerTransitionController = controller;
  return router;
}

/**
 * GET /api/v1/profiles/:profileId/career-transitions
 * Get all career transitions for a profile
 * 
 * Query parameters:
 * - page: number (default: 1)
 * - limit: number (default: 10, max: 100)
 * - sort: string (title|transitionType|startDate|fromCompany|toCompany)
 * - order: string (asc|desc, default: asc)
 */
router.get(
  '/',
  requireAuth,
  validate(profileIdSchema, 'params'),
  async (req, res) => {
    await careerTransitionController.list(req, res);
  }
);

/**
 * GET /api/v1/profiles/:profileId/career-transitions/:id
 * Get a specific career transition by ID
 */
router.get(
  '/:id',
  requireAuth,
  validate(careerTransitionIdSchema, 'params'),
  async (req, res) => {
    await careerTransitionController.getById(req, res);
  }
);

/**
 * POST /api/v1/profiles/:profileId/career-transitions
 * Create a new career transition
 */
router.post(
  '/',
  requireAuth,
  validate(profileIdSchema, 'params'),
  validate(careerTransitionCreateSchema, 'body'),
  async (req, res) => {
    await careerTransitionController.create(req, res);
  }
);

/**
 * PUT /api/v1/profiles/:profileId/career-transitions/:id
 * Update an existing career transition
 */
router.put(
  '/:id',
  requireAuth,
  validate(careerTransitionIdSchema, 'params'),
  validate(careerTransitionUpdateSchema, 'body'),
  async (req, res) => {
    await careerTransitionController.update(req, res);
  }
);

/**
 * DELETE /api/v1/profiles/:profileId/career-transitions/:id
 * Delete a career transition
 */
router.delete(
  '/:id',
  requireAuth,
  validate(careerTransitionIdSchema, 'params'),
  async (req, res) => {
    await careerTransitionController.delete(req, res);
  }
);

export default router;