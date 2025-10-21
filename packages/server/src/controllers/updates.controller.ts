/**
 * UpdatesController
 * API endpoints for career transition updates
 */

import {
  createUpdateRequestSchema,
  paginationQuerySchema,
  updateItemSchema,
  updateUpdateRequestSchema,
} from '@journey/schema';
import type { Request, Response } from 'express';

import { HttpStatus } from '../core';
import type { Logger } from '../core/logger.js';
import { UpdatesMapper } from '../mappers/updates.mapper';
import type { UpdatesService } from '../services/updates.service.js';
import { BaseController } from './base.controller.js';

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
   * @param {CreateUpdateRequestDto} request.body.required - Update data
   * @return {ApiSuccessResponse<UpdateDto>} 201 - Update created successfully
   * @return {ApiErrorResponse} 400 - Validation error
   * @return {ApiErrorResponse} 403 - Permission denied
   */
  createUpdate = async (req: Request, res: Response): Promise<void> => {
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

    // Map to DTO
    const responseData = UpdatesMapper.toUpdateDto(update);

    const response =
      UpdatesMapper.toUpdateResponse(responseData).withSchema(updateItemSchema);
    res.status(HttpStatus.CREATED).json(response);
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
   * @return {ApiSuccessResponse<PaginatedUpdatesDto>} 200 - Paginated updates list
   * @return {ApiErrorResponse} 403 - Permission denied
   */
  getUpdatesByNodeId = async (req: Request, res: Response): Promise<void> => {
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

    // Map to DTO
    const responseData = UpdatesMapper.toPaginatedUpdatesDto(result);

    const response =
      UpdatesMapper.toUpdateResponse(responseData).withSchema(updateItemSchema);
    res.status(HttpStatus.OK).json(response);
  };

  /**
   * GET /api/nodes/{nodeId}/updates/{updateId}
   * @tags Updates
   * @summary Get specific update
   * @description Get a single update by ID
   * @security BearerAuth
   * @param {string} nodeId.path.required - Career transition node UUID
   * @param {string} updateId.path.required - Update UUID
   * @return {ApiSuccessResponse<UpdateDto>} 200 - Update details
   * @return {ApiErrorResponse} 403 - Permission denied
   * @return {ApiErrorResponse} 404 - Update not found
   */
  getUpdateById = async (req: Request, res: Response): Promise<void> => {
    const user = this.getAuthenticatedUser(req);
    const { nodeId, updateId } = req.params;

    // Get update
    const update = await this.updatesService.getUpdateById(
      user.id,
      nodeId,
      updateId
    );

    if (!update) {
      res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Update not found',
        },
      });
      return;
    }

    // Map to DTO
    const responseData = UpdatesMapper.toUpdateDto(update);

    const response =
      UpdatesMapper.toUpdateResponse(responseData).withSchema(updateItemSchema);
    res.status(HttpStatus.OK).json(response);
  };

  /**
   * PUT /api/nodes/{nodeId}/updates/{updateId}
   * @tags Updates
   * @summary Update an update
   * @description Update an existing career transition update
   * @security BearerAuth
   * @param {string} nodeId.path.required - Career transition node UUID
   * @param {string} updateId.path.required - Update UUID
   * @param {UpdateUpdateRequestDto} request.body.required - Update data
   * @return {ApiSuccessResponse<UpdateDto>} 200 - Update modified successfully
   * @return {ApiErrorResponse} 400 - Validation error
   * @return {ApiErrorResponse} 403 - Permission denied
   * @return {ApiErrorResponse} 404 - Update not found
   */
  updateUpdate = async (req: Request, res: Response): Promise<void> => {
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
      res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Update not found',
        },
      });
      return;
    }

    // Map to DTO
    const responseData = UpdatesMapper.toUpdateDto(updated);

    const response =
      UpdatesMapper.toUpdateResponse(responseData).withSchema(updateItemSchema);
    res.status(HttpStatus.OK).json(response);
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
   * @return {ApiErrorResponse} 403 - Permission denied
   * @return {ApiErrorResponse} 404 - Update not found
   */
  deleteUpdate = async (req: Request, res: Response): Promise<void> => {
    const user = this.getAuthenticatedUser(req);
    const { nodeId, updateId } = req.params;

    // Delete
    const deleted = await this.updatesService.deleteUpdate(
      user.id,
      nodeId,
      updateId
    );

    if (!deleted) {
      res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Update not found',
        },
      });
      return;
    }

    // Return 204 No Content for successful deletion
    res.status(HttpStatus.NO_CONTENT).send();
  };
}
