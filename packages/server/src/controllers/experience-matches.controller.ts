/**
 * Experience Matches Controller (LIG-179)
 *
 * HTTP controller for experience matches endpoints.
 * Handles request/response for match detection API.
 */

import type { Request, Response } from 'express';

import { type ApiErrorResponse, type ApiSuccessResponse,ErrorCode, HttpStatus } from '../core';
import type { Logger } from '../core/logger';
import {
  ExperienceMatchesMapper,
  getExperienceMatchesParamsSchema,
  getExperienceMatchesQuerySchema,
  type GraphRAGSearchResponseDto,
} from '../dtos';
import type { IExperienceMatchesService } from '../services/interfaces';
import { BaseController } from './base-controller';

export interface ExperienceMatchesControllerDependencies {
  logger: Logger;
  experienceMatchesService: IExperienceMatchesService;
}

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
   * @return {ApiSuccessResponse<GetExperienceMatchesResponseDto>} 200 - GraphRAG search results with matched profiles
   * @return {ApiErrorResponse} 400 - Invalid request
   * @return {ApiErrorResponse} 404 - Node not found
   * @return {ApiErrorResponse} 422 - Not an experience node
   * @return {ApiErrorResponse} 503 - Search service unavailable
   * @example response - 200 - Successful match response
   * {
   *   "success": true,
   *   "data": {
   *     "results": [
   *       {
   *         "id": "123",
   *         "name": "John Doe",
   *         "email": "john@example.com",
   *         "username": "johndoe",
   *         "currentRole": "Senior Software Engineer",
   *         "company": "Google",
   *         "location": "San Francisco, CA",
   *         "matchScore": "0.95",
   *         "whyMatched": ["Has React experience", "Senior level engineer"],
   *         "skills": ["React", "TypeScript", "Node.js"],
   *         "matchedNodes": [
   *           {
   *             "id": "node-123",
   *             "type": "job",
   *             "meta": {},
   *             "score": 0.95,
   *             "insights": [
   *               {
   *                 "text": "Strong match for senior engineering role",
   *                 "category": "experience"
   *               }
   *             ]
   *           }
   *         ]
   *       }
   *     ],
   *     "totalResults": 1,
   *     "query": "Software Engineer with React experience"
   *   }
   * }
   */
  async getMatches(req: Request, res: Response): Promise<void> {
    try {
      // Validate params using Zod schema
      const paramsResult = getExperienceMatchesParamsSchema.safeParse(req.params);
      if (!paramsResult.success) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.INVALID_REQUEST,
            message: 'Invalid UUID format for nodeId',
            details: paramsResult.error.errors,
          },
        };
        res.status(HttpStatus.BAD_REQUEST).json(errorResponse);
        return;
      }

      const { nodeId } = paramsResult.data;

      // Validate query params using Zod schema
      const queryResult = getExperienceMatchesQuerySchema.safeParse(req.query);
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
            const errorResponse: ApiErrorResponse = {
              success: false,
              error: {
                code: ErrorCode.NODE_NOT_FOUND,
                message: 'Node not found',
              },
            };
            res.status(HttpStatus.NOT_FOUND).json(errorResponse);
            return;
          }
        } catch {
          const errorResponse: ApiErrorResponse = {
            success: false,
            error: {
              code: ErrorCode.NODE_NOT_FOUND,
              message: 'Node not found',
            },
          };
          res.status(HttpStatus.NOT_FOUND).json(errorResponse);
          return;
        }

        // If we get here, it's not an experience node
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.INVALID_OPERATION,
            message: 'Node must be a job or education type',
          },
        };
        res.status(HttpStatus.UNPROCESSABLE_ENTITY).json(errorResponse);
        return;
      }

      // Map service response to DTO and return
      const successResponse: ApiSuccessResponse<GraphRAGSearchResponseDto> = {
        success: true,
        data: ExperienceMatchesMapper.toResponseDto(searchResponse),
      };
      res.status(HttpStatus.OK).json(successResponse);
    } catch (error) {
      this.logger.error('Failed to get experience matches', error as Error);

      // Check if it's a GraphRAG service error
      if ((error as any).code === 'GRAPHRAG_ERROR') {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.EXTERNAL_SERVICE_ERROR,
            message: 'Search service temporarily unavailable',
          },
        };
        res.status(HttpStatus.SERVICE_UNAVAILABLE).json(errorResponse);
        return;
      }

      // Generic server error
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'An unexpected error occurred',
        },
      };
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }
}
