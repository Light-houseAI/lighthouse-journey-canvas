/**
 * Project Routes
 *
 * Defines REST API routes for project operations.
 * All routes are prefixed with /api/v1/profiles/:profileId/projects
 *
 * NOTE: Only CRUD operations as per PRD requirements - no advanced query endpoints
 */

import { Router } from 'express';
import { requireAuth } from '../../../auth';
import { validate } from '../../../middleware/validation';
import { ProjectController } from '../../../controllers/project-controller';
import { projectCreateSchema, projectNodeUpdateSchema } from '@shared/schema';
import { container, SERVICE_KEYS } from '../../../core/container';
import { z } from 'zod';

// Parameter validation schemas
const profileIdSchema = z.object({
  profileId: z.string().regex(/^\d+$/, 'Profile ID must be a number').transform(Number),
});

const projectIdSchema = z.object({
  profileId: z.string().regex(/^\d+$/, 'Profile ID must be a number').transform(Number),
  id: z.string().min(1, 'Project ID is required'),
});

const router = Router({ mergeParams: true });

// Initialize controller (will be done in the main router)
let projectController: ProjectController;

export function initializeProjectsRouter(controller: ProjectController): Router {
  projectController = controller;
  return router;
}

/**
 * GET /api/v1/profiles/:profileId/projects
 * Get all project records for a profile
 *
 * Query parameters:
 * - page: number (default: 1)
 * - limit: number (default: 10, max: 100)
 * - sort: string (title|projectType|startDate|endDate)
 * - order: string (asc|desc, default: asc)
 */
router.get(
  '/',
  requireAuth,
  validate(profileIdSchema, 'params'),
  async (req, res) => {
    await projectController.list(req, res);
  }
);

/**
 * GET /api/v1/profiles/:profileId/projects/:id
 * Get a specific project record by ID
 */
router.get(
  '/:id',
  requireAuth,
  validate(projectIdSchema, 'params'),
  async (req, res) => {
    await projectController.getById(req, res);
  }
);

/**
 * POST /api/v1/profiles/:profileId/projects
 * Create a new project record
 */
router.post(
  '/',
  requireAuth,
  validate(profileIdSchema, 'params'),
  validate(projectCreateSchema, 'body'),
  async (req, res) => {
    await projectController.create(req, res);
  }
);

/**
 * PUT /api/v1/profiles/:profileId/projects/:id
 * Update an existing project record
 */
router.put(
  '/:id',
  requireAuth,
  validate(projectIdSchema, 'params'),
  validate(projectNodeUpdateSchema, 'body'),
  async (req, res) => {
    await projectController.update(req, res);
  }
);

/**
 * DELETE /api/v1/profiles/:profileId/projects/:id
 * Delete a project record
 */
router.delete(
  '/:id',
  requireAuth,
  validate(projectIdSchema, 'params'),
  async (req, res) => {
    await projectController.delete(req, res);
  }
);

export default router;