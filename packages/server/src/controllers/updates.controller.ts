/**
 * UpdatesController
 * API endpoints for career transition updates
 */

import {
  createUpdateRequestSchema,
  paginationQuerySchema,
  updateUpdateRequestSchema,
} from '@journey/schema';
import type { Request, Response } from 'express';
import { z } from 'zod';

import type { Logger } from '../core/logger.js';
import type { UpdatesService } from '../services/updates.service.js';
import { BaseController } from './base-controller.js';

export class UpdatesController extends BaseController {
  private readonly updatesService: UpdatesService;
  private readonly logger: Logger;

  constructor({
    updatesService,
    logger,
  }: {
    updatesService: UpdatesService;
    logger: Logger;
  }) {
    super();
    this.updatesService = updatesService;
    this.logger = logger;
  }

  /**
   * POST /api/nodes/:nodeId/updates
   * @summary Create a new update for a career transition node
   * @tags Updates
   * @description Creates a new update entry for a career transition node. Updates track weekly progress including job applications, networking activities, skill development, and interview outcomes. Requires user authentication and permission to edit the node.
   * @security BearerAuth
   * @param {string} nodeId.path.required - UUID of the career transition node
   * @param {object} request.body.required - Update data
   * @param {string} request.body.notes - Progress notes (max 1000 characters)
   * @param {object} request.body.meta - Activity flags for tracking progress
   * @param {boolean} request.body.meta.appliedToJobs - Applied to jobs this week
   * @param {boolean} request.body.meta.updatedResumeOrPortfolio - Updated resume or portfolio
   * @param {boolean} request.body.meta.networked - Engaged in networking activities
   * @param {boolean} request.body.meta.developedSkills - Developed new skills
   * @param {boolean} request.body.meta.pendingInterviews - Have pending interviews
   * @param {boolean} request.body.meta.completedInterviews - Completed interviews
   * @param {boolean} request.body.meta.practicedMock - Practiced mock interviews
   * @param {boolean} request.body.meta.receivedOffers - Received job offers
   * @param {boolean} request.body.meta.receivedRejections - Received rejections
   * @param {boolean} request.body.meta.possiblyGhosted - Possibly ghosted by employers
   * @return {object} 201 - Created update with generated ID and timestamps
   * @return {object} 400 - Invalid request data (validation error)
   * @return {object} 401 - User not authenticated
   * @return {object} 403 - User lacks permission to create updates for this node
   * @return {object} 500 - Internal server error
   */
  createUpdate = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = this.getAuthenticatedUser(req);
      const { nodeId } = req.params;

      // Validate request body
      const data = createUpdateRequestSchema.parse(req.body);

      // Create update
      const update = await this.updatesService.createUpdate(
        user.id,
        nodeId,
        data
      );

