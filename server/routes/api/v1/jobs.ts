/**
 * Jobs Routes
 * 
 * Defines REST API routes for job operations.
 * All routes are prefixed with /api/v1/profiles/:profileId/jobs
 * 
 * NOTE: Only CRUD operations as per PRD requirements - no advanced query endpoints
 */

import { Router } from 'express';
import { requireAuth } from '../../../auth';
import { validate } from '../../../middleware/validation';
import { JobController } from '../../../controllers/job-controller';
import { jobCreateSchema, jobUpdateSchema } from '@shared/schema';
import { z } from 'zod';

// Parameter validation schemas
const profileIdSchema = z.object({
  profileId: z.string().regex(/^\d+$/, 'Profile ID must be a number').transform(Number),
});

const jobIdSchema = z.object({
  profileId: z.string().regex(/^\d+$/, 'Profile ID must be a number').transform(Number),
  id: z.string().min(1, 'Job ID is required'),
});

const router = Router({ mergeParams: true });

// Initialize controller (will be done in the main router)
let jobController: JobController;

export function initializeJobsRouter(controller: JobController): Router {
  jobController = controller;
  return router;
}

/**
 * GET /api/v1/profiles/:profileId/jobs
 * Get all jobs for a profile
 * 
 * Query parameters:
 * - page: number (default: 1)
 * - limit: number (default: 10, max: 100)
 * - sort: string (title|company|position|startDate|endDate)
 * - order: string (asc|desc, default: asc)
 */
router.get(
  '/',
  requireAuth,
  validate(profileIdSchema, 'params'),
  async (req, res) => {
    await jobController.list(req, res);
  }
);

/**
 * GET /api/v1/profiles/:profileId/jobs/:id
 * Get a specific job by ID
 */
router.get(
  '/:id',
  requireAuth,
  validate(jobIdSchema, 'params'),
  async (req, res) => {
    await jobController.getById(req, res);
  }
);

/**
 * POST /api/v1/profiles/:profileId/jobs
 * Create a new job
 */
router.post(
  '/',
  requireAuth,
  validate(profileIdSchema, 'params'),
  validate(jobCreateSchema, 'body'),
  async (req, res) => {
    await jobController.create(req, res);
  }
);

/**
 * PUT /api/v1/profiles/:profileId/jobs/:id
 * Update an existing job
 */
router.put(
  '/:id',
  requireAuth,
  validate(jobIdSchema, 'params'),
  validate(jobUpdateSchema, 'body'),
  async (req, res) => {
    await jobController.update(req, res);
  }
);

/**
 * DELETE /api/v1/profiles/:profileId/jobs/:id
 * Delete a job
 */
router.delete(
  '/:id',
  requireAuth,
  validate(jobIdSchema, 'params'),
  async (req, res) => {
    await jobController.delete(req, res);
  }
);

export default router;