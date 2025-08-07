/**
 * Career Transition Routes
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
import { container, SERVICE_KEYS } from '../../../core/container';
import { z } from 'zod';

// Parameter validation schemas
const profileIdSchema = z.object({
  profileId: z.string().regex(/^\d+$/, 'Profile ID must be a number').transform(Number),
});

const careerTransitionIdSchema = z.object({
  profileId: z.string().regex(/^\d+$/, 'Profile ID must be a number').transform(Number),
  id: z.string().min(1, 'Career Transition ID is required'),
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
 * Get all career transition records for a profile
 *
 * Query parameters:
 * - page: number (default: 1)
 * - limit: number (default: 10, max: 100)
 * - sort: string (title|startDate|endDate)
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
 * Get a specific career transition record by ID
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
 * Create a new career transition record
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
 * Update an existing career transition record
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
 * Delete a career transition record
 */
router.delete(
  '/:id',
  requireAuth,
  validate(careerTransitionIdSchema, 'params'),
  async (req, res) => {
    await careerTransitionController.delete(req, res);
  }
);

// Nested routes for career transition child entities
// These routes handle parent-child relationships explicitly

/**
 * GET /api/v1/profiles/:profileId/career-transitions/:id/projects
 * Get all projects for a specific career transition record
 */
router.get(
  '/:id/projects',
  requireAuth,
  validate(careerTransitionIdSchema, 'params'),
  async (req, res) => {
    try {
      const { profileId, id } = req.params;
      const user = req.user;

      // Get career transition service from container
      const careerTransitionService = await container.resolve(SERVICE_KEYS.CAREER_TRANSITION_SERVICE);

      // Get parent career transition node
      const parentCareerTransition = await careerTransitionService.getById(parseInt(profileId), id);
      if (!parentCareerTransition) {
        return res.status(404).json({
          success: false,
          error: { code: 'PARENT_NOT_FOUND', message: 'Parent career transition not found' }
        });
      }

      res.json({
        success: true,
        data: parentCareerTransition.projects || []
      });
    } catch (error) {
      console.error('Error fetching career transition projects:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch career transition projects'
        }
      });
    }
  }
);

/**
 * POST /api/v1/profiles/:profileId/career-transitions/:id/projects
 * Create a new project under a specific career transition record
 */
router.post(
  '/:id/projects',
  requireAuth,
  validate(careerTransitionIdSchema, 'params'),
  async (req, res) => {
    try {
      const { profileId, id } = req.params;
      const projectData = req.body;
      const user = req.user;

      // Get career transition service from container
      const careerTransitionService = await container.resolve(SERVICE_KEYS.CAREER_TRANSITION_SERVICE);

      // Get parent career transition node
      const parentCareerTransition = await careerTransitionService.getById(parseInt(profileId), id);
      if (!parentCareerTransition) {
        return res.status(404).json({
          success: false,
          error: { code: 'PARENT_NOT_FOUND', message: 'Parent career transition not found' }
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
      const updatedProjects = [...(parentCareerTransition.projects || []), newProject];

      // Update the parent career transition with new project
      const updatedCareerTransition = await careerTransitionService.update(parseInt(profileId), id, {
        projects: updatedProjects
      });

      res.status(201).json({
        success: true,
        data: newProject
      });
    } catch (error) {
      console.error('Error creating career transition project:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create career transition project'
        }
      });
    }
  }
);

/**
 * GET /api/v1/profiles/:profileId/career-transitions/:id/events
 * Get all events for a specific career transition record
 */
router.get(
  '/:id/events',
  requireAuth,
  validate(careerTransitionIdSchema, 'params'),
  async (req, res) => {
    try {
      const { profileId, id } = req.params;

      // Get career transition service from container
      const careerTransitionService = await container.resolve(SERVICE_KEYS.CAREER_TRANSITION_SERVICE);

      // Get parent career transition node
      const parentCareerTransition = await careerTransitionService.getById(parseInt(profileId), id);
      if (!parentCareerTransition) {
        return res.status(404).json({
          success: false,
          error: { code: 'PARENT_NOT_FOUND', message: 'Parent career transition not found' }
        });
      }

      res.json({
        success: true,
        data: parentCareerTransition.events || []
      });
    } catch (error) {
      console.error('Error fetching career transition events:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch career transition events'
        }
      });
    }
  }
);

/**
 * POST /api/v1/profiles/:profileId/career-transitions/:id/events
 * Create a new event under a specific career transition record
 */
router.post(
  '/:id/events',
  requireAuth,
  validate(careerTransitionIdSchema, 'params'),
  async (req, res) => {
    try {
      const { profileId, id } = req.params;
      const eventData = req.body;

      // Get career transition service from container
      const careerTransitionService = await container.resolve(SERVICE_KEYS.CAREER_TRANSITION_SERVICE);

      // Get parent career transition node
      const parentCareerTransition = await careerTransitionService.getById(parseInt(profileId), id);
      if (!parentCareerTransition) {
        return res.status(404).json({
          success: false,
          error: { code: 'PARENT_NOT_FOUND', message: 'Parent career transition not found' }
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
      const updatedEvents = [...(parentCareerTransition.events || []), newEvent];

      // Update the parent career transition with new event
      const updatedCareerTransition = await careerTransitionService.update(parseInt(profileId), id, {
        events: updatedEvents
      });

      res.status(201).json({
        success: true,
        data: newEvent
      });
    } catch (error) {
      console.error('Error creating career transition event:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create career transition event'
        }
      });
    }
  }
);

/**
 * GET /api/v1/profiles/:profileId/career-transitions/:id/actions
 * Get all actions for a specific career transition record
 */
router.get(
  '/:id/actions',
  requireAuth,
  validate(careerTransitionIdSchema, 'params'),
  async (req, res) => {
    try {
      const { profileId, id } = req.params;
      // Get career transition service from container
      const careerTransitionService = await container.resolve(SERVICE_KEYS.CAREER_TRANSITION_SERVICE);

      // Get parent career transition node
      const parentCareerTransition = await careerTransitionService.getById(parseInt(profileId), id);
      if (!parentCareerTransition) {
        return res.status(404).json({
          success: false,
          error: { code: 'PARENT_NOT_FOUND', message: 'Parent career transition not found' }
        });
      }

      res.json({
        success: true,
        data: parentCareerTransition.actions || []
      });
    } catch (error) {
      console.error('Error fetching career transition actions:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch career transition actions'
        }
      });
    }
  }
);

/**
 * POST /api/v1/profiles/:profileId/career-transitions/:id/actions
 * Create a new action under a specific career transition record
 */
router.post(
  '/:id/actions',
  requireAuth,
  validate(careerTransitionIdSchema, 'params'),
  async (req, res) => {
    try {
      const { profileId, id } = req.params;
      const actionData = req.body;

      // Get career transition service from container
      const careerTransitionService = await container.resolve(SERVICE_KEYS.CAREER_TRANSITION_SERVICE);

      // Get parent career transition node
      const parentCareerTransition = await careerTransitionService.getById(parseInt(profileId), id);
      if (!parentCareerTransition) {
        return res.status(404).json({
          success: false,
          error: { code: 'PARENT_NOT_FOUND', message: 'Parent career transition not found' }
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
      const updatedActions = [...(parentCareerTransition.actions || []), newAction];

      // Update the parent career transition with new action
      const updatedCareerTransition = await careerTransitionService.update(parseInt(profileId), id, {
        actions: updatedActions
      });

      res.status(201).json({
        success: true,
        data: newAction
      });
    } catch (error) {
      console.error('Error creating career transition action:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create career transition action'
        }
      });
    }
  }
);

export default router;