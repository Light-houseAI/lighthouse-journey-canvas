/**
 * OrganizationController
 * API endpoints for organization operations including user organizations and search
 */

// Import schema from shared package
import { organizationSearchQuerySchema } from '@journey/schema';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { ErrorCode, HttpStatus } from '../core';
import type { Logger } from '../core/logger';
import type { IOrganizationRepository } from '../repositories/interfaces/organization.repository.interface.js';
import { BaseController } from './base-controller.js';

export class OrganizationController extends BaseController {
  private readonly organizationRepository: IOrganizationRepository;
  private readonly organizationService: any;
  private readonly logger: Logger;

  constructor({
    organizationRepository,
    organizationService,
    logger,
  }: {
    organizationRepository: IOrganizationRepository;
    organizationService: any; // OrganizationService
    logger: Logger;
  }) {
    super();
    this.organizationRepository = organizationRepository;
    this.organizationService = organizationService;
    this.logger = logger;
  }

  /**
   * GET /api/v2/organizations
   * @tags Organizations
   * @summary Get user's organizations
   * @description Get all organizations where the authenticated user is a member
   * @security BearerAuth
   * @return {object} 200 - List of user's organizations
   * @return {object} 401 - Authentication required
   * @example response - 200 - User organizations
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "id": "uuid",
   *       "name": "Acme Corp",
   *       "description": "Leading software company",
   *       "createdAt": "2024-01-01T00:00:00.000Z"
   *     }
   *   ],
   *   "count": 1
   * }
   */
  async getUserOrganizations(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);

      const organizations =
        await this.organizationRepository.getUserOrganizations(user.id);

      res.json({
        success: true,
        data: organizations,
        count: organizations.length,
      });

      this.logger.info('User organizations retrieved', {
        userId: user.id,
        organizationCount: organizations.length,
      });
    } catch (error) {
      this.logger.error(
        'Error getting user organizations',
        error instanceof Error ? error : new Error(String(error))
      );

      this.handleError(res, error as Error, 'getUserOrganizations');
    }
  }

  /**
   * GET /api/v2/organizations/search
   * @tags Organizations
   * @summary Search organizations
   * @description Search organizations by name with pagination
   * @security BearerAuth
   * @param {string} q.query.required - Search query
   * @param {number} page.query - Page number (default: 1)
   * @param {number} limit.query - Results per page (default: 10, max: 100)
   * @return {object} 200 - Paginated organization results
   * @return {object} 400 - Invalid query parameters
   * @return {object} 401 - Authentication required
   * @example response - 200 - Search results
   * {
   *   "success": true,
   *   "data": {
   *     "organizations": [
   *       {
   *         "id": "uuid",
   *         "name": "Acme Corp",
   *         "description": "Leading software company"
   *       }
   *     ],
   *     "pagination": {
   *       "page": 1,
   *       "limit": 10,
   *       "total": 1,
   *       "pages": 1
   *     }
   *   }
   * }
   */
  async searchOrganizations(req: Request, res: Response): Promise<void> {
    try {
      const { q: query, page, limit } = organizationSearchQuerySchema.parse(req.query);
      const user = this.getAuthenticatedUser(req);

      // Search with pagination
      const result = await this.organizationService.searchOrganizations(query, {
        page,
        limit,
      });

      res.json({
        success: true,
        data: result,
      });

      this.logger.info('Organization search performed', {
        searchQuery: query,
        userId: user.id,
        resultsCount: result.organizations.length,
        page,
        limit,
      });
    } catch (error) {
      this.logger.error(
        'Error searching organizations',
        error instanceof Error ? error : new Error(String(error))
      );

      this.handleError(res, error as Error, 'searchOrganizations');
    }
  }

  /**
   * Handle organization-specific errors
   */
  protected handleError(
    res: Response,
    error: Error,
    method?: string
  ): Response {
    // Handle Zod validation errors
    if (error instanceof z.ZodError || error.constructor.name === 'ZodError') {
      return res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Invalid request parameters',
          details: (error as z.ZodError).errors,
        },
      });
    }

    // Handle authentication errors
    if (error.message.includes('authentication required')) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION_REQUIRED,
          message: 'Authentication required',
        },
      });
    }

    // Default error response
    const errorMessages = {
      getUserOrganizations: 'Failed to retrieve user organizations',
      searchOrganizations: 'Failed to search organizations',
    };

    const defaultMessage =
      method && errorMessages[method as keyof typeof errorMessages]
        ? errorMessages[method as keyof typeof errorMessages]
        : 'Failed to process request';

    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: defaultMessage,
      },
    });
  }
}
