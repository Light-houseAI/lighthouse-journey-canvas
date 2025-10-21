/**
 * UserController
 * API endpoints for user operations including search
 */

import { userSearchResponseSchema } from '@journey/schema';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { type ApiErrorResponse, ErrorCode, HttpStatus } from '../core';
import type { Logger } from '../core/logger';
import { UserMapper } from '../dtos';
import { UserService } from '../services/user-service';
import { BaseController } from './base-controller.js';

// Request schemas for validation
const userSearchParamsSchema = z.object({
  q: z.string().min(1, 'Search query is required').max(100, 'Query too long'),
});

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
    try {
      const { q: query } = userSearchParamsSchema.parse(req.query);
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
    } catch (error) {
      this.logger.error(
        'Error searching users',
        error instanceof Error ? error : new Error(String(error))
      );

      this.handleError(res, error as Error, 'searchUsers');
    }
  }

  /**
   * Handle user-specific errors
   */
  protected handleError(
    res: Response,
    error: Error,
    method?: string
  ): Response {
    // Handle Zod validation errors
    if (error instanceof z.ZodError || error.constructor.name === 'ZodError') {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Invalid request parameters',
          details: (error as z.ZodError).errors,
        },
      };
      return res.status(HttpStatus.BAD_REQUEST).json(errorResponse);
    }

    // Handle authentication errors
    if (
      error.message.includes('authentication required') ||
      error.constructor.name === 'AuthenticationError'
    ) {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION_REQUIRED,
          message: 'Authentication required',
        },
      };
      return res.status(HttpStatus.UNAUTHORIZED).json(errorResponse);
    }

    // Default error response
    const errorMessages = {
      searchUsers: 'Failed to search users',
    };

    const defaultMessage =
      method && errorMessages[method as keyof typeof errorMessages]
        ? errorMessages[method as keyof typeof errorMessages]
        : 'Failed to process request';

    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: defaultMessage,
      },
    };
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
  }
}
