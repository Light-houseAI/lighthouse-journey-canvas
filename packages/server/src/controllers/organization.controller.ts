/**
 * OrganizationController
 * API endpoints for organization operations including user organizations and search
 */

import {
  AuthenticationError,
  type GetUserOrganizationsRequest,
  HttpStatusCode,
  organizationSearchQuerySchema,
  type SearchOrganizationsRequest,
  ValidationError,
} from '@journey/schema';

import type { Logger } from '../core/logger';
import type { IOrganizationRepository } from '../repositories/interfaces/organization.repository.interface.js';

export class OrganizationController {
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
    this.organizationRepository = organizationRepository;
    this.organizationService = organizationService;
    this.logger = logger;
  }

  /**
   * GET /api/v2/organizations
   * @summary Get user's organizations
   * @tags Organizations
   * @description Retrieves all organizations that the authenticated user is a member of. Organizations represent companies, educational institutions, or other entities associated with the user's career timeline. Returns a list of organizations with their basic information including ID, name, and domain.
   * @security BearerAuth
   * @return {GetUserOrganizationsSuccessResponse} 200 - Success response with user's organizations
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
   * @return {AuthenticationErrorResponse} 401 - Unauthorized - Authentication required
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async getUserOrganizations(req: GetUserOrganizationsRequest) {
    const res = req.res!;

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    const organizations = await this.organizationRepository.getUserOrganizations(user.id);

    this.logger.info('User organizations retrieved', {
      userId: user.id,
      organizationCount: organizations.length,
    });

    // Send success response
    const response = {
      success: true,
      data: organizations
    };

    res.status(HttpStatusCode.OK).json(response);
    return res;
  }

  /**
   * GET /api/v2/organizations/search
   * @summary Search organizations by name
   * @tags Organizations
   * @description Searches for organizations by name with pagination support. Uses partial name matching to find organizations in the system. Useful for autocomplete features, finding organizations to add to timeline nodes, or discovering existing organizations before creating new ones. Returns matching organizations with pagination metadata for efficient data loading.
   * @security BearerAuth
   * @param {string} q.query.required - Search query string to match organization names (minimum 1 character)
   * @param {number} page.query - Page number for pagination (default: 1, minimum: 1)
   * @param {number} limit.query - Number of results per page (default: 10, minimum: 1, maximum: 100)
   * @return {SearchOrganizationsSuccessResponse} 200 - Success response with search results
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
   * @return {ValidationErrorResponse} 400 - Bad request - Invalid query parameters
   * @return {AuthenticationErrorResponse} 401 - Unauthorized - Authentication required
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async searchOrganizations(req: SearchOrganizationsRequest) {
    const res = req.res!;

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    // Validate query parameters - throws ValidationError on failure
    const validationResult = organizationSearchQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      throw new ValidationError('Invalid query parameters', validationResult.error.errors);
    }

    const { q: query, page, limit } = validationResult.data;

    // Search with pagination
    const result = await this.organizationService.searchOrganizations(query, {
      page,
      limit,
    });

    this.logger.info('Organization search performed', {
      searchQuery: query,
      userId: user.id,
      resultsCount: result.organizations.length,
      page,
      limit,
    });

    // Send success response
    const response = {
      success: true,
      data: result
    };

    res.status(HttpStatusCode.OK).json(response);
    return res;
  }
}
