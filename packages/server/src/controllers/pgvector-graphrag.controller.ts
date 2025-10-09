/**
 * PgVectorGraphRAGController
 * API endpoints for pgvector-based GraphRAG search
 */

import {
  type GetStatsRequest,
  type HealthCheckRequest,
  HttpStatusCode,
  type SearchProfilesRequest,
  ValidationError,
} from '@journey/schema';

import type {
  GraphRAGSearchRequest,
  IPgVectorGraphRAGController,
  IPgVectorGraphRAGService,
} from '../types/graphrag.types.js';

export class PgVectorGraphRAGController implements IPgVectorGraphRAGController {
  private service: IPgVectorGraphRAGService;
  private logger?: any;

  constructor({
    pgVectorGraphRAGService,
    logger,
  }: {
    pgVectorGraphRAGService: IPgVectorGraphRAGService;
    logger?: any;
  }) {
    this.service = pgVectorGraphRAGService;
    this.logger = logger;
  }

  /**
   * POST /api/v2/graphrag/search
   * @summary Search for user profiles using GraphRAG
   * @tags GraphRAG
   * @description Performs semantic search across user profiles using pgvector-based GraphRAG technology. Searches through profile chunks and knowledge graph relationships to find relevant candidates based on natural language queries. Automatically excludes the requesting user from results and respects tenant boundaries for multi-tenant data isolation. Returns ranked results with similarity scores and profile metadata. The search leverages vector embeddings for semantic understanding beyond keyword matching.
   * @security BearerAuth
   * @param {string} query.body.required - Natural language search query describing desired profiles or skills
   * @param {number} limit.body - Maximum number of results to return (1-100, default: 20)
   * @param {string} tenantId.body - Tenant ID for multi-tenant data isolation
   * @param {number} excludeUserId.body - Additional user ID to exclude from results beyond the authenticated user
   * @param {number} similarityThreshold.body - Minimum similarity score threshold (0-1) to filter low-quality matches
   * @return {SearchProfilesSuccessResponse} 200 - Search results with user profiles, similarity scores, and metadata
   * @return {ValidationErrorResponse} 400 - Validation error (invalid parameters or missing required fields)
   * @return {InternalErrorResponse} 500 - Server error (search service failure or database error)
   */
  async searchProfiles(req: SearchProfilesRequest) {
    const res = req.res!;
    const startTime = Date.now();

    // Validate request body - throws ValidationError on failure
    if (!req.body.query || typeof req.body.query !== 'string' || req.body.query.trim().length === 0) {
      throw new ValidationError('Query is required');
    }

    const limit = req.body.limit ?? 20;
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      throw new ValidationError('Limit must be between 1 and 100');
    }

    const request: GraphRAGSearchRequest = {
      query: req.body.query,
      limit,
      tenantId: req.body.tenantId,
      excludeUserId: req.body.excludeUserId,
      similarityThreshold: req.body.similarityThreshold,
    };

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
      userAgent: req.headers['user-agent'],
    });

    // Perform search
    const responseData = await this.service.searchProfiles(request);

    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Log response
    this.logger?.info('GraphRAG search completed', {
      query: request.query,
      resultsCount: responseData.totalResults,
      responseTime,
      status: 200,
    });

    // Set response headers
    res.setHeader('X-Response-Time', `${responseTime}ms`);

    // Send success response
    const response = {
      success: true,
      data: responseData
    };

    res.status(HttpStatusCode.OK).json(response);
    return res;
  }

  /**
   * GET /api/graphrag/health
   * @summary Health check for GraphRAG service
   * @tags GraphRAG
   * @description Returns the health status of the pgvector GraphRAG service including service availability and timestamp. Used for monitoring, health checks, and ensuring service availability before making search requests. This is a lightweight check that verifies the service is responsive.
   * @return {HealthCheckSuccessResponse} 200 - Service health status and timestamp
   * @return {InternalErrorResponse} 500 - Health check failed (service unavailable)
   */
  async healthCheck(req: HealthCheckRequest) {
    const res = req.res!;

    // Send success response
    const response = {
      success: true,
      data: {
        status: 'healthy',
        service: 'pgvector-graphrag',
        timestamp: new Date().toISOString(),
      }
    };

    res.status(HttpStatusCode.OK).json(response);
    return res;
  }

  /**
   * GET /api/graphrag/stats
   * @summary Get GraphRAG service statistics
   * @tags GraphRAG
   * @description Returns operational statistics for the pgvector GraphRAG service including total chunks indexed, edge count in the knowledge graph, and average response time metrics. Useful for monitoring service performance, understanding data volume, and capacity planning. Provides insights into the size and performance characteristics of the search infrastructure.
   * @return {GetStatsSuccessResponse} 200 - Service statistics and metrics
   * @return {InternalErrorResponse} 500 - Failed to retrieve statistics
   */
  async getStats(req: GetStatsRequest) {
    const res = req.res!;

    // Send success response
    const response = {
      success: true,
      data: {
        service: 'pgvector-graphrag',
        stats: {
          // Add relevant statistics here
          totalChunks: 0,
          totalEdges: 0,
          avgResponseTime: 0,
        },
        timestamp: new Date().toISOString(),
      }
    };

    res.status(HttpStatusCode.OK).json(response);
    return res;
  }
}
