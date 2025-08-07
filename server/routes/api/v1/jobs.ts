/**
 * Job Routes
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
import { container, SERVICE_KEYS } from '../../../core/container';
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
 * Get all job records for a profile
 *
 * Query parameters:
 * - page: number (default: 1)
 * - limit: number (default: 10, max: 100)
 * - sort: string (title|company|startDate|endDate)
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
 * Get a specific job record by ID
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
 * Create a new job record
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
 * Update an existing job record
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
 * Delete a job record
 */
router.delete(
  '/:id',
  requireAuth,
  validate(jobIdSchema, 'params'),
  async (req, res) => {
    await jobController.delete(req, res);
  }
);

// Nested routes for job child entities
// These routes handle parent-child relationships explicitly

/**
 * GET /api/v1/profiles/:profileId/jobs/:id/projects
 * Get all projects for a specific job record
 */
router.get(
'/:id/projects',
  requireAuth,
  validate(jobIdSchema, 'params'),
  async (req, res) => {
    try {
      const { profileId, id } = req.params;
      const user = req.user;

      // Get job service from container
      const jobService = await container.resolve(SERVICE_KEYS.JOB_SERVICE);

      // Get parent job node
      const parentJob = await jobService.getById(parseInt(profileId), id);
      if (!parentJob) {
        return res.status(404).json({
          success: false,
          error: { code: 'PARENT_NOT_FOUND', message: 'Parent job not found' }
        });
      }

      res.json({
        success: true,
        data: parentJob.projects || []
      });
    } catch (error) {
      console.error('Error fetching job projects:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch job projects'
        }
      });
    }
  }
);

/**
 * POST /api/v1/profiles/:profileId/jobs/:id/projects
 * Create a new project under a specific job record
 */
router.post(
  '/:id/projects',
  requireAuth,
  validate(jobIdSchema, 'params'),
  async (req, res) => {
    try {
      const { profileId, id } = req.params;
      const projectData = req.body;
      const user = req.user;

      // Get job service from container
      const jobService = await container.resolve(SERVICE_KEYS.JOB_SERVICE);

      // Get parent job node
      const parentJob = await jobService.getById(parseInt(profileId), id);
      if (!parentJob) {
        return res.status(404).json({
          success: false,
          error: { code: 'PARENT_NOT_FOUND', message: 'Parent job not found' }
        });
      }

      // Create the project with ID and timestamps
      const newProject = {
        id: `project-${Date.now()}`,
        type: 'project' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...projectData
      };

      // Add project to parent's projects array
      const updatedProjects = [...(parentJob.projects || []), newProject];

      // Update the parent job with new project
      const updatedJob = await jobService.update(parseInt(profileId), id, {
        projects: updatedProjects
      });

      res.status(201).json({
        success: true,
        data: newProject
      });
    } catch (error) {
      console.error('Error creating job project:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create job project'
        }
      });
    }
  }
);

/**
 * GET /api/v1/profiles/:profileId/jobs/:id/events
 * Get all events for a specific job record
 */
router.get(
  '/:id/events',
  requireAuth,
  validate(jobIdSchema, 'params'),
  async (req, res) => {
    try {
      const { profileId, id } = req.params;

      // Get job service from container
      const jobService = await container.resolve(SERVICE_KEYS.JOB_SERVICE);

      // Get parent job node
      const parentJob = await jobService.getById(parseInt(profileId), id);
      if (!parentJob) {
        return res.status(404).json({
          success: false,
          error: { code: 'PARENT_NOT_FOUND', message: 'Parent job not found' }
        });
      }

      res.json({
        success: true,
        data: parentJob.events || []
      });
    } catch (error) {
      console.error('Error fetching job events:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch job events'
        }
      });
    }
  }
);

/**
 * POST /api/v1/profiles/:profileId/jobs/:id/events
 * Create a new event under a specific job record
 */
router.post(
  '/:id/events',
  requireAuth,
  validate(jobIdSchema, 'params'),
  async (req, res) => {
    try {
      const { profileId, id } = req.params;
      const eventData = req.body;

      // Get job service from container
      const jobService = await container.resolve(SERVICE_KEYS.JOB_SERVICE);

      // Get parent job node
      const parentJob = await jobService.getById(parseInt(profileId), id);
      if (!parentJob) {
        return res.status(404).json({
          success: false,
          error: { code: 'PARENT_NOT_FOUND', message: 'Parent job not found' }
        });
      }

      // Create the event with ID and timestamps
      const newEvent = {
        id: `event-${Date.now()}`,
        type: 'event' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...eventData
      };

      // Add event to parent's events array
      const updatedEvents = [...(parentJob.events || []), newEvent];

      // Update the parent job with new event
      const updatedJob = await jobService.update(parseInt(profileId), id, {
        events: updatedEvents
      });

      res.status(201).json({
        success: true,
        data: newEvent
      });
    } catch (error) {
      console.error('Error creating job event:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create job event'
        }
      });
    }
  }
);

/**
 * GET /api/v1/profiles/:profileId/jobs/:id/actions
 * Get all actions for a specific job record
 */
router.get(
  '/:id/actions',
  requireAuth,
  validate(jobIdSchema, 'params'),
  async (req, res) => {
    try {
      const { profileId, id } = req.params;
      // Get job service from container
      const jobService = await container.resolve(SERVICE_KEYS.JOB_SERVICE);

      // Get parent job node
      const parentJob = await jobService.getById(parseInt(profileId), id);
      if (!parentJob) {
        return res.status(404).json({
          success: false,
          error: { code: 'PARENT_NOT_FOUND', message: 'Parent job not found' }
        });
      }

      res.json({
        success: true,
        data: parentJob.actions || []
      });
    } catch (error) {
      console.error('Error fetching job actions:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch job actions'
        }
      });
    }
  }
);

/**
 * POST /api/v1/profiles/:profileId/jobs/:id/actions
 * Create a new action under a specific job record
 */
router.post(
  '/:id/actions',
  requireAuth,
  validate(jobIdSchema, 'params'),
  async (req, res) => {
    try {
      const { profileId, id } = req.params;
      const actionData = req.body;

      // Get job service from container
      const jobService = await container.resolve(SERVICE_KEYS.JOB_SERVICE);

      // Get parent job node
      const parentJob = await jobService.getById(parseInt(profileId), id);
      if (!parentJob) {
        return res.status(404).json({
          success: false,
          error: { code: 'PARENT_NOT_FOUND', message: 'Parent job not found' }
        });
      }

      // Create the action with ID and timestamps
      const newAction = {
        id: `action-${Date.now()}`,
        type: 'action' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...actionData
      };

      // Add action to parent's actions array
      const updatedActions = [...(parentJob.actions || []), newAction];

      // Update the parent job with new action
      const updatedJob = await jobService.update(parseInt(profileId), id, {
        actions: updatedActions
      });

      res.status(201).json({
        success: true,
        data: newAction
      });
    } catch (error) {
      console.error('Error creating job action:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create job action'
        }
      });
    }
  }
);

export default router;
