/**
 * UserController
 * API endpoints for user operations including search
 */

import type { Request, Response } from 'express';
import { z } from 'zod';

import type { Logger } from '../core/logger';
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
   * Search users by name
   * GET /api/v2/users/search?q={query}
   * Searches by first name, last name, or full name (partial match, case-insensitive)
   */
  async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      const { q: query } = userSearchParamsSchema.parse(req.query);
      const user = this.getAuthenticatedUser(req);

      // Search users by name only (now includes experience data)
      const users = await this.userService.searchUsers(query);

      // Remove sensitive information from response
      const sanitizedUsers = users.map((foundUser: any) => ({
        id: foundUser.id,
        email: foundUser.email || '',
        userName: foundUser.userName || '',
        firstName: foundUser.firstName || '',
        lastName: foundUser.lastName || '',
        experienceLine: foundUser.experienceLine || '',
        avatarUrl: foundUser.avatarUrl || '',
      }));

      res.json({
        success: true,
        data: sanitizedUsers,
        count: sanitizedUsers.length,
      });

      this.logger.info('User search performed', {
        searchQuery: query,
        userId: user.id,
        resultsCount: sanitizedUsers.length,
      });
    } catch (error) {
      this.logger.error('Error searching users', error instanceof Error ? error : new Error(String(error)));

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
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: (error as z.ZodError).errors,
      });
    }

    // Handle authentication errors
    if (
      error.message.includes('authentication required') ||
      error.constructor.name === 'AuthenticationError'
    ) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Default error response
    const errorMessages = {
      searchUsers: 'Failed to search users',
    };

    const defaultMessage =
      method && errorMessages[method as keyof typeof errorMessages]
        ? errorMessages[method as keyof typeof errorMessages]
        : 'Failed to process request';

    return res.status(500).json({
      success: false,
      error: defaultMessage,
    });
  }
}
