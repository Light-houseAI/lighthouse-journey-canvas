/**
 * PgVector GraphRAG Controller Implementation
 * 
 * HTTP request handling layer for pgvector-based GraphRAG search
 * Maintains exact API compatibility with Neo4j implementation
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import type {
  IPgVectorGraphRAGController,
  IPgVectorGraphRAGService,
  GraphRAGSearchRequest
} from '../types/graphrag.types';

// Request validation schema
const searchProfilesSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().positive().max(100).optional().default(20),
  similarityThreshold: z.number().min(0).max(1).optional().default(0.5),
  tenantId: z.string().optional()
});

/**
 * PgVector GraphRAG Controller Implementation
 * 
 * HTTP request handling layer for pgvector-based GraphRAG search
 * Maintains exact API compatibility with Neo4j implementation
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import type {
  IPgVectorGraphRAGController,
  IPgVectorGraphRAGService,
  GraphRAGSearchRequest
} from '../types/graphrag.types';
import { BaseController } from './base-controller';
import { ValidationError } from '../core/errors';

// Request validation schema
const searchProfilesSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().positive().max(100).optional().default(20),
  similarityThreshold: z.number().min(0).max(1).optional().default(0.5),
  tenantId: z.string().optional()
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
      
      this.handleSuccess(res, response, 200, { total: response.totalResults });
      
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

      this.handleError(res, error instanceof Error ? error : new Error('Failed to perform search'));
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
      this.handleSuccess(res, {
        status: 'healthy',
        service: 'pgvector-graphrag',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(res, error instanceof Error ? error : new Error('Health check failed'));
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
      this.handleSuccess(res, {
        service: 'pgvector-graphrag',
        stats: {
          // Add relevant statistics here
          totalChunks: 0,
          totalEdges: 0,
          avgResponseTime: 0
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(res, error instanceof Error ? error : new Error('Failed to retrieve statistics'));
    }
  }
}