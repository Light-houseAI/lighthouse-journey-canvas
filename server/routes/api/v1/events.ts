/**
 * Events Routes
 * 
 * Defines REST API routes for event operations.
 * All routes are prefixed with /api/v1/profiles/:profileId/events
 * 
 * NOTE: Only CRUD operations as per PRD requirements - no advanced query endpoints
 */

import { Router } from 'express';
import { requireAuth } from '../../../auth';
import { validate } from '../../../middleware/validation';
import { EventController } from '../../../controllers/event-controller';
import { eventCreateSchema, eventUpdateSchema } from '@shared/schema';
import { z } from 'zod';

// Parameter validation schemas
const profileIdSchema = z.object({
  profileId: z.string().regex(/^\d+$/, 'Profile ID must be a number').transform(Number),
});

const eventIdSchema = z.object({
  profileId: z.string().regex(/^\d+$/, 'Profile ID must be a number').transform(Number),
  id: z.string().min(1, 'Event ID is required'),
});

const router = Router({ mergeParams: true });

// Initialize controller (will be done in the main router)
let eventController: EventController;

export function initializeEventsRouter(controller: EventController): Router {
  eventController = controller;
  return router;
}

/**
 * GET /api/v1/profiles/:profileId/events
 * Get all events for a profile
 * 
 * Query parameters:
 * - page: number (default: 1)
 * - limit: number (default: 10, max: 100)
 * - sort: string (title|eventType|startDate|location|organizer)
 * - order: string (asc|desc, default: asc)
 */
router.get(
  '/',
  requireAuth,
  validate(profileIdSchema, 'params'),
  async (req, res) => {
    await eventController.list(req, res);
  }
);

/**
 * GET /api/v1/profiles/:profileId/events/:id
 * Get a specific event by ID
 */
router.get(
  '/:id',
  requireAuth,
  validate(eventIdSchema, 'params'),
  async (req, res) => {
    await eventController.getById(req, res);
  }
);

/**
 * POST /api/v1/profiles/:profileId/events
 * Create a new event
 */
router.post(
  '/',
  requireAuth,
  validate(profileIdSchema, 'params'),
  validate(eventCreateSchema, 'body'),
  async (req, res) => {
    await eventController.create(req, res);
  }
);

/**
 * PUT /api/v1/profiles/:profileId/events/:id
 * Update an existing event
 */
router.put(
  '/:id',
  requireAuth,
  validate(eventIdSchema, 'params'),
  validate(eventUpdateSchema, 'body'),
  async (req, res) => {
    await eventController.update(req, res);
  }
);

/**
 * DELETE /api/v1/profiles/:profileId/events/:id
 * Delete an event
 */
router.delete(
  '/:id',
  requireAuth,
  validate(eventIdSchema, 'params'),
  async (req, res) => {
    await eventController.delete(req, res);
  }
);

export default router;