      return this.created(res, update, req);
    } catch (error) {
      this.logger.error('Failed to create update', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
        nodeId: req.params.nodeId,
      });

      if (error instanceof z.ZodError) {
        return this.validationError(res, 'Invalid request data', error.errors, req);
      }

      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          return this.forbidden(res, error.message, req);
        }
      }

      return this.error(res, 'Failed to create update', req);
    }
  };

  /**
   * GET /api/nodes/:nodeId/updates
   * @summary Get paginated list of updates for a career transition node
   * @tags Updates
   * @description Retrieves all updates for a specific career transition node with pagination support. Returns updates in reverse chronological order (newest first). Requires user authentication and permission to view the node.
   * @security BearerAuth
   * @param {string} nodeId.path.required - UUID of the career transition node
   * @param {number} page.query - Page number (default: 1, min: 1)
   * @param {number} limit.query - Items per page (default: 20, min: 1, max: 100)
   * @return {object} 200 - Paginated list of updates with metadata
   * @return {object} 400 - Invalid query parameters (validation error)
   * @return {object} 401 - User not authenticated
   * @return {object} 403 - User lacks permission to view updates for this node
   * @return {object} 500 - Internal server error
   */
  getUpdatesByNodeId = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = this.getAuthenticatedUser(req);
      const { nodeId } = req.params;

      // Validate and parse query parameters
      const { page, limit } = paginationQuerySchema.parse(req.query);

      // Get updates
      const result = await this.updatesService.getUpdatesByNodeId(
        user.id,
        nodeId,
        { page, limit }
      );

      return this.success(res, result, req);
    } catch (error) {
      this.logger.error('Failed to get updates', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
        nodeId: req.params.nodeId,
      });

      if (error instanceof z.ZodError) {
        return this.validationError(res, 'Invalid query parameters', error.errors, req);
      }

      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          return this.forbidden(res, error.message, req);
        }
      }

      return this.error(res, 'Failed to get updates', req);
    }
  };

  /**
   * GET /api/nodes/:nodeId/updates/:updateId
   * @summary Get a specific update by ID
   * @tags Updates
   * @description Retrieves a single update by its ID. Validates that the update belongs to the specified node. Requires user authentication and permission to view the node.
   * @security BearerAuth
   * @param {string} nodeId.path.required - UUID of the career transition node
   * @param {string} updateId.path.required - UUID of the update
   * @return {object} 200 - Update details including notes, activity flags, and timestamps
   * @return {object} 401 - User not authenticated
   * @return {object} 403 - User lacks permission to view this update
   * @return {object} 404 - Update not found or does not belong to the specified node
   * @return {object} 500 - Internal server error
   */
  getUpdateById = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = this.getAuthenticatedUser(req);
      const { nodeId, updateId } = req.params;

      // Get update
      const update = await this.updatesService.getUpdateById(
        user.id,
        nodeId,
        updateId
      );

      if (!update) {
        return this.notFound(res, 'Update', req);
        return;
      }

      return this.success(res, update, req);
    } catch (error) {
      this.logger.error('Failed to get update', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
        nodeId: req.params.nodeId,
        updateId: req.params.updateId,
      });

      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          this.sendError(res, 403, 'FORBIDDEN', error.message);
          return;
        }
        if (error.message.includes('does not belong')) {
          return this.notFound(res, error.message, req);
          return;
        }
      }

      return this.error(res, 'Failed to get update', req);
    }
  };

  /**
   * PUT /api/nodes/:nodeId/updates/:updateId
   * @summary Update an existing update
   * @tags Updates
   * @description Updates an existing update entry with new notes or activity flags. All fields are optional - only provided fields will be updated. Requires user authentication and permission to edit the node.
   * @security BearerAuth
   * @param {string} nodeId.path.required - UUID of the career transition node
   * @param {string} updateId.path.required - UUID of the update to modify
   * @param {object} request.body.required - Update data (all fields optional)
   * @param {string} request.body.notes - Progress notes (max 1000 characters)
   * @param {object} request.body.meta - Activity flags for tracking progress
   * @param {boolean} request.body.meta.appliedToJobs - Applied to jobs this week
   * @param {boolean} request.body.meta.updatedResumeOrPortfolio - Updated resume or portfolio
   * @param {boolean} request.body.meta.networked - Engaged in networking activities
   * @param {boolean} request.body.meta.developedSkills - Developed new skills
   * @param {boolean} request.body.meta.pendingInterviews - Have pending interviews
   * @param {boolean} request.body.meta.completedInterviews - Completed interviews
   * @param {boolean} request.body.meta.practicedMock - Practiced mock interviews
   * @param {boolean} request.body.meta.receivedOffers - Received job offers
   * @param {boolean} request.body.meta.receivedRejections - Received rejections
   * @param {boolean} request.body.meta.possiblyGhosted - Possibly ghosted by employers
   * @return {object} 200 - Updated update with modified fields and updated timestamp
   * @return {object} 400 - Invalid request data (validation error)
   * @return {object} 401 - User not authenticated
   * @return {object} 403 - User lacks permission to edit this update
   * @return {object} 404 - Update not found
   * @return {object} 500 - Internal server error
   */
  updateUpdate = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = this.getAuthenticatedUser(req);
      const { nodeId, updateId } = req.params;

      // Validate request body
      const data = updateUpdateRequestSchema.parse(req.body);

      // Update
      const updated = await this.updatesService.updateUpdate(
        user.id,
        nodeId,
        updateId,
        data
      );

      if (!updated) {
        return this.notFound(res, 'Update', req);
      }

      return this.success(res, updated, req);
    } catch (error) {
      this.logger.error('Failed to update update', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
        nodeId: req.params.nodeId,
        updateId: req.params.updateId,
      });

      if (error instanceof z.ZodError) {
        return this.validationError(res, 'Invalid request data', error.errors, req);
      }

      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          return this.forbidden(res, error.message, req);
        }
        if (error.message.includes('invalid input syntax for type uuid')) {
          return this.notFound(res, 'Update', req);
        }
      }

      return this.error(res, 'Failed to update update', req);
    }
  };

  /**
   * DELETE /api/nodes/:nodeId/updates/:updateId
   * @summary Delete an update
   * @tags Updates
   * @description Permanently deletes an update from a career transition node. This action cannot be undone. Requires user authentication and permission to edit the node.
   * @security BearerAuth
   * @param {string} nodeId.path.required - UUID of the career transition node
   * @param {string} updateId.path.required - UUID of the update to delete
   * @return {object} 204 - Update successfully deleted (no content)
   * @return {object} 401 - User not authenticated
   * @return {object} 403 - User lacks permission to delete this update
   * @return {object} 404 - Update not found
   * @return {object} 500 - Internal server error
   */
  deleteUpdate = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = this.getAuthenticatedUser(req);
      const { nodeId, updateId } = req.params;

      // Delete
      const deleted = await this.updatesService.deleteUpdate(
        user.id,
        nodeId,
        updateId
      );

      if (!deleted) {
        return this.notFound(res, 'Update', req);
      }

      // Return 204 No Content for successful deletion
      res.status(204).send();
    } catch (error) {
      this.logger.error('Failed to delete update', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
        nodeId: req.params.nodeId,
        updateId: req.params.updateId,
      });

      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          return this.forbidden(res, error.message, req);
        }
        if (error.message.includes('invalid input syntax for type uuid')) {
          return this.notFound(res, 'Update', req);
        }
      }

      return this.error(res, 'Failed to delete update', req);
    }
  };
}