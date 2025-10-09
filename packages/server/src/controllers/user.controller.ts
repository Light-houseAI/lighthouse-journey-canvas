/**
 * UserController
 * API endpoints for user operations including search
 */

import {
  AuthenticationError,
  HttpStatusCode,
  type SanitizedUser,
  type UserSearchSuccessResponse,
  ValidationError,
} from '@journey/schema';
import type { Request, Response } from 'express';
import { z } from 'zod';

import type { Logger } from '../core/logger';
import { UserService } from '../services/user-service';

// Request schemas for validation
const userSearchParamsSchema = z.object({
  q: z.string().min(1, 'Search query is required').max(100, 'Query too long'),
});

export class UserController {
  private readonly userService: UserService;
  private readonly logger: Logger;

  constructor({
    userService,
    logger,
  }: {
    userService: UserService;
    logger: Logger;
  }) {
    this.userService = userService;
    this.logger = logger;
  }

  /**
   * GET /api/v2/users/search
   * @summary Search users by name
   * @tags Users
   * @description Searches for users by first name, last name, or full name using partial match and case-insensitive comparison. Returns an array of sanitized user objects excluding sensitive information like passwords.
   * @security BearerAuth
   * @param {string} q.query.required - Search query string to match against user names (min 1, max 100 characters)
   * @return {UserSearchSuccessResponse} 200 - Success response with user search results
   * @return {ValidationErrorResponse} 400 - Validation error response
   * @return {AuthenticationErrorResponse} 401 - Authentication error response
   * @return {InternalErrorResponse} 500 - Internal server error response
   */
  async searchUsers(req: Request, res: Response) {
    // Validate query parameters - throws ValidationError on failure
    const validationResult = userSearchParamsSchema.safeParse(req.query);
    if (!validationResult.success) {
      throw new ValidationError('Invalid search parameters', validationResult.error.errors);
    }

    const { q: query } = validationResult.data;

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    // Search users by name only (now includes experience data)
    const users = await this.userService.searchUsers(query);

    // Remove sensitive information from response
    const sanitizedUsers: SanitizedUser[] = users.map((foundUser: any) => ({
      id: foundUser.id,
      email: foundUser.email || '',
      userName: foundUser.userName || '',
      firstName: foundUser.firstName || '',
      lastName: foundUser.lastName || '',
      experienceLine: foundUser.experienceLine || '',
      avatarUrl: foundUser.avatarUrl || '',
    }));

    this.logger.info('User search completed', {
      userId: user.id,
      query,
      resultsCount: sanitizedUsers.length,
    });

    // Send success response
    const response: UserSearchSuccessResponse = {
      success: true,
      data: {
        data: sanitizedUsers,
        count: sanitizedUsers.length,
      },
    };

    res.status(HttpStatusCode.OK).json(response);
  }
}
