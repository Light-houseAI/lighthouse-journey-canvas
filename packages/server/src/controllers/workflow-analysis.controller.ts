/**
 * Workflow Analysis Controller
 *
 * Handles HTTP endpoints for workflow analysis feature:
 * - Triggering AI-powered workflow analysis
 * - Hybrid search across workflow screenshots
 * - Ingesting screenshots from Desktop-companion
 * - Retrieving workflow insights
 */

import {
  getWorkflowAnalysisResponseSchema,
  hybridSearchQuerySchema,
  hybridSearchResponseSchema,
  ingestScreenshotsRequestSchema,
  ingestScreenshotsResponseSchema,
  triggerWorkflowAnalysisRequestSchema,
  triggerWorkflowAnalysisResponseSchema,
  getCrossSessionContextQuerySchema,
  crossSessionContextResponseSchema,
  searchEntitiesRequestSchema,
  entitySearchResponseSchema,
  searchConceptsRequestSchema,
  conceptSearchResponseSchema,
  graphRAGHealthResponseSchema,
} from '@journey/schema';
import type { Request, Response } from 'express';
import { z } from 'zod';

import type { Logger } from '../core/logger.js';
import type { IWorkflowAnalysisService } from '../services/workflow-analysis.service.js';
import type { CrossSessionRetrievalService } from '../services/cross-session-retrieval.service.js';
import type { ArangoDBGraphService } from '../services/arangodb-graph.service.js';
import type { EntityEmbeddingRepository } from '../repositories/entity-embedding.repository.js';
import type { ConceptEmbeddingRepository } from '../repositories/concept-embedding.repository.js';
import type { OpenAIEmbeddingService } from '../services/openai-embedding.service.js';
import { ArangoDBConnection } from '../config/arangodb.connection.js';
import { BaseController } from './base.controller.js';

export class WorkflowAnalysisController extends BaseController {
  private workflowAnalysisService: IWorkflowAnalysisService;
  private logger: Logger;

  // Optional Graph RAG services
  private crossSessionRetrievalService?: CrossSessionRetrievalService;
  private graphService?: ArangoDBGraphService;
  private entityRepository?: EntityEmbeddingRepository;
  private conceptRepository?: ConceptEmbeddingRepository;
  private embeddingService?: OpenAIEmbeddingService;

  constructor({
    workflowAnalysisService,
    logger,
    crossSessionRetrievalService,
    graphService,
    entityRepository,
    conceptRepository,
    embeddingService,
  }: {
    workflowAnalysisService: IWorkflowAnalysisService;
    logger: Logger;
    crossSessionRetrievalService?: CrossSessionRetrievalService;
    graphService?: ArangoDBGraphService;
    entityRepository?: EntityEmbeddingRepository;
    conceptRepository?: ConceptEmbeddingRepository;
    embeddingService?: OpenAIEmbeddingService;
  }) {
    super();
    this.workflowAnalysisService = workflowAnalysisService;
    this.logger = logger;
    this.crossSessionRetrievalService = crossSessionRetrievalService;
    this.graphService = graphService;
    this.entityRepository = entityRepository;
    this.conceptRepository = conceptRepository;
    this.embeddingService = embeddingService;

    if (this.crossSessionRetrievalService) {
      this.logger.info('Graph RAG services enabled in WorkflowAnalysisController');
    }
  }

  /**
   * POST /api/v2/workflow-analysis/ingest
   * Ingest screenshots from Desktop-companion session
   */
  async ingestScreenshots(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);

      // Validate request body
      const requestData = ingestScreenshotsRequestSchema.parse(req.body);

      this.logger.info('Ingesting workflow screenshots', {
        userId: user.id,
        sessionId: requestData.sessionId,
        nodeId: requestData.nodeId,
        screenshotCount: requestData.screenshots.length,
      });

      // Ingest screenshots
      const result = await this.workflowAnalysisService.ingestScreenshots(
        user.id,
        requestData
      );

