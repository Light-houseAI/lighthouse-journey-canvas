/**
 * Action Controller
 * 
 * Handles REST API endpoints for action management.
 * Provides CRUD operations with proper validation and error handling.
 * 
 * NOTE: This controller ONLY includes basic CRUD operations as per PRD requirements.
 * All advanced query endpoints have been removed.
 */

import { Request, Response } from 'express';
import { BaseController } from './base-controller';
import { container, SERVICE_KEYS } from '../core/container';
import { ActionService } from '../services/action-service';
import { ValidationError, NotFoundError } from '../services/base-service';
import type { ActionCreateDTO, ActionUpdateDTO } from '@shared/schema';

/**
 * Action Controller
 * 
 * Extends BaseController with action specific endpoints
 */
export class ActionController extends BaseController {
  private actionService: ActionService;

  constructor() {
    super();
    // Service will be injected via container
  }

  /**
   * Initialize the controller with dependencies from the container
   */
  async initialize(): Promise<void> {
    this.actionService = await container.resolve<ActionService>(
      SERVICE_KEYS.ACTION_SERVICE
    );
  }

  /**
   * GET /api/v1/profiles/:profileId/actions
   * Get all actions for a profile
   */
  async list(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      // Parse query parameters
      const { page, limit, offset } = this.parsePagination(req.query);
      const { field, order } = this.parseSorting(req.query, ['title', 'actionType', 'category', 'status', 'startDate', 'endDate']);
      
      // Check if filtering by parentExperienceId (for nested endpoint compatibility)
      const parentExperienceId = req.query.parentExperienceId as string;
      
      // Get all actions, then filter by parent if specified
      let actions = await this.actionService.getAllSorted(profileId);
      
      if (parentExperienceId) {
        actions = actions.filter(action => action.parentNode?.id === parentExperienceId);
      }
      
      // Apply pagination
      const total = actions.length;
      const paginatedResults = actions.slice(offset, offset + limit);
      
      return this.handleSuccess(res, paginatedResults, 200, {
        total,
        page,
        limit,
      });
      
    } catch (error) {
      console.error('Error getting actions:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * GET /api/v1/profiles/:profileId/actions/:id
   * Get a specific action by ID
   */
  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const actionId = req.params.id;
      
      if (!actionId) {
        throw new ValidationError('Action ID is required');
      }
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const action = await this.actionService.getById(profileId, actionId);
      
      if (!action) {
        throw new NotFoundError('Action', actionId);
      }
      
      return this.handleSuccess(res, action);
      
    } catch (error) {
      console.error('Error getting action:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * POST /api/v1/profiles/:profileId/actions
   * Create a new action
   */
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const createData = req.body as ActionCreateDTO;
      
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
      
      const action = await this.actionService.create(profileId, createData);
      
      return this.handleSuccess(res, action, 201);
      
    } catch (error) {
      console.error('Error creating action:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * PUT /api/v1/profiles/:profileId/actions/:id
   * Update an existing action
   */
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const actionId = req.params.id;
      const updateData = req.body as ActionUpdateDTO;
      
      if (!actionId) {
        throw new ValidationError('Action ID is required');
      }
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const action = await this.actionService.update(
        profileId,
        actionId,
        updateData
      );
      
      if (!action) {
        throw new NotFoundError('Action', actionId);
      }
      
      return this.handleSuccess(res, action);
      
    } catch (error) {
      console.error('Error updating action:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * DELETE /api/v1/profiles/:profileId/actions/:id
   * Delete an action
   */
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const actionId = req.params.id;
      
      if (!actionId) {
        throw new ValidationError('Action ID is required');
      }
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const deleted = await this.actionService.delete(profileId, actionId);
      
      if (!deleted) {
        throw new NotFoundError('Action', actionId);
      }
      
      return this.handleSuccess(res, { message: 'Action deleted successfully' });
      
    } catch (error) {
      console.error('Error deleting action:', error);
      return this.handleError(res, error as Error);
    }
  }
}