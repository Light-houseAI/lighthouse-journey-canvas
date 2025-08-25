/**
 * UserController
 * API endpoints for user operations including search
 */

import type { Request, Response } from 'express';
import type { Logger } from '../core/logger';
import { UserService } from '../services/user-service';
import { BaseController } from './base-controller';
import { z } from 'zod';

// Request schemas for validation
const userSearchParamsSchema = z.object({
  q: z.string().min(1, 'Search query is required').max(100, 'Query too long')
});

const userIdParamsSchema = z.object({
  userId: z.string().regex(/^\d+$/, 'Invalid user ID').transform(val => parseInt(val, 10))
});

export class UserController extends BaseController {
  private readonly userService: UserService;
  private readonly logger: Logger;

  constructor({
    userService,
    logger
  }: {
    userService: UserService;
    logger: Logger;
  }) {
    super();
    this.userService = userService;
    this.logger = logger;
  }

  /**
   * Search users by username or email
   * GET /api/v2/users/search?q={query}
   */
  async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      const { q: query } = userSearchParamsSchema.parse(req.query);
      const user = this.getAuthenticatedUser(req);

      // Limit results for search
      const users = await this.userService.searchUsers(query, 10);

      // Remove sensitive information from response
      const sanitizedUsers = users.map(foundUser => ({
        id: foundUser.id,
        email: foundUser.email,
        userName: foundUser.userName
      }));

      res.json({
        success: true,
        data: sanitizedUsers,
        count: sanitizedUsers.length
      });

      this.logger.info('User search performed', {
        searchQuery: query,
        userId: user.id,
        resultsCount: sanitizedUsers.length
      });
    } catch (error) {
      this.logger.error('Error searching users', {
        query: req.query.q,
        userId: (req as any).user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      this.handleError(res, error as Error, 'searchUsers');
    }
  }

  /**
   * Get user by ID
   * GET /api/v2/users/:userId
   */
  async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = userIdParamsSchema.parse(req.params);
      const currentUser = this.getAuthenticatedUser(req);

      const user = await this.userService.getUserById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found'
        });
        return;
      }

      // Remove sensitive information from response
      const sanitizedUser = {
        id: user.id,
        email: user.email,
        userName: user.userName
      };

      res.json({
        success: true,
        data: sanitizedUser
      });

      this.logger.info('User retrieved by ID', {
        requestedUserId: userId,
        requesterId: currentUser.id
      });
    } catch (error) {
      this.logger.error('Error getting user by ID', {
        userId: req.params.userId,
        requesterId: (req as any).user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      this.handleError(res, error as Error, 'getUserById');
    }
  }

  /**
   * Handle user-specific errors
   */
  protected handleError(res: Response, error: Error, method?: string): Response {
    // Handle Zod validation errors
    if (error instanceof z.ZodError || error.constructor.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: (error as z.ZodError).errors
      });
    }
    
    // Handle authentication errors
    if (error.message.includes('Authentication required')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    // Default error response
    const errorMessages = {
      searchUsers: 'Failed to search users',
      getUserById: 'Failed to get user'
    };
    
    const defaultMessage = method && errorMessages[method as keyof typeof errorMessages] 
      ? errorMessages[method as keyof typeof errorMessages]
      : 'Failed to process request';
    
    return res.status(500).json({
      success: false,
      error: defaultMessage
    });
  }
}