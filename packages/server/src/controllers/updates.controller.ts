/**
 * UpdatesController
 * API endpoints for career transition updates
 */

import {
  AuthenticationError,
  createUpdateRequestSchema,
  type CreateUpdateSuccessResponse,
  type GetUpdatesSuccessResponse,
  type GetUpdateSuccessResponse,
  HttpStatusCode,
  NotFoundError,
  paginationQuerySchema,
  updateUpdateRequestSchema,
  type UpdateUpdateSuccessResponse,
  ValidationError,
} from '@journey/schema';
import type { Request, Response } from 'express';

import type { Logger } from '../core/logger.js';
import type { UpdatesService } from '../services/updates.service.js';

export class UpdatesController {
  private readonly updatesService: UpdatesService;
  private readonly logger: Logger;

  constructor({
    updatesService,
    logger,
  }: {
    updatesService: UpdatesService;
    logger: Logger;
  }) {
    this.updatesService = updatesService;
    this.logger = logger;
  }

  /**
   * POST /api/nodes/:nodeId/updates
   * @summary Create a new update for a career transition node
   * @tags Updates
   * @description Creates a new update entry for a career transition node. Updates track weekly or periodic progress including job applications, networking activities, skill development, interview outcomes, and other job search activities. Each update captures a snapshot of progress with activity flags and notes. Requires user authentication and permission to edit the node. Updates help users track their career transition journey and identify patterns in their job search efforts.
   * @security BearerAuth
   * @param {string} nodeId.path.required - UUID of the career transition node
   * @param {CreateUpdateInput} request.body.required - Update data with notes and activity meta flags - application/json
   * @return {CreateUpdateSuccessResponse} 201 - Created update with generated ID and timestamps
   * @return {ValidationErrorResponse} 400 - Invalid request data (validation error)
   * @return {AuthenticationErrorResponse} 401 - User not authenticated
   * @return {ForbiddenErrorResponse} 403 - User lacks permission to create updates for this node
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async createUpdate(req: Request, res: Response) {
    const { nodeId } = req.params;

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    // Validate request body - throws ValidationError on failure
    const validationResult = createUpdateRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError('Invalid update data', validationResult.error.errors);
    }

    const data = validationResult.data;

    // Create update
    const update = await this.updatesService.createUpdate(user.id, nodeId, data);

    // Send success response
    const response: CreateUpdateSuccessResponse = {
      success: true,
      data: update
    };

    res.status(HttpStatusCode.CREATED).json(response);
  }

  /**
   * GET /api/nodes/:nodeId/updates
   * @summary Get paginated list of updates for a career transition node
   * @tags Updates
   * @description Retrieves all updates for a specific career transition node with pagination support. Returns updates in reverse chronological order (newest first) to show the most recent progress. Each update includes activity flags, notes, and timestamps. Useful for viewing job search progress over time and identifying trends. Requires user authentication and permission to view the node.
   * @security BearerAuth
   * @param {string} nodeId.path.required - UUID of the career transition node
   * @param {number} page.query - Page number (default: 1, min: 1)
   * @param {number} limit.query - Items per page (default: 20, min: 1, max: 100)
   * @return {GetUpdatesSuccessResponse} 200 - Paginated list of updates with metadata
   * @return {ValidationErrorResponse} 400 - Invalid query parameters (validation error)
   * @return {AuthenticationErrorResponse} 401 - User not authenticated
   * @return {ForbiddenErrorResponse} 403 - User lacks permission to view updates for this node
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async getUpdatesByNodeId(req: Request, res: Response) {
    const { nodeId } = req.params;

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    // Validate and parse query parameters - throws ValidationError on failure
    const validationResult = paginationQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      throw new ValidationError('Invalid query parameters', validationResult.error.errors);
    }

    const { page, limit } = validationResult.data;

    // Get updates
    const result = await this.updatesService.getUpdatesByNodeId(user.id, nodeId, { page, limit });

    // Send success response
    const response: GetUpdatesSuccessResponse = {
      success: true,
      data: result
    };

    res.status(HttpStatusCode.OK).json(response);
  }

  /**
   * GET /api/nodes/:nodeId/updates/:updateId
   * @summary Get a specific update by ID
   * @tags Updates
   * @description Retrieves a single update by its unique ID. Validates that the update belongs to the specified node for data integrity. Returns complete update details including activity flags, notes, and timestamps. Requires user authentication and permission to view the node.
   * @security BearerAuth
   * @param {string} nodeId.path.required - UUID of the career transition node
   * @param {string} updateId.path.required - UUID of the update to retrieve
   * @return {GetUpdateSuccessResponse} 200 - Update details including notes, activity flags, and timestamps
   * @return {AuthenticationErrorResponse} 401 - User not authenticated
   * @return {ForbiddenErrorResponse} 403 - User lacks permission to view this update
   * @return {NotFoundErrorResponse} 404 - Update not found or does not belong to the specified node
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async getUpdateById(req: Request, res: Response) {
    const { nodeId, updateId } = req.params;

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    // Get update
    const update = await this.updatesService.getUpdateById(user.id, nodeId, updateId);

    if (!update) {
      throw new NotFoundError('Update not found');
    }

    // Send success response
    const response: GetUpdateSuccessResponse = {
      success: true,
      data: update
    };

    res.status(HttpStatusCode.OK).json(response);
  }

  /**
   * PUT /api/nodes/:nodeId/updates/:updateId
   * @summary Update an existing update
   * @tags Updates
   * @description Updates an existing update entry with new notes or activity flags. All fields are optional - only provided fields will be updated, enabling partial updates without overwriting unchanged data. Useful for correcting mistakes or adding additional information to progress entries. Requires user authentication and permission to edit the node.
   * @security BearerAuth
   * @param {string} nodeId.path.required - UUID of the career transition node
   * @param {string} updateId.path.required - UUID of the update to modify
   * @param {UpdateUpdateInput} request.body.required - Update data with optional notes and meta fields - application/json
   * @return {UpdateUpdateSuccessResponse} 200 - Updated update with modified fields and updated timestamp
   * @return {ValidationErrorResponse} 400 - Invalid request data (validation error)
   * @return {AuthenticationErrorResponse} 401 - User not authenticated
   * @return {ForbiddenErrorResponse} 403 - User lacks permission to edit this update
   * @return {NotFoundErrorResponse} 404 - Update not found
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async updateUpdate(req: Request, res: Response) {
    const { nodeId, updateId } = req.params;

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    // Validate request body - throws ValidationError on failure
    const validationResult = updateUpdateRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError('Invalid update data', validationResult.error.errors);
    }

    const data = validationResult.data;

    // Update
    const updated = await this.updatesService.updateUpdate(user.id, nodeId, updateId, data);

    if (!updated) {
      throw new NotFoundError('Update not found');
    }

    // Send success response
    const response: UpdateUpdateSuccessResponse = {
      success: true,
      data: updated
    };

    res.status(HttpStatusCode.OK).json(response);
  }

  /**
   * DELETE /api/nodes/:nodeId/updates/:updateId
   * @summary Delete an update
   * @tags Updates
   * @description Permanently deletes an update from a career transition node. This action cannot be undone - the update and all its data will be permanently removed from the database. Use with caution. Requires user authentication and permission to edit the node. Returns 204 No Content on success.
   * @security BearerAuth
   * @param {string} nodeId.path.required - UUID of the career transition node
   * @param {string} updateId.path.required - UUID of the update to delete
   * @return 204 - Update successfully deleted (no content)
   * @return {AuthenticationErrorResponse} 401 - User not authenticated
   * @return {ForbiddenErrorResponse} 403 - User lacks permission to delete this update
   * @return {NotFoundErrorResponse} 404 - Update not found
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async deleteUpdate(req: Request, res: Response) {
    const { nodeId, updateId } = req.params;

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    // Delete
    const deleted = await this.updatesService.deleteUpdate(user.id, nodeId, updateId);

    if (!deleted) {
      throw new NotFoundError('Update not found');
    }

    // Return 204 No Content for successful deletion
    res.status(HttpStatusCode.NO_CONTENT).send();
  }
}
