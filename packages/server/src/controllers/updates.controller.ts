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

import { HttpStatus } from '../core';
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
   * POST /api/nodes/{nodeId}/updates
   * @tags Updates
   * @summary Create career transition update
   * @description Create a new update for a career transition node
   * @security BearerAuth
   * @param {string} nodeId.path.required - Career transition node UUID
   * @param {object} request.body.required - Update data
   * @param {string} request.body.content.required - Update content
   * @param {string} request.body.status - Update status
   * @return {object} 201 - Update created successfully
   * @return {object} 400 - Validation error
   * @return {object} 403 - Permission denied
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
   * GET /api/nodes/{nodeId}/updates
   * @tags Updates
   * @summary Get node updates
   * @description Get paginated updates for a career transition node
   * @security BearerAuth
   * @param {string} nodeId.path.required - Career transition node UUID
   * @param {number} page.query - Page number (default: 1)
   * @param {number} limit.query - Items per page (default: 20)
   * @return {object} 200 - Paginated updates list
   * @return {object} 403 - Permission denied
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
   * GET /api/nodes/{nodeId}/updates/{updateId}
   * @tags Updates
   * @summary Get specific update
   * @description Get a single update by ID
   * @security BearerAuth
   * @param {string} nodeId.path.required - Career transition node UUID
   * @param {string} updateId.path.required - Update UUID
   * @return {object} 200 - Update details
   * @return {object} 403 - Permission denied
   * @return {object} 404 - Update not found
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
   * PUT /api/nodes/{nodeId}/updates/{updateId}
   * @tags Updates
   * @summary Update an update
   * @description Update an existing career transition update
   * @security BearerAuth
   * @param {string} nodeId.path.required - Career transition node UUID
   * @param {string} updateId.path.required - Update UUID
   * @param {object} request.body.required - Update data
   * @param {string} request.body.content - Update content
   * @param {string} request.body.status - Update status
   * @return {object} 200 - Update modified successfully
   * @return {object} 400 - Validation error
   * @return {object} 403 - Permission denied
   * @return {object} 404 - Update not found
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
   * DELETE /api/nodes/{nodeId}/updates/{updateId}
   * @tags Updates
   * @summary Delete update
   * @description Delete a career transition update
   * @security BearerAuth
   * @param {string} nodeId.path.required - Career transition node UUID
   * @param {string} updateId.path.required - Update UUID
   * @return 204 - Update deleted successfully
   * @return {object} 403 - Permission denied
   * @return {object} 404 - Update not found
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
      res.status(HttpStatus.NO_CONTENT).send();
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