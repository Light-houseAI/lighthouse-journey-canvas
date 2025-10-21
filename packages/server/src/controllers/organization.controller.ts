/**
 * OrganizationController
 * API endpoints for organization operations including user organizations and search
 */

// Import schema from shared package
import {
  organizationSearchQuerySchema,
  organizationSearchResponseSchema,
  userOrganizationsResponseSchema,
} from '@journey/schema';
import type { Request, Response } from 'express';

import { HttpStatus } from '../core';
import type { Logger } from '../core/logger';
import { OrganizationMapper } from '../dtos/mappers/organization.mapper.js';
import { BaseController } from './base-controller.js';

export class OrganizationController extends BaseController {
  private readonly organizationService: any;
  private readonly logger: Logger;

  constructor({
    organizationService,
    logger,
  }: {
    organizationService: any; // OrganizationService
    logger: Logger;
  }) {
    super();
    this.organizationService = organizationService;
    this.logger = logger;
  }

  /**
   * GET /api/v2/organizations
   * @tags Organizations
   * @summary Get user's organizations
   * @description Get all organizations where the authenticated user is a member
   * @security BearerAuth
   * @return {ApiSuccessResponse<UserOrganizationsResponseDto>} 200 - List of user's organizations
   * @return {ApiErrorResponse} 401 - Authentication required
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
    const user = this.getAuthenticatedUser(req);

    // Get organizations from service
    const organizations = await this.organizationService.getUserOrganizations(
      user.id
    );

    // Map to DTO
    const responseData =
      OrganizationMapper.toUserOrganizationsResponseDto(organizations);

    const response = OrganizationMapper.toOrganizationListResponse(
      responseData
    ).withSchema(userOrganizationsResponseSchema);
    res.status(HttpStatus.OK).json(response);

    this.logger.info('User organizations retrieved', {
      userId: user.id,
      organizationCount: responseData.count,
    });
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
   * @return {ApiSuccessResponse<OrganizationSearchResponseDto>} 200 - Paginated organization results
   * @return {ApiErrorResponse} 400 - Invalid query parameters
   * @return {ApiErrorResponse} 401 - Authentication required
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
    const {
      q: query,
      page,
      limit,
    } = organizationSearchQuerySchema.parse(req.query);
    const user = this.getAuthenticatedUser(req);

    // Search with pagination
    const result = await this.organizationService.searchOrganizations(query, {
      page,
      limit,
    });

    const response = OrganizationMapper.toOrganizationSearchResponse(
      result
    ).withSchema(organizationSearchResponseSchema);
    res.status(HttpStatus.OK).json(response);

    this.logger.info('Organization search performed', {
      searchQuery: query,
      userId: user.id,
      resultsCount: result.organizations.length,
      page,
      limit,
    });
  }
}