      // Validate and return response
      const response = ingestScreenshotsResponseSchema.parse({
        success: true,
        message: `Successfully ingested ${result.ingested} screenshots`,
        ingested: result.ingested,
        failed: result.failed,
        screenshotIds: result.screenshotIds,
      });

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Invalid request data',
          errors: error.errors,
        });
        return;
      }

      this.logger.error('Failed to ingest screenshots', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to ingest screenshots',
      });
    }
  }

  /**
   * POST /api/v2/workflow-analysis/:nodeId/trigger
   * Trigger comprehensive workflow analysis for a node
   */
  async triggerWorkflowAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);
      const { nodeId } = req.params;

      // Validate request body
      const requestData = triggerWorkflowAnalysisRequestSchema.parse({
        nodeId,
        ...req.body,
      });

      this.logger.info('Triggering workflow analysis', {
        userId: user.id,
        nodeId,
      });

      // Trigger analysis
      const analysisResult =
        await this.workflowAnalysisService.triggerWorkflowAnalysis(
          user.id,
          requestData
        );

      // Validate and return response
      const response = triggerWorkflowAnalysisResponseSchema.parse({
        success: true,
        message: 'Workflow analysis completed successfully',
        analysisJobId: analysisResult.id,
      });

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Invalid request data',
          errors: error.errors,
        });
        return;
      }

      this.logger.error('Failed to trigger workflow analysis', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to trigger workflow analysis',
      });
    }
  }

  /**
   * GET /api/v2/workflow-analysis/:nodeId
   * Get workflow analysis results for a node
   */
  async getWorkflowAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);
      const { nodeId } = req.params;

      this.logger.info('Fetching workflow analysis', {
        userId: user.id,
        nodeId,
      });

      // Get analysis
      const analysisResult =
        await this.workflowAnalysisService.getWorkflowAnalysis(
          user.id,
          nodeId
        );

      // Validate and return response
      const response = getWorkflowAnalysisResponseSchema.parse({
        success: true,
        data: analysisResult,
        message: analysisResult
          ? 'Workflow analysis retrieved successfully'
          : 'No workflow analysis found for this node',
      });

      res.status(200).json(response);
    } catch (error) {
      this.logger.error('Failed to get workflow analysis', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to retrieve workflow analysis',
        data: null,
      });
    }
  }

  /**
   * POST /api/v2/workflow-analysis/search
   * Hybrid search across workflow screenshots
   */
  async hybridSearch(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);

      // Validate request body
      const query = hybridSearchQuerySchema.parse(req.body);

      this.logger.info('Performing hybrid search', {
        userId: user.id,
        query: query.query,
        nodeId: query.nodeId,
        limit: query.limit,
      });

      const startTime = Date.now();

      // Perform search
      const searchResult = await this.workflowAnalysisService.hybridSearch(
        user.id,
        query
      );

      const executionTime = Date.now() - startTime;

      // Validate and return response
      const response = hybridSearchResponseSchema.parse({
        success: true,
        data: {
          results: searchResult.results,
          totalResults: searchResult.totalResults,
          query: query.query,
          searchType: 'hybrid',
          executionTimeMs: executionTime,
        },
      });

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Invalid search query',
          errors: error.errors,
        });
        return;
      }

      this.logger.error('Hybrid search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'Hybrid search failed',
        data: {
          results: [],
          totalResults: 0,
          query: '',
          searchType: 'hybrid',
        },
      });
    }
  }

  /**
   * GET /api/v2/workflow-analysis/:nodeId/cross-session-context
   * Get cross-session context (entities, concepts, patterns) from Graph RAG
   */
  async getCrossSessionContext(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);
      const { nodeId } = req.params;

      // Check if Graph RAG is available
      if (!this.crossSessionRetrievalService) {
        res.status(503).json({
          success: false,
          message: 'Graph RAG features are not enabled on this server',
        });
        return;
      }

      // Validate query parameters
      const queryParams = getCrossSessionContextQuerySchema.parse(req.query);

      this.logger.info('Fetching cross-session context', {
        userId: user.id,
        nodeId,
        lookbackDays: queryParams.lookbackDays,
      });

      // Retrieve cross-session context
      const context = await this.crossSessionRetrievalService.retrieve({
        userId: user.id,
        nodeId: Number(nodeId),
        lookbackDays: queryParams.lookbackDays,
        maxResults: queryParams.maxResults,
        includeGraph: queryParams.includeGraph,
        includeVectors: queryParams.includeVectors,
      });

      // Validate and return response
      const response = crossSessionContextResponseSchema.parse(context);

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Invalid query parameters',
          errors: error.errors,
        });
        return;
      }

      this.logger.error('Failed to get cross-session context', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to retrieve cross-session context',
      });
    }
  }

  /**
   * POST /api/v2/workflow-analysis/entities/search
   * Search entities by similarity (technologies, tools, etc.)
   */
  async searchEntities(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);

      // Check if Graph RAG is available
      if (!this.entityRepository || !this.embeddingService) {
        res.status(503).json({
          success: false,
          message: 'Graph RAG features are not enabled on this server',
        });
        return;
      }

      // Validate request body
      const searchRequest = searchEntitiesRequestSchema.parse(req.body);

      this.logger.info('Searching entities', {
        userId: user.id,
        query: searchRequest.query,
        limit: searchRequest.limit,
      });

      // Generate embedding for the search query
      const queryEmbedding = await this.embeddingService.generateEmbedding(
        searchRequest.query
      );

      // Perform similarity search
      const results = await this.entityRepository.searchBySimilarity(
        queryEmbedding,
        searchRequest.limit,
        searchRequest.minSimilarity,
        searchRequest.entityType
      );

      // Validate and return response
      const response = entitySearchResponseSchema.parse({
        results: results.map((r) => ({
          entityName: r.entityName,
          entityType: r.entityType,
          frequency: r.frequency,
          usageCount: r.frequency, // Use frequency as usageCount
          similarity: r.similarity,
          lastSeen: r.lastSeen.toISOString(),
          source: 'vector' as const,
        })),
        totalResults: results.length,
        query: searchRequest.query,
      });

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Invalid request data',
          errors: error.errors,
        });
        return;
      }

      this.logger.error('Entity search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Entity search failed',
      });
    }
  }

  /**
   * POST /api/v2/workflow-analysis/concepts/search
   * Search concepts by similarity (programming concepts, activities, etc.)
   */
  async searchConcepts(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);

      // Check if Graph RAG is available
      if (!this.conceptRepository || !this.embeddingService) {
        res.status(503).json({
          success: false,
          message: 'Graph RAG features are not enabled on this server',
        });
        return;
      }

      // Validate request body
      const searchRequest = searchConceptsRequestSchema.parse(req.body);

      this.logger.info('Searching concepts', {
        userId: user.id,
        query: searchRequest.query,
        limit: searchRequest.limit,
      });

      // Generate embedding for the search query
      const queryEmbedding = await this.embeddingService.generateEmbedding(
        searchRequest.query
      );

      // Perform similarity search
      const results = await this.conceptRepository.searchBySimilarity(
        queryEmbedding,
        searchRequest.limit,
        searchRequest.minSimilarity
      );

      // Filter by category if specified
      const filteredResults = searchRequest.category
        ? results.filter((r) => r.category === searchRequest.category)
        : results;

      // Validate and return response
      const response = conceptSearchResponseSchema.parse({
        results: filteredResults.map((r) => ({
          conceptName: r.conceptName,
          category: r.category || 'general',
          frequency: r.frequency,
          usageCount: r.frequency, // Use frequency as usageCount
          similarity: r.similarity,
          lastSeen: r.lastSeen.toISOString(),
          source: 'vector' as const,
        })),
        totalResults: filteredResults.length,
        query: searchRequest.query,
      });

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Invalid request data',
          errors: error.errors,
        });
        return;
      }

      this.logger.error('Concept search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        success: false,
        message:
          error instanceof Error ? error.message : 'Concept search failed',
      });
    }
  }

  /**
   * GET /api/v2/workflow-analysis/health/graph
   * Health check for Graph RAG services (ArangoDB + PostgreSQL embeddings)
   */
  async getGraphRAGHealth(_req: Request, res: Response): Promise<void> {
    try {
      const healthStatus: {
        status: 'healthy' | 'degraded' | 'unhealthy';
        arangodb: {
          connected: boolean;
          latencyMs?: number;
          collections?: number;
          error?: string;
        };
        postgresql: {
          connected: boolean;
          latencyMs?: number;
          entityEmbeddings?: number;
          conceptEmbeddings?: number;
          error?: string;
        };
        services: {
          entityExtraction: boolean;
          crossSessionRetrieval: boolean;
          graphService: boolean;
        };
      } = {
        status: 'healthy',
        arangodb: { connected: false },
        postgresql: { connected: false },
        services: {
          entityExtraction: false,
          crossSessionRetrieval: !!this.crossSessionRetrievalService,
          graphService: !!this.graphService,
        },
      };

      // Check ArangoDB connection
      try {
        const arangoStart = Date.now();
        const db = await ArangoDBConnection.getConnection();
        const collections = await db.listCollections();
        const arangoLatency = Date.now() - arangoStart;

        healthStatus.arangodb = {
          connected: true,
          latencyMs: arangoLatency,
          collections: collections.length,
        };
      } catch (error) {
        healthStatus.arangodb = {
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        healthStatus.status = 'degraded';
      }

      // Check PostgreSQL embeddings
      try {
        const pgStart = Date.now();
        let entityCount = 0;
        let conceptCount = 0;

        if (this.entityRepository) {
          const entities = await this.entityRepository.getTopByFrequency(1);
          entityCount = entities.length;
        }

        if (this.conceptRepository) {
          const concepts = await this.conceptRepository.getTopByFrequency(1);
          conceptCount = concepts.length;
        }

        const pgLatency = Date.now() - pgStart;

        healthStatus.postgresql = {
          connected: true,
          latencyMs: pgLatency,
          entityEmbeddings: entityCount,
          conceptEmbeddings: conceptCount,
        };
      } catch (error) {
        healthStatus.postgresql = {
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        healthStatus.status = 'degraded';
      }

      // Determine overall status
      if (!healthStatus.arangodb.connected && !healthStatus.postgresql.connected) {
        healthStatus.status = 'unhealthy';
      }

      // Validate and return response
      const response = graphRAGHealthResponseSchema.parse(healthStatus);

      const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(response);
    } catch (error) {
      this.logger.error('Health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Health check failed',
      });
    }
  }
}
