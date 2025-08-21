/**
 * OrganizationController
 * API endpoints for organization operations including user organizations and search
 */

import type { Request, Response } from 'express';
import type { Logger } from '../core/logger';
import type { IOrganizationRepository } from '../repositories/interfaces/organization.repository.interface';
import { BaseController } from './base-controller';
import { z } from 'zod';

// Request schemas for validation
const organizationSearchParamsSchema = z.object({
  q: z.string().min(1, 'Search query is required').max(100, 'Query too long')
});

export class OrganizationController extends BaseController {
  private readonly organizationRepository: IOrganizationRepository;
  private readonly logger: Logger;

  constructor({
    organizationRepository,
    logger
  }: {
    organizationRepository: IOrganizationRepository;
    logger: Logger;
  }) {
    super();
    this.organizationRepository = organizationRepository;
    this.logger = logger;
  }

  /**
   * Get user's organizations (organizations they are a member of)
   * GET /api/v2/organizations
   */
  async getUserOrganizations(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);

      const organizations = await this.organizationRepository.getUserOrganizations(user.id);

      res.json({
        success: true,
        data: organizations,
        count: organizations.length
      });

      this.logger.info('User organizations retrieved', {
        userId: user.id,
        organizationCount: organizations.length
      });
    } catch (error) {
      this.logger.error('Error getting user organizations', {
        userId: (req as any).user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      this.handleError(res, error as Error, 'getUserOrganizations');
    }
  }

  /**
   * Search organizations by name
   * GET /api/v2/organizations/search?q={query}
   */
  async searchOrganizations(req: Request, res: Response): Promise<void> {
    try {
      const { q: query } = organizationSearchParamsSchema.parse(req.query);
      const user = this.getAuthenticatedUser(req);

      // Limit results for search
      const organizations = await this.organizationRepository.searchOrganizations(query, 10);

      res.json({
        success: true,
        data: organizations,
        count: organizations.length
      });

      this.logger.info('Organization search performed', {
        searchQuery: query,
        userId: user.id,
        resultsCount: organizations.length
      });
    } catch (error) {
      this.logger.error('Error searching organizations', {
        query: req.query.q,
        userId: (req as any).user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      this.handleError(res, error as Error, 'searchOrganizations');
    }
  }

  /**
   * Handle organization-specific errors
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
      getUserOrganizations: 'Failed to retrieve user organizations',
      searchOrganizations: 'Failed to search organizations'
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