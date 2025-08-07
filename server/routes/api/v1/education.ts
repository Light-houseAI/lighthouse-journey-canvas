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
import { educationCreateSchema, educationUpdateSchema, Project, ProjectCreateDTO } from '@shared/schema';
import { container, SERVICE_KEYS } from '../../../core/container';
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

// Nested routes for education child entities
// These routes handle parent-child relationships explicitly

/**
 * GET /api/v1/profiles/:profileId/education/:id/projects
 * Get all projects for a specific education record
 */
router.get(
  '/:id/projects',
  requireAuth,
  validate(educationIdSchema, 'params'),
  async (req, res) => {
    try {
      const { profileId, id } = req.params;
      const user = req.user; // Assume auth middleware sets this

      // Get education service from container
      const educationService = await container.resolve(SERVICE_KEYS.EDUCATION_SERVICE);

      // Get parent education node
      const parentEducation = await educationService.getById(parseInt(profileId), id);
      if (!parentEducation) {
        return res.status(404).json({
          success: false,
          error: { code: 'PARENT_NOT_FOUND', message: 'Parent education not found' }
        });
      }

      res.json({
        success: true,
        data: parentEducation.projects || []
      });
    } catch (error) {
      console.error('Error fetching education projects:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch education projects'
        }
      });
    }
  }
);

/**
 * POST /api/v1/profiles/:profileId/education/:id/projects
 * Create a new project under a specific education record
 */
router.post(
  '/:id/projects',
  requireAuth,
  validate(educationIdSchema, 'params'),
  async (req, res) => {
    try {
      const { profileId, id } = req.params;
      const projectData = req.body;
      const user = req.user;

      // Get education service from container
      const educationService = await container.resolve(SERVICE_KEYS.EDUCATION_SERVICE);

      // Get parent education node
      const parentEducation = await educationService.getById(parseInt(profileId), id);
      if (!parentEducation) {
        return res.status(404).json({
          success: false,
          error: { code: 'PARENT_NOT_FOUND', message: 'Parent education not found' }
        });
      }

      // Create the project with ID and timestamps
      const newProject: Project = {
        id: `project-${Date.now()}`,
        type: 'project' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...projectData
      };

      // Add project to parent's projects array
      const updatedProjects = [...(parentEducation.projects || []), newProject];

      // Update the parent education with new project
      const updatedEducation = await educationService.update(parseInt(profileId), id, {
        projects: updatedProjects
      });

      res.status(201).json({
        success: true,
        data: newProject
      });
    } catch (error) {
      console.error('Error creating education project:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create education project'
        }
      });
    }
  }
);

/**
 * GET /api/v1/profiles/:profileId/education/:id/events
 * Get all events for a specific education record
 */
router.get(
  '/:id/events',
  requireAuth,
  validate(educationIdSchema, 'params'),
  async (req, res) => {
    try {
      const { profileId, id } = req.params;

      // Get education service from container
      const educationService = await container.resolve(SERVICE_KEYS.EDUCATION_SERVICE);

      // Get parent education node
      const parentEducation = await educationService.getById(parseInt(profileId), id);
      if (!parentEducation) {
        return res.status(404).json({
          success: false,
          error: { code: 'PARENT_NOT_FOUND', message: 'Parent education not found' }
        });
      }

      res.json({
        success: true,
        data: parentEducation.events || []
      });
    } catch (error) {
      console.error('Error fetching education events:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch education events'
        }
      });
    }
  }
);

/**
 * POST /api/v1/profiles/:profileId/education/:id/events
 * Create a new event under a specific education record
 */
router.post(
  '/:id/events',
  requireAuth,
  validate(educationIdSchema, 'params'),
  async (req, res) => {
    try {
      const { profileId, id } = req.params;
      const eventData = req.body;

      // Get education service from container
      const educationService = await container.resolve(SERVICE_KEYS.EDUCATION_SERVICE);

      // Get parent education node
      const parentEducation = await educationService.getById(parseInt(profileId), id);
      if (!parentEducation) {
        return res.status(404).json({
          success: false,
          error: { code: 'PARENT_NOT_FOUND', message: 'Parent education not found' }
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
      const updatedEvents = [...(parentEducation.events || []), newEvent];

      // Update the parent education with new event
      const updatedEducation = await educationService.update(parseInt(profileId), id, {
        events: updatedEvents
      });

      res.status(201).json({
        success: true,
        data: newEvent
      });
    } catch (error) {
      console.error('Error creating education event:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create education event'
        }
      });
    }
  }
);

/**
 * GET /api/v1/profiles/:profileId/education/:id/actions
 * Get all actions for a specific education record
 */
router.get(
  '/:id/actions',
  requireAuth,
  validate(educationIdSchema, 'params'),
  async (req, res) => {
    try {
      const { profileId, id } = req.params;
      // Get education service from container
      const educationService = await container.resolve(SERVICE_KEYS.EDUCATION_SERVICE);

      // Get parent education node
      const parentEducation = await educationService.getById(parseInt(profileId), id);
      if (!parentEducation) {
        return res.status(404).json({
          success: false,
          error: { code: 'PARENT_NOT_FOUND', message: 'Parent education not found' }
        });
      }

      res.json({
        success: true,
        data: parentEducation.actions || []
      });
    } catch (error) {
      console.error('Error fetching education actions:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch education actions'
        }
      });
    }
  }
);

/**
 * POST /api/v1/profiles/:profileId/education/:id/actions
 * Create a new action under a specific education record
 */
router.post(
  '/:id/actions',
  requireAuth,
  validate(educationIdSchema, 'params'),
  async (req, res) => {
    try {
      const { profileId, id } = req.params;
      const actionData = req.body;

      // Get education service from container
      const educationService = await container.resolve(SERVICE_KEYS.EDUCATION_SERVICE);

      // Get parent education node
      const parentEducation = await educationService.getById(parseInt(profileId), id);
      if (!parentEducation) {
        return res.status(404).json({
          success: false,
          error: { code: 'PARENT_NOT_FOUND', message: 'Parent education not found' }
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
      const updatedActions = [...(parentEducation.actions || []), newAction];

      // Update the parent education with new action
      const updatedEducation = await educationService.update(parseInt(profileId), id, {
        actions: updatedActions
      });

      res.status(201).json({
        success: true,
        data: newAction
      });
    } catch (error) {
      console.error('Error creating education action:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create education action'
        }
      });
    }
  }
);

export default router;
