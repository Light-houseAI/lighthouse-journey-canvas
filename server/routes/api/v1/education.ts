/**
 * Education Routes
 *
 * Defines REST API routes for education operations.
 * All routes are prefixed with /api/v1/profiles/:profileId/education
 *
 * NOTE: Only CRUD operations as per PRD requirements - no advanced query endpoints
 */

import { Router } from 'express';
import { requireAuth } from '../../../auth';
import { validate } from '../../../middleware/validation';
import { EducationController } from '../../../controllers/education-controller';
import { educationCreateSchema, educationUpdateSchema } from '@shared/schema';
import { z } from 'zod';

// Parameter validation schemas
const profileIdSchema = z.object({
  profileId: z.string().regex(/^\d+$/, 'Profile ID must be a number').transform(Number),
});

const educationIdSchema = z.object({
  profileId: z.string().regex(/^\d+$/, 'Profile ID must be a number').transform(Number),
  id: z.string().min(1, 'Education ID is required'),
});

const router = Router({ mergeParams: true });

// Initialize controller (will be done in the main router)
let educationController: EducationController;

export function initializeEducationRouter(controller: EducationController): Router {
  educationController = controller;
  return router;
}

/**
 * GET /api/v1/profiles/:profileId/education
 * Get all education records for a profile
 *
 * Query parameters:
 * - page: number (default: 1)
 * - limit: number (default: 10, max: 100)
 * - sort: string (title|institution|startDate|endDate)
 * - order: string (asc|desc, default: asc)
 */
router.get(
  '/',
  requireAuth,
  validate(profileIdSchema, 'params'),
  async (req, res) => {
    await educationController.list(req, res);
  }
);

/**
 * GET /api/v1/profiles/:profileId/education/:id
 * Get a specific education record by ID
 */
router.get(
  '/:id',
  requireAuth,
  validate(educationIdSchema, 'params'),
  async (req, res) => {
    await educationController.getById(req, res);
  }
);

/**
 * POST /api/v1/profiles/:profileId/education
 * Create a new education record
 */
router.post(
  '/',
  requireAuth,
  validate(profileIdSchema, 'params'),
  validate(educationCreateSchema, 'body'),
  async (req, res) => {
    await educationController.create(req, res);
  }
);

/**
 * PUT /api/v1/profiles/:profileId/education/:id
 * Update an existing education record
 */
router.put(
  '/:id',
  requireAuth,
  validate(educationIdSchema, 'params'),
  validate(educationUpdateSchema, 'body'),
  async (req, res) => {
    await educationController.update(req, res);
  }
);

/**
 * DELETE /api/v1/profiles/:profileId/education/:id
 * Delete an education record
 */
router.delete(
  '/:id',
  requireAuth,
  validate(educationIdSchema, 'params'),
  async (req, res) => {
    await educationController.delete(req, res);
  }
);

export default router;
