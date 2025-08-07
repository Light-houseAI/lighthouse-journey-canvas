/**
 * Project Controller
 * 
 * Handles REST API endpoints for project management.
 * Provides CRUD operations with proper validation and error handling.
 */

import { Request, Response } from 'express';
import { BaseController } from './base-controller';
import { container, SERVICE_KEYS } from '../core/container';
import { ProjectService } from '../services/project-service';
import { ValidationError, NotFoundError } from '../services/base-service';
import type { ProjectCreateDTO, ProjectUpdateDTO } from '@shared/schema';

/**
 * Project Controller
 * 
 * Extends BaseController with project specific endpoints
 */
export class ProjectController extends BaseController {
  private projectService: ProjectService;

  constructor() {
    super();
    // Service will be injected via container
  }

  /**
   * Initialize the controller with dependencies from the container
   */
  async initialize(): Promise<void> {
    this.projectService = await container.resolve<ProjectService>(
      SERVICE_KEYS.PROJECT_SERVICE
    );
  }

  /**
   * GET /api/v1/profiles/:profileId/projects
   * Get all projects for a profile
   */
  async list(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      // Parse query parameters
      const { page, limit, offset } = this.parsePagination(req.query);
      const { field, order } = this.parseSorting(req.query, ['title', 'status', 'startDate', 'endDate']);
      
      // Check if filtering by parentExperienceId (for nested endpoint compatibility)
      const parentExperienceId = req.query.parentExperienceId as string;
      
      // Get all projects, then filter by parent if specified
      let projects = await this.projectService.getAllSorted(profileId);
      
      if (parentExperienceId) {
        projects = projects.filter(project => project.parentNode?.id === parentExperienceId);
      }
      
      // Apply pagination
      const total = projects.length;
      const paginatedResults = projects.slice(offset, offset + limit);
      
      return this.handleSuccess(res, paginatedResults, 200, {
        total,
        page,
        limit,
      });
      
    } catch (error) {
      console.error('Error getting projects:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * GET /api/v1/profiles/:profileId/projects/:id
   * Get a specific project by ID
   */
  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const projectId = req.params.id;
      
      if (!projectId) {
        throw new ValidationError('Project ID is required');
      }
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const project = await this.projectService.getById(profileId, projectId);
      
      if (!project) {
        throw new NotFoundError('Project not found');
      }
      
      return this.handleSuccess(res, project);
      
    } catch (error) {
      console.error('Error getting project:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * POST /api/v1/profiles/:profileId/projects
   * Create a new project
   */
  async create(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const createData = req.body as ProjectCreateDTO;
      
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
      
      const project = await this.projectService.create(profileId, createData);
      
      return this.handleSuccess(res, project, 201);
      
    } catch (error) {
      console.error('Error creating project:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * PUT /api/v1/profiles/:profileId/projects/:id
   * Update an existing project
   */
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const projectId = req.params.id;
      const updateData = req.body as ProjectUpdateDTO;
      
      if (!projectId) {
        throw new ValidationError('Project ID is required');
      }
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const project = await this.projectService.update(
        profileId,
        projectId,
        updateData
      );
      
      if (!project) {
        throw new NotFoundError('Project not found');
      }
      
      return this.handleSuccess(res, project);
      
    } catch (error) {
      console.error('Error updating project:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * DELETE /api/v1/profiles/:profileId/projects/:id
   * Delete a project
   */
  async delete(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const projectId = req.params.id;
      
      if (!projectId) {
        throw new ValidationError('Project ID is required');
      }
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const deleted = await this.projectService.delete(profileId, projectId);
      
      if (!deleted) {
        throw new NotFoundError('Project not found');
      }
      
      return this.handleSuccess(res, { message: 'Project deleted successfully' });
      
    } catch (error) {
      console.error('Error deleting project:', error);
      return this.handleError(res, error as Error);
    }
  }

}