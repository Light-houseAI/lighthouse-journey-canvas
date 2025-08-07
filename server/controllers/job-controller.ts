/**
 * Job Controller
 * 
 * Handles REST API endpoints for job management.
 * Provides CRUD operations with proper validation and error handling.
 * 
 * NOTE: This controller ONLY includes basic CRUD operations as per PRD requirements.
 * All advanced query endpoints have been removed.
 */

import { Request, Response } from 'express';
import { BaseController } from './base-controller';
import { container, SERVICE_KEYS } from '../core/container';
import { JobService } from '../services/job-service';
import { ValidationError, NotFoundError } from '../services/base-service';
import type { JobCreateDTO, JobUpdateDTO } from '@shared/schema';

/**
 * Job Controller
 * 
 * Extends BaseController with job specific endpoints
 */
export class JobController extends BaseController {
  private jobService: JobService;

  constructor() {
    super();
    // Service will be injected via container
  }

  /**
   * Initialize the controller with dependencies from the container
   */
  async initialize(): Promise<void> {
    this.jobService = await container.resolve<JobService>(
      SERVICE_KEYS.JOB_SERVICE
    );
  }

  /**
   * GET /api/v1/profiles/:profileId/jobs
   * Get all jobs for a profile
   */
  async list(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      // Parse query parameters
      const { page, limit, offset } = this.parsePagination(req.query);
      const { field, order } = this.parseSorting(req.query, ['title', 'company', 'position', 'startDate', 'endDate']);
      
      // Get all jobs
      const jobs = await this.jobService.getAllSorted(profileId);
      
      // Apply pagination
      const total = jobs.length;
      const paginatedResults = jobs.slice(offset, offset + limit);
      
      return this.handleSuccess(res, paginatedResults, 200, {
        total,
        page,
        limit,
      });
      
    } catch (error) {
      console.error('Error getting jobs:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * GET /api/v1/profiles/:profileId/jobs/:id
   * Get a specific job by ID
   */
  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const jobId = req.params.id;
      
      if (!jobId) {
        throw new ValidationError('Job ID is required');
      }
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const job = await this.jobService.getById(profileId, jobId);
      
      if (!job) {
        throw new NotFoundError('Job', jobId);
      }
      
      return this.handleSuccess(res, job);
      
    } catch (error) {
      console.error('Error getting job:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * POST /api/v1/profiles/:profileId/jobs
   * Create a new job
   */
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const createData = req.body as JobCreateDTO;
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const job = await this.jobService.create(profileId, createData);
      
      return this.handleSuccess(res, job, 201);
      
    } catch (error) {
      console.error('Error creating job:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * PUT /api/v1/profiles/:profileId/jobs/:id
   * Update an existing job
   */
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const jobId = req.params.id;
      const updateData = req.body as JobUpdateDTO;
      
      if (!jobId) {
        throw new ValidationError('Job ID is required');
      }
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const job = await this.jobService.update(
        profileId,
        jobId,
        updateData
      );
      
      if (!job) {
        throw new NotFoundError('Job', jobId);
      }
      
      return this.handleSuccess(res, job);
      
    } catch (error) {
      console.error('Error updating job:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * DELETE /api/v1/profiles/:profileId/jobs/:id
   * Delete a job
   */
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const jobId = req.params.id;
      
      if (!jobId) {
        throw new ValidationError('Job ID is required');
      }
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const deleted = await this.jobService.delete(profileId, jobId);
      
      if (!deleted) {
        throw new NotFoundError('Job', jobId);
      }
      
      return this.handleSuccess(res, { message: 'Job deleted successfully' });
      
    } catch (error) {
      console.error('Error deleting job:', error);
      return this.handleError(res, error as Error);
    }
  }
}