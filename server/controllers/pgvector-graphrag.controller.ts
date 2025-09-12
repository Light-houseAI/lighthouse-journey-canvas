/**
 * PgVector GraphRAG Controller Implementation
 *
 * HTTP request handling layer for pgvector-based GraphRAG search
 * Maintains exact API compatibility with Neo4j implementation
 */

import { Request, Response } from 'express';
import { z } from 'zod';

import type {
  GraphRAGSearchRequest,
  IPgVectorGraphRAGController,
  IPgVectorGraphRAGService,
  GraphRAGSearchRequest
} from '../types/graphrag.types';
import { BaseController } from './base-controller';
import { ValidationError } from '../core/errors';

const searchProfilesSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  limit: z.number().int().min(1).max(100).optional().default(20),
  tenantId: z.string().optional(),
  excludeUserId: z.number().int().optional(),
  similarityThreshold: z.number().min(0).max(1).optional().default(0.5)
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
   *
   * Search for user profiles using GraphRAG
   */
  async searchProfiles(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate request body
      const validationResult = searchProfilesSchema.safeParse(req.body);

      if (!validationResult.success) {
        throw new ValidationError('Invalid request', validationResult.error.errors);
      }

      const request: GraphRAGSearchRequest = validationResult.data;

      // Add current user ID to exclude from results
      const currentUserId = (req as any).userId || req.user?.id;
      request.excludeUserId = currentUserId;

      // Log request
      this.logger?.info('GraphRAG search request received', {
        query: request.query,
        limit: request.limit,
        tenantId: request.tenantId,
        excludeUserId: currentUserId,
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

      return this.success(res, response, req, { total: response.totalResults });

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

      return this.error(res, error instanceof Error ? error : new Error('Failed to perform search'), req);
    }
  }

  /**
   * GET /api/graphrag/health
   *
   * Health check endpoint
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Could add database connectivity check here
      return this.success(res, {
        status: 'healthy',
        service: 'pgvector-graphrag',
        timestamp: new Date().toISOString()
      }, req);
    } catch (error) {
      return this.error(res, error instanceof Error ? error : new Error('Health check failed'), req);
    }
  }

  /**
   * GET /api/graphrag/stats
   *
   * Get service statistics (optional endpoint)
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      // This could return metrics about search performance,
      // number of chunks, etc.
      return this.success(res, {
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
      return this.error(res, error instanceof Error ? error : new Error('Failed to retrieve statistics'), req);
    }
  }
}
