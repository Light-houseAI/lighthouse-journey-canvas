/**
 * ExperienceMatchesController
 * API endpoints for experience matching and profile discovery
 */

import {
  AuthenticationError,
  BusinessRuleError,
  type ExperienceMatchesSuccessResponse,
  HttpStatusCode,
  NotFoundError,
  ServiceUnavailableError,
} from '@journey/schema';
import type { Request, Response } from 'express';

import type { Logger } from '../core/logger';
import type { IExperienceMatchesService } from '../services/interfaces';

export interface ExperienceMatchesControllerDependencies {
  logger: Logger;
  experienceMatchesService: IExperienceMatchesService;
}

export class ExperienceMatchesController {
  private readonly logger: Logger;
  private readonly experienceMatchesService: IExperienceMatchesService;

  constructor({ logger, experienceMatchesService }: ExperienceMatchesControllerDependencies) {
    this.logger = logger;
    this.experienceMatchesService = experienceMatchesService;
  }

  /**
   * GET /api/v2/experience/:nodeId/matches
   * @summary Get experience matches for a timeline node
   * @tags Experience Matches
   * @description Retrieves matching profiles and career opportunities for a job or education node based on semantic similarity of the node's content. Uses intelligent caching by default with optional force refresh via query parameter. Returns similarity scores and match metadata for each result, powered by GraphRAG semantic search. Only works with job and education node types - other node types will return a business rule error. The endpoint validates user access permissions and ensures the node exists before performing the search.
   * @security BearerAuth
   * @param {string} nodeId.path.required - Timeline node UUID - example: 123e4567-e89b-12d3-a456-426614174000
   * @param {boolean} forceRefresh.query - Force refresh cached matches bypassing cache (default: false) - example: true
   * @return {ExperienceMatchesSuccessResponse} 200 - Successfully retrieved matches with scores and metadata
   * @example response - 200 - Success response example
   * {
   *   "success": true,
   *   "data": {
   *     "nodeId": "123e4567-e89b-12d3-a456-426614174000",
   *     "userId": 42,
   *     "matchCount": 3,
   *     "matches": [
   *       {
   *         "id": "match-1",
   *         "name": "Jane Smith",
   *         "title": "Senior Software Engineer",
   *         "company": "Tech Corp",
   *         "score": 0.92,
   *         "matchType": "profile",
   *         "previewText": "Experienced engineer with React and TypeScript..."
   *       }
   *     ],
   *     "searchQuery": "Software Engineer with React experience",
   *     "similarityThreshold": 0.7,
   *     "lastUpdated": "2024-01-15T10:30:00Z",
   *     "cacheTTL": 3600
   *   }
   * }
   * @return {ValidationErrorResponse} 400 - Invalid request parameters (e.g., malformed UUID)
   * @example response - 400 - Validation error example
   * {
   *   "success": false,
   *   "error": {
   *     "code": "INVALID_REQUEST",
   *     "message": "Invalid UUID format for nodeId",
   *     "details": [
   *       {
   *         "code": "invalid_string",
   *         "message": "Invalid UUID",
   *         "path": ["nodeId"]
   *       }
   *     ]
   *   }
   * }
   * @return {AuthenticationErrorResponse} 401 - Unauthorized - authentication required
   * @return {NotFoundErrorResponse} 404 - Node not found or user lacks access permissions
   * @example response - 404 - Not found example
   * {
   *   "success": false,
   *   "error": {
   *     "code": "NODE_NOT_FOUND",
   *     "message": "Node not found"
   *   }
   * }
   * @return {BusinessRuleErrorResponse} 422 - Not an experience node (must be job or education type)
   * @example response - 422 - Invalid node type example
   * {
   *   "success": false,
   *   "error": {
   *     "code": "NOT_EXPERIENCE_NODE",
   *     "message": "Node must be a job or education type"
   *   }
   * }
   * @return {InternalErrorResponse} 500 - Internal server error
   * @example response - 500 - Internal server error example
   * {
   *   "success": false,
   *   "error": {
   *     "code": "INTERNAL_ERROR",
   *     "message": "An unexpected error occurred"
   *   }
   * }
   * @return {ServiceUnavailableErrorResponse} 503 - Search service unavailable
   * @example response - 503 - Service unavailable example
   * {
   *   "success": false,
   *   "error": {
   *     "code": "SEARCH_SERVICE_ERROR",
   *     "message": "Search service temporarily unavailable"
   *   }
   * }
   */
  async getMatches(req: Request, res: Response) {
    const { nodeId } = req.params;
    const forceRefresh = (req.query.forceRefresh as string) === 'true' || req.query.forceRefresh === true;

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    const userId = user.id;

    // Get matches from service (now returns GraphRAGSearchResponse)
    const searchResponse = await this.experienceMatchesService.getExperienceMatches(
      nodeId,
      userId,
      forceRefresh || false
    );

    // Handle not found
    if (searchResponse === null) {
      // Check if node exists and user has access
      try {
        const shouldShow = await this.experienceMatchesService.shouldShowMatches(nodeId, userId);

        if (shouldShow === false) {
          throw new NotFoundError('Node not found');
        }
      } catch (error) {
        if (error instanceof NotFoundError) {
          throw error;
        }
        throw new NotFoundError('Node not found');
      }

      // If we get here, it's not an experience node
      throw new BusinessRuleError('Node must be a job or education type');
    }

    // Check if it's a GraphRAG service error
    if ((searchResponse as any).code === 'GRAPHRAG_ERROR') {
      throw new ServiceUnavailableError('Search service temporarily unavailable');
    }

    // Send success response with GraphRAG format
    const response: ExperienceMatchesSuccessResponse = {
      success: true,
      data: searchResponse
    };

    res.status(HttpStatusCode.OK).json(response);
  }
}
