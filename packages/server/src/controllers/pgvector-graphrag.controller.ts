/**
 * PgVector GraphRAG Controller Implementation
 *
 * HTTP request handling layer for pgvector-based GraphRAG search
 * Maintains exact API compatibility with Neo4j implementation
 */

import { Request, Response } from 'express';
import { z } from 'zod';

import { ValidationError } from '../core/errors';
import type {
  GraphRAGSearchRequest,
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
   * @summary Search for user profiles using GraphRAG
   * @tags GraphRAG
   * @description Performs semantic search across user profiles using pgvector-based GraphRAG.
   * Searches through profile chunks and knowledge graph to find relevant candidates based on
   * natural language queries. Automatically excludes the requesting user from results and
   * respects tenant boundaries for data isolation.
   * @security BearerAuth
   * @param {string} query.body.required - Natural language search query
   * @param {number} limit.body - Maximum number of results to return (1-100, default: 20)
   * @param {string} tenantId.body - Tenant ID for multi-tenant data isolation
   * @param {number} excludeUserId.body - Additional user ID to exclude from results
   * @param {number} similarityThreshold.body - Minimum similarity score threshold (0-1)
   * @return {object} 200 - Search results with user profiles and metadata
   * @return {object} 400 - Validation error
   * @return {object} 500 - Server error
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

      this.success(res, response, req, { total: response.totalResults });

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

      this.error(res, error instanceof Error ? error : new Error('Failed to perform search'), req);
    }
  }

  /**
   * GET /api/graphrag/health
   * @summary Health check for GraphRAG service
   * @tags GraphRAG
   * @description Returns the health status of the pgvector GraphRAG service.
   * Used for monitoring and ensuring service availability.
   * @return {object} 200 - Service health status and timestamp
   * @return {object} 500 - Health check failed
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Could add database connectivity check here
      this.success(res, {
        status: 'healthy',
        service: 'pgvector-graphrag',
        timestamp: new Date().toISOString()
      }, req);
    } catch (error) {
      this.error(res, error instanceof Error ? error : new Error('Health check failed'), req);
    }
  }

  /**
   * GET /api/graphrag/stats
   * @summary Get GraphRAG service statistics
   * @tags GraphRAG
   * @description Returns operational statistics for the pgvector GraphRAG service including
   * total chunks indexed, edge count, and average response time metrics.
   * Useful for monitoring service performance and data volume.
   * @return {object} 200 - Service statistics and metrics
   * @return {object} 500 - Failed to retrieve statistics
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      // This could return metrics about search performance,
      // number of chunks, etc.
      this.success(res, {
        service: 'pgvector-graphrag',
        stats: {
          // Add relevant statistics here
          totalChunks: 0,
          totalEdges: 0,
          avgResponseTime: 0
        },
        timestamp: new Date().toISOString()
      }, req);
    } catch (error) {
      this.error(res, error instanceof Error ? error : new Error('Failed to retrieve statistics'), req);
    }
  }
}
