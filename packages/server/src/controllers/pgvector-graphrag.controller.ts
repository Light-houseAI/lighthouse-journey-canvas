/**
 * PgVector GraphRAG Controller Implementation
 *
 * HTTP request handling layer for pgvector-based GraphRAG search
 * Maintains exact API compatibility with Neo4j implementation
 */

import { Request, Response } from 'express';
import { z } from 'zod';

import { ErrorCode, HttpStatus, type ApiSuccessResponse, type ApiErrorResponse } from '../core';
import { ValidationError } from '../core/errors';
import type {
  GraphRAGSearchRequest,
  GraphRAGSearchResponse,
  IPgVectorGraphRAGController,
  IPgVectorGraphRAGService} from '../types/graphrag.types.js';
import { BaseController } from './base-controller.js';

const searchProfilesSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  limit: z.number().int().min(1).max(100).optional().default(20),
  tenantId: z.string().optional(),
  excludeUserId: z.number().int().optional(),
  similarityThreshold: z.number().min(0).max(1).optional()
});

export class PgVectorGraphRAGController extends BaseController implements IPgVectorGraphRAGController {
  private service: IPgVectorGraphRAGService;
  private logger?: any;

  constructor({
    pgVectorGraphRAGService,
    logger
  }: {
    pgVectorGraphRAGService: IPgVectorGraphRAGService;
    logger?: any;
  }) {
    super();
    this.service = pgVectorGraphRAGService;
    this.logger = logger;
  }

  /**
   * POST /api/v2/graphrag/search
   * @tags GraphRAG
   * @summary Search user profiles
   * @description Search for user profiles using pgvector-based GraphRAG semantic search
   * @security BearerAuth
   * @param {object} request.body.required - Search parameters
   * @param {string} request.body.query.required - Search query text
   * @param {number} request.body.limit - Maximum results (1-100, default: 20)
   * @param {string} request.body.tenantId - Optional tenant ID for filtering
   * @param {number} request.body.similarityThreshold - Minimum similarity score (0-1)
   * @return {ApiSuccessResponse<object>} 200 - Search results with matched profiles
   * @return {ApiErrorResponse} 400 - Invalid request
   * @return {ApiErrorResponse} 500 - Search service error
   * @example request - Search request
   * {
   *   "query": "Senior software engineer with React and TypeScript experience",
   *   "limit": 20,
   *   "similarityThreshold": 0.7
   * }
   * @example response - 200 - Search results
   * {
   *   "success": true,
   *   "data": {
   *     "results": [
   *       {
   *         "userId": 123,
   *         "score": 0.92,
   *         "profile": {
   *           "name": "John Doe",
   *           "experienceLine": "Senior Software Engineer at Google"
   *         }
   *       }
   *     ],
   *     "totalResults": 1,
   *     "query": "Senior software engineer..."
   *   }
   * }
   */
  async searchProfiles(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate request body
      const validationResult = searchProfilesSchema.safeParse(req.body);

      if (!validationResult.success) {
        throw new ValidationError('Invalid request', validationResult.error.errors);
      }

      const request: GraphRAGSearchRequest = validationResult.data as any;

      // Add current user ID to exclude from results and for permission checks
      const currentUserId = (req as any).userId || req.user?.id;
      // Convert to number if it's a string (user_id column is integer in database)
      const userIdAsNumber = currentUserId ? parseInt(currentUserId, 10) : undefined;
      request.excludeUserId = userIdAsNumber;
      request.requestingUserId = userIdAsNumber;

      // Log request
      this.logger?.info('GraphRAG search request received', {
        query: request.query,
        limit: request.limit,
        tenantId: request.tenantId,
        excludeUserId: userIdAsNumber,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Perform search
      const response = await this.service.searchProfiles(request);

      // Calculate response time
      const responseTime = Date.now() - startTime;

      // Log response
      this.logger?.info('GraphRAG search completed', {
        query: request.query,
        resultsCount: response.totalResults,
        responseTime,
        status: 200
      });

      // Set response headers
      res.setHeader('X-Response-Time', `${responseTime}ms`);

      const successResponse: ApiSuccessResponse<GraphRAGSearchResponse> = {
        success: true,
        data: response,
        meta: {
          total: response.totalResults,
        },
      };
      res.status(HttpStatus.OK).json(successResponse);

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Log error
      this.logger?.error('GraphRAG search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        query: req.body?.query,
        responseTime,
        status: 500
      });

      if (error instanceof ValidationError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: error.message,
            details: (error as any).details,
          },
        };
        res.status(HttpStatus.BAD_REQUEST).json(errorResponse);
        return;
      }

      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Failed to perform search',
        },
      };
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * GET /api/graphrag/health
   * @tags GraphRAG
   * @summary GraphRAG health check
   * @description Check if pgvector GraphRAG service is healthy
   * @return {ApiSuccessResponse<object>} 200 - Service is healthy
   * @example response - 200 - Healthy status
   * {
   *   "success": true,
   *   "data": {
   *     "status": "healthy",
   *     "service": "pgvector-graphrag",
   *     "timestamp": "2024-01-01T00:00:00.000Z"
   *   }
   * }
   */
  async healthCheck(_req: Request, res: Response): Promise<void> {
    try {
      // Could add database connectivity check here
      const response: ApiSuccessResponse<{
        status: string;
        service: string;
        timestamp: string;
      }> = {
        success: true,
        data: {
          status: 'healthy',
          service: 'pgvector-graphrag',
          timestamp: new Date().toISOString()
        },
      };
      res.status(HttpStatus.OK).json(response);
    } catch (error) {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Health check failed',
        },
      };
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }

  /**
   * GET /api/graphrag/stats
   * @tags GraphRAG
   * @summary Get service statistics
   * @description Retrieve performance metrics and statistics for GraphRAG service
   * @return {ApiSuccessResponse<object>} 200 - Service statistics
   * @example response - 200 - Statistics
   * {
   *   "success": true,
   *   "data": {
   *     "service": "pgvector-graphrag",
   *     "stats": {
   *       "totalChunks": 1500,
   *       "totalEdges": 3000,
   *       "avgResponseTime": 250
   *     },
   *     "timestamp": "2024-01-01T00:00:00.000Z"
   *   }
   * }
   */
  async getStats(_req: Request, res: Response): Promise<void> {
    try {
      // This could return metrics about search performance,
      // number of chunks, etc.
      const response: ApiSuccessResponse<{
        service: string;
        stats: {
          totalChunks: number;
          totalEdges: number;
          avgResponseTime: number;
        };
        timestamp: string;
      }> = {
        success: true,
        data: {
          service: 'pgvector-graphrag',
          stats: {
            // Add relevant statistics here
            totalChunks: 0,
            totalEdges: 0,
            avgResponseTime: 0
          },
          timestamp: new Date().toISOString()
        },
      };
      res.status(HttpStatus.OK).json(response);
    } catch (error) {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Failed to retrieve statistics',
        },
      };
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  }
}
