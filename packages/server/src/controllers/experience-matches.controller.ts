/**
 * Experience Matches Controller (LIG-179)
 *
 * HTTP controller for experience matches endpoints.
 * Handles request/response for match detection API.
 */

import type { Request, Response } from 'express';
import { z } from 'zod';

import { ErrorCode, HttpStatus } from '../core';
import type { Logger } from '../core/logger';
import type { IExperienceMatchesService } from '../services/interfaces';
import { BaseController } from './base-controller';

export interface ExperienceMatchesControllerDependencies {
  logger: Logger;
  experienceMatchesService: IExperienceMatchesService;
}

// Request params schema
const getMatchesParamsSchema = z.object({
  nodeId: z.string().uuid('Invalid UUID format for nodeId'),
});

// Request query schema
const getMatchesQuerySchema = z.object({
  forceRefresh: z
    .string()
    .optional()
    .transform(val => val === 'true'),
});

export class ExperienceMatchesController extends BaseController {
  private readonly logger: Logger;
  private readonly experienceMatchesService: IExperienceMatchesService;

  constructor({ logger, experienceMatchesService }: ExperienceMatchesControllerDependencies) {
    super();
    this.logger = logger;
    this.experienceMatchesService = experienceMatchesService;
  }

  /**
   * GET /api/v2/experience/{nodeId}/matches
   * @tags Experience Matches
   * @summary Get experience matches
   * @description Get matching profiles for a job or education node using GraphRAG search
   * @security BearerAuth
   * @param {string} nodeId.path.required - Node UUID (must be job or education type)
   * @param {string} forceRefresh.query - Force refresh cache (true/false)
   * @return {object} 200 - GraphRAG search results with matched profiles
   * @return {object} 400 - Invalid request
   * @return {object} 404 - Node not found
   * @return {object} 422 - Not an experience node
   * @return {object} 503 - Search service unavailable
   * @example response - 200 - Successful match response
   * {
   *   "success": true,
   *   "data": {
   *     "results": [
   *       {
   *         "userId": 123,
   *         "score": 0.95,
   *         "name": "John Doe",
   *         "experienceLine": "Senior Software Engineer"
   *       }
   *     ],
   *     "totalResults": 1,
   *     "query": "Software Engineer with React experience"
   *   }
   * }
   */
  async getMatches(req: Request, res: Response): Promise<void> {
    try {
      // Validate params
      const paramsResult = getMatchesParamsSchema.safeParse(req.params);
      if (!paramsResult.success) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: ErrorCode.INVALID_REQUEST,
            message: 'Invalid UUID format for nodeId',
            details: paramsResult.error.errors,
          },
        });
        return;
      }

      const { nodeId } = paramsResult.data;

      // Validate query params
      const queryResult = getMatchesQuerySchema.safeParse(req.query);
      const forceRefresh = queryResult.success ? queryResult.data.forceRefresh : false;

      // Get authenticated user
      const user = this.getAuthenticatedUser(req);
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
            // Could be: node not found, no access, or not an experience node
            // We need to determine which error to return

            // For now, assume node not found
            // In production, we'd check more specifically
            res.status(HttpStatus.NOT_FOUND).json({
              success: false,
              error: {
                code: ErrorCode.NODE_NOT_FOUND,
                message: 'Node not found',
              },
            });
            return;
          }
        } catch {
          res.status(HttpStatus.NOT_FOUND).json({
            success: false,
            error: {
              code: ErrorCode.NODE_NOT_FOUND,
              message: 'Node not found',
            },
          });
          return;
        }

        // If we get here, it's not an experience node
        res.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
          success: false,
          error: {
            code: ErrorCode.INVALID_OPERATION,
            message: 'Node must be a job or education type',
          },
        });
        return;
      }

      // Return success response with GraphRAG format
      res.status(HttpStatus.OK).json({
        success: true,
        data: searchResponse,
      });
    } catch (error) {
      this.logger.error('Failed to get experience matches', error as Error);

      // Check for specific error types
      if (error instanceof z.ZodError) {
        res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid request parameters',
            details: error.errors,
          },
        });
        return;
      }

      // Check if it's a GraphRAG service error
      if ((error as any).code === 'GRAPHRAG_ERROR') {
        res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          success: false,
          error: {
            code: ErrorCode.EXTERNAL_SERVICE_ERROR,
            message: 'Search service temporarily unavailable',
          },
        });
        return;
      }

      // Generic server error
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'An unexpected error occurred',
        },
      });
    }
  }
}
