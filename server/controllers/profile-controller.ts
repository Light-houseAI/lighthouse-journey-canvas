/**
 * Profile Controller
 * 
 * Handles REST API endpoints for profile management.
 * Provides CRUD operations for profiles only.
 */

import { Request, Response } from 'express';
import { BaseController } from './base-controller';
import { container, SERVICE_KEYS } from '../core/container';
import { ProfileService } from '../services/profile-service';
import { ValidationError, NotFoundError } from '../services/base-service';
import type { InsertProfile } from '@shared/schema';

/**
 * Profile Controller
 * 
 * Extends BaseController with profile management endpoints
 */
export class ProfileController extends BaseController {
  private profileService: ProfileService;

  constructor() {
    super();
    // Service will be injected via container
  }

  /**
   * Initialize the controller with dependencies from the container
   */
  async initialize(): Promise<void> {
    this.profileService = await container.resolve<ProfileService>(
      SERVICE_KEYS.PROFILE_SERVICE
    );
  }

  /**
   * GET /api/v1/profiles/:profileId
   * Get profile by ID
   */
  async getById(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const profile = await this.profileService.getProfileById(profileId);
      
      if (!profile) {
        throw new NotFoundError('Profile not found');
      }
      
      return this.handleSuccess(res, profile);
      
    } catch (error) {
      console.error('Error getting profile:', error);
      return this.handleError(res, error as Error);
    }
  }

  /**
   * PUT /api/v1/profiles/:profileId
   * Update an existing profile
   */
  async update(req: Request, res: Response): Promise<Response> {
    try {
      const user = this.getAuthenticatedUser(req);
      const profileId = this.validateId(req.params.profileId, 'profileId');
      const updateData = req.body;
      
      // Validate user can access this profile
      this.validateProfileAccess(user.id, profileId);
      
      const profile = await this.profileService.updateProfile(profileId, updateData);
      
      if (!profile) {
        throw new NotFoundError('Profile not found');
      }
      
      return this.handleSuccess(res, profile);
      
    } catch (error) {
      console.error('Error updating profile:', error);
      return this.handleError(res, error as Error);
    }
  }

}