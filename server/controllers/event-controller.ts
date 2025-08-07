/**
 * Event Controller
 * 
 * Handles REST API endpoints for event management.
 * Provides CRUD operations with proper validation and error handling.
 * 
 * NOTE: This controller ONLY includes basic CRUD operations as per PRD requirements.
 * All advanced query endpoints have been removed.
 */

import { Request, Response } from 'express';
import { BaseController } from './base-controller';
import { container, SERVICE_KEYS } from '../core/container';
import { EventService } from '../services/event-service';
import { ValidationError, NotFoundError } from '../services/base-service';
import type { EventCreateDTO, EventUpdateDTO } from '@shared/schema';

/**
 * Event Controller
 * 
 * Extends BaseController with event specific endpoints
 */
export class EventController extends BaseController {
  private eventService: EventService;

  constructor() {
    super();
    // Service will be injected via container
  }

  /**
   * Initialize the controller with dependencies from the container
   */
  async initialize(): Promise<void> {
    this.eventService = await container.resolve<EventService>(
      SERVICE_KEYS.EVENT_SERVICE
    );
  }

  /**
   * GET /api/v1/profiles/:profileId/events
   * Get all events for a profile
   */
  async list(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      // Parse query parameters
      const { page, limit, offset } = this.parsePagination(req.query);
      const { field, order } = this.parseSorting(req.query, ['title', 'eventType', 'startDate', 'location', 'organizer']);
      
      // Check if filtering by parentExperienceId (for nested endpoint compatibility)
      const parentExperienceId = req.query.parentExperienceId as string;
      
      // Get all events, then filter by parent if specified
      let events = await this.eventService.getAllSorted(profileId);
      
      if (parentExperienceId) {
        events = events.filter(event => event.parentNode?.id === parentExperienceId);
      }
      
      // Apply pagination
      const total = events.length;
      const paginatedResults = events.slice(offset, offset + limit);
      
      return this.handleSuccess(res, paginatedResults, 200, {
        total,
        page,
        limit,
      });
      
    } catch (error) {
      console.error('Error getting events:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * GET /api/v1/profiles/:profileId/events/:id
   * Get a specific event by ID
   */
  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const eventId = req.params.id;
      
      if (!eventId) {
        throw new ValidationError('Event ID is required');
      }
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const event = await this.eventService.getById(profileId, eventId);
      
      if (!event) {
        throw new NotFoundError('Event', eventId);
      }
      
      return this.handleSuccess(res, event);
      
    } catch (error) {
      console.error('Error getting event:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * POST /api/v1/profiles/:profileId/events
   * Create a new event
   */
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const createData = req.body as EventCreateDTO;
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      // Handle parent node reference creation for nested routes
      if (createData._parentId && createData._parentType) {
        // Get parent node to create proper reference
        let parentNode;
        try {
          if (createData._parentType === 'education') {
            const educationService = await container.resolve(SERVICE_KEYS.EDUCATION_SERVICE);
            parentNode = await educationService.getById(profileId, createData._parentId);
          } else if (createData._parentType === 'job') {
            const jobService = await container.resolve(SERVICE_KEYS.JOB_SERVICE);
            parentNode = await jobService.getById(profileId, createData._parentId);
          }
          
          if (parentNode) {
            createData.parentNode = {
              id: parentNode.id,
              type: createData._parentType,
              title: parentNode.title,
            };
          }
        } catch (error) {
          console.error('Failed to get parent node:', error);
          throw new ValidationError('Invalid parent node reference');
        }
        
        // Clean up temporary fields
        delete createData._parentId;
        delete createData._parentType;
      }
      
      const event = await this.eventService.create(profileId, createData);
      
      return this.handleSuccess(res, event, 201);
      
    } catch (error) {
      console.error('Error creating event:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * PUT /api/v1/profiles/:profileId/events/:id
   * Update an existing event
   */
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const eventId = req.params.id;
      const updateData = req.body as EventUpdateDTO;
      
      if (!eventId) {
        throw new ValidationError('Event ID is required');
      }
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const event = await this.eventService.update(
        profileId,
        eventId,
        updateData
      );
      
      if (!event) {
        throw new NotFoundError('Event', eventId);
      }
      
      return this.handleSuccess(res, event);
      
    } catch (error) {
      console.error('Error updating event:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * DELETE /api/v1/profiles/:profileId/events/:id
   * Delete an event
   */
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const eventId = req.params.id;
      
      if (!eventId) {
        throw new ValidationError('Event ID is required');
      }
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const deleted = await this.eventService.delete(profileId, eventId);
      
      if (!deleted) {
        throw new NotFoundError('Event', eventId);
      }
      
      return this.handleSuccess(res, { message: 'Event deleted successfully' });
      
    } catch (error) {
      console.error('Error deleting event:', error);
      return this.handleError(res, error as Error);
    }
  }
}