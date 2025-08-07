/**
 * Career Transition Controller
 * 
 * Handles REST API endpoints for career transition management.
 * Provides CRUD operations with proper validation and error handling.
 * 
 * NOTE: This controller ONLY includes basic CRUD operations as per PRD requirements.
 * All advanced query endpoints have been removed.
 */

import { Request, Response } from 'express';
import { BaseController } from './base-controller';
import { container, SERVICE_KEYS } from '../core/container';
import { CareerTransitionService } from '../services/career-transition-service';
import { ValidationError, NotFoundError } from '../services/base-service';
import type { CareerTransitionCreateDTO, CareerTransitionUpdateDTO } from '@shared/schema';

/**
 * Career Transition Controller
 * 
 * Extends BaseController with career transition specific endpoints
 */
export class CareerTransitionController extends BaseController {
  private careerTransitionService: CareerTransitionService;

  constructor() {
    super();
    // Service will be injected via container
  }

  /**
   * Initialize the controller with dependencies from the container
   */
  async initialize(): Promise<void> {
    this.careerTransitionService = await container.resolve<CareerTransitionService>(
      SERVICE_KEYS.CAREER_TRANSITION_SERVICE
    );
  }

  /**
   * GET /api/v1/profiles/:profileId/career-transitions
   * Get all career transitions for a profile
   */
  async list(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      // Parse query parameters
      const { page, limit, offset } = this.parsePagination(req.query);
      const { field, order } = this.parseSorting(req.query, ['title', 'transitionType', 'startDate', 'fromCompany', 'toCompany']);
      
      // Get all career transitions
      const transitions = await this.careerTransitionService.getAllSorted(profileId);
      
      // Apply pagination
      const total = transitions.length;
      const paginatedResults = transitions.slice(offset, offset + limit);
      
      return this.handleSuccess(res, paginatedResults, 200, {
        total,
        page,
        limit,
      });
      
    } catch (error) {
      console.error('Error getting career transitions:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * GET /api/v1/profiles/:profileId/career-transitions/:id
   * Get a specific career transition by ID
   */
  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const transitionId = req.params.id;
      
      if (!transitionId) {
        throw new ValidationError('Career transition ID is required');
      }
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const transition = await this.careerTransitionService.getById(profileId, transitionId);
      
      if (!transition) {
        throw new NotFoundError('Career Transition', transitionId);
      }
      
      return this.handleSuccess(res, transition);
      
    } catch (error) {
      console.error('Error getting career transition:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * POST /api/v1/profiles/:profileId/career-transitions
   * Create a new career transition
   */
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const createData = req.body as CareerTransitionCreateDTO;
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const transition = await this.careerTransitionService.create(profileId, createData);
      
      return this.handleSuccess(res, transition, 201);
      
    } catch (error) {
      console.error('Error creating career transition:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * PUT /api/v1/profiles/:profileId/career-transitions/:id
   * Update an existing career transition
   */
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const transitionId = req.params.id;
      const updateData = req.body as CareerTransitionUpdateDTO;
      
      if (!transitionId) {
        throw new ValidationError('Career transition ID is required');
      }
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const transition = await this.careerTransitionService.update(
        profileId,
        transitionId,
        updateData
      );
      
      if (!transition) {
        throw new NotFoundError('Career Transition', transitionId);
      }
      
      return this.handleSuccess(res, transition);
      
    } catch (error) {
      console.error('Error updating career transition:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * DELETE /api/v1/profiles/:profileId/career-transitions/:id
   * Delete a career transition
   */
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const transitionId = req.params.id;
      
      if (!transitionId) {
        throw new ValidationError('Career transition ID is required');
      }
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const deleted = await this.careerTransitionService.delete(profileId, transitionId);
      
      if (!deleted) {
        throw new NotFoundError('Career Transition', transitionId);
      }
      
      return this.handleSuccess(res, { message: 'Career transition deleted successfully' });
      
    } catch (error) {
      console.error('Error deleting career transition:', error);
      return this.handleError(res, error as Error);
    }
  }
}