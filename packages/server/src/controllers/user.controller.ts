/**
 * UserController
 * API endpoints for user operations including search
 */

import {
  userSearchRequestSchema,
  userSearchResponseSchema,
} from '@journey/schema';
import type { Request, Response } from 'express';

import { HttpStatus } from '../core';
import type { Logger } from '../core/logger';
import { UserMapper } from '../mappers/user.mapper';
import { UserService } from '../services/user-service';
import { BaseController } from './base.controller.js';

export class UserController extends BaseController {
  private readonly userService: UserService;
  private readonly logger: Logger;

  constructor({
    userService,
    logger,
  }: {
    userService: UserService;
    logger: Logger;
  }) {
    super();
    this.userService = userService;
    this.logger = logger;
  }

  /**
   * GET /api/v2/users/search
   * @tags Users
   * @summary Search users by name
   * @description Search users by first name, last name, or full name (partial match, case-insensitive)
   * @security BearerAuth
   * @param {string} q.query.required - Search query (1-100 characters)
   * @return {ApiSuccessResponse<UserSearchResponseDto>} 200 - List of matching users
   * @return {ApiErrorResponse} 400 - Invalid query parameter
   * @return {ApiErrorResponse} 401 - Authentication required
   * @example response - 200 - Success response with user list
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "id": "uuid",
   *       "email": "user@example.com",
   *       "userName": "johndoe",
   *       "firstName": "John",
   *       "lastName": "Doe",
   *       "experienceLine": "Software Engineer at Google",
   *       "avatarUrl": "https://example.com/avatar.jpg"
   *     }
   *   ],
   *   "count": 1
   * }
   */
  async searchUsers(req: Request, res: Response): Promise<void> {
    const { q: query } = userSearchRequestSchema.parse(req.query);
    const user = this.getAuthenticatedUser(req);

    // Search users by name only (now includes experience data)
    const users = await this.userService.searchUsers(query);

    // Map service response to DTO, validate, and send
    const response = UserMapper.toUserSearchResponseDto(users).withSchema(
      userSearchResponseSchema
    );

    res.status(HttpStatus.OK).json(response);

    this.logger.info('User search performed', {
      searchQuery: query,
      userId: user.id,
      resultsCount: users.length,
    });
  }
}
