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

export class PgVectorGraphRAGController implements IPgVectorGraphRAGController {
  private service: IPgVectorGraphRAGService;
  private logger?: any;

  constructor({
    pgVectorGraphRAGService,
    logger
  }: {
    pgVectorGraphRAGService: IPgVectorGraphRAGService;
    logger?: any;
  }) {
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
        res.status(400).json({
          error: 'Invalid request',
          details: validationResult.error.errors
        });
        return;
      }

      const request: GraphRAGSearchRequest = validationResult.data;
      
      // Log request
      this.logger?.info('GraphRAG search request received', {
        query: request.query,
        limit: request.limit,
        tenantId: request.tenantId,
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
      res.setHeader('Content-Type', 'application/json');
      
      // Send response
      res.status(200).json(response);
      
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

      // Send error response
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to perform search',
        timestamp: new Date().toISOString()
      });
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
      res.status(200).json({
        status: 'healthy',
        service: 'pgvector-graphrag',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        service: 'pgvector-graphrag',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
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
      res.status(200).json({
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
      res.status(500).json({
        error: 'Failed to retrieve statistics',
        timestamp: new Date().toISOString()
      });
    }
  }
}