/**
 * OrganizationController
 * API endpoints for organization operations including user organizations and search
 */

// Import schema from shared package
import { organizationSearchQuerySchema } from '@journey/schema';
import type { Request, Response } from 'express';
import { z } from 'zod';

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
   * @summary Get user's organizations
   * @tags Organizations
   * @description Retrieves all organizations that the authenticated user is a member of
   * @security BearerAuth
   * @return {object} 200 - Success response with user's organizations
   * @return {object} 401 - Unauthorized - Authentication required
   * @return {object} 500 - Internal server error
   * @example response - 200 - Success response example
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "id": "org_123",
   *       "name": "Acme Corp",
   *       "domain": "acme.com"
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
   * @summary Search organizations by name
   * @tags Organizations
   * @description Search for organizations by name with pagination support. Returns matching organizations based on the search query.
   * @security BearerAuth
   * @param {string} q.query.required - Search query string to match organization names
   * @param {number} page.query - Page number for pagination (default: 1)
   * @param {number} limit.query - Number of results per page (default: 10)
   * @return {object} 200 - Success response with search results
   * @return {object} 400 - Bad request - Invalid query parameters
   * @return {object} 401 - Unauthorized - Authentication required
   * @return {object} 500 - Internal server error
   * @example response - 200 - Success response example
   * {
   *   "success": true,
   *   "data": {
   *     "organizations": [
   *       {
   *         "id": "org_123",
   *         "name": "Acme Corporation",
   *         "domain": "acme.com"
   *       }
   *     ],
   *     "total": 1,
   *     "page": 1,
   *     "limit": 10
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
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters',
        details: (error as z.ZodError).errors,
      });
    }

    // Handle authentication errors
    if (error.message.includes('authentication required')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
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

    return res.status(500).json({
      success: false,
      error: defaultMessage,
    });
  }
}
