/**
 * Education Controller
 * 
 * Handles REST API endpoints for education management.
 * Provides CRUD operations with proper validation and error handling.
 */

import { Request, Response } from 'express';
import { BaseController } from './base-controller';
import { container, SERVICE_KEYS } from '../core/container';
import { EducationService } from '../services/education-service';
import { ValidationError, NotFoundError } from '../services/base-service';
import type { EducationCreateDTO, EducationUpdateDTO } from '@shared/schema';

/**
 * Education Controller
 * 
 * Extends BaseController with education specific endpoints
 */
export class EducationController extends BaseController {
  private educationService: EducationService;

  constructor() {
    super();
    // Service will be injected via container
  }

  /**
   * Initialize the controller with dependencies from the container
   */
  async initialize(): Promise<void> {
    this.educationService = await container.resolve<EducationService>(
      SERVICE_KEYS.EDUCATION_SERVICE
    );
  }

  /**
   * GET /api/v1/profiles/:profileId/education
   * Get all education records for a profile
   */
  async list(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      // Parse query parameters
      const { page, limit, offset } = this.parsePagination(req.query);
      const { field, order } = this.parseSorting(req.query, ['title', 'institution', 'startDate', 'endDate']);
      
      // Get all education records
      const educationRecords = await this.educationService.getAllSorted(profileId);
      
      // Apply pagination
      const total = educationRecords.length;
      const paginatedResults = educationRecords.slice(offset, offset + limit);
      
      return this.handleSuccess(res, paginatedResults, 200, {
        total,
        page,
        limit,
      });
      
    } catch (error) {
      console.error('Error getting education records:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * GET /api/v1/profiles/:profileId/education/:id
   * Get a specific education record by ID
   */
  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const educationId = req.params.id;
      
      if (!educationId) {
        throw new ValidationError('Education ID is required');
      }
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const education = await this.educationService.getById(profileId, educationId);
      
      if (!education) {
        throw new NotFoundError('Education record not found');
      }
      
      return this.handleSuccess(res, education);
      
    } catch (error) {
      console.error('Error getting education record:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * POST /api/v1/profiles/:profileId/education
   * Create a new education record
   */
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const createData = req.body as EducationCreateDTO;
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const education = await this.educationService.create(profileId, createData);
      
      return this.handleSuccess(res, education, 201);
      
    } catch (error) {
      console.error('Error creating education record:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * PUT /api/v1/profiles/:profileId/education/:id
   * Update an existing education record
   */
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const educationId = req.params.id;
      const updateData = req.body as EducationUpdateDTO;
      
      if (!educationId) {
        throw new ValidationError('Education ID is required');
      }
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const education = await this.educationService.update(
        profileId,
        educationId,
        updateData
      );
      
      if (!education) {
        throw new NotFoundError('Education record not found');
      }
      
      return this.handleSuccess(res, education);
      
    } catch (error) {
      console.error('Error updating education record:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * DELETE /api/v1/profiles/:profileId/education/:id
   * Delete an education record
   */
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const educationId = req.params.id;
      
      if (!educationId) {
        throw new ValidationError('Education ID is required');
      }
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const deleted = await this.educationService.delete(profileId, educationId);
      
      if (!deleted) {
        throw new NotFoundError('Education record not found');
      }
      
      return this.handleSuccess(res, { message: 'Education record deleted successfully' });
      
    } catch (error) {
      console.error('Error deleting education record:', error);
      return this.handleError(res, error as Error);
    }
  }

}