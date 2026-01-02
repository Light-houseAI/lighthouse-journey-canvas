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
  getTopWorkflowsRequestSchema,
  getTopWorkflowsResponseSchema,
  // Hierarchical workflow schemas
  getHierarchicalWorkflowsRequestSchema,
  getHierarchicalWorkflowsResponseSchema,
  getBlockStepsResponseSchema,
  extractBlocksResponseSchema,
  getBlockTransitionsResponseSchema,
  getWorkflowPatternResponseSchema,
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
import type { HierarchicalTopWorkflowsService } from '../services/hierarchical-top-workflows.service.js';
import type { StepExtractionService } from '../services/step-extraction.service.js';
import type { BlockExtractionService } from '../services/block-extraction.service.js';
import type { BlockCanonicalizationService } from '../services/block-canonicalization.service.js';
import type { BlockLinkingService } from '../services/block-linking.service.js';
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

  // Hierarchical workflow services
  private hierarchicalTopWorkflowsService?: HierarchicalTopWorkflowsService;
  private stepExtractionService?: StepExtractionService;
  private blockExtractionService?: BlockExtractionService;
  private blockCanonicalizationService?: BlockCanonicalizationService;
  private blockLinkingService?: BlockLinkingService;

  constructor({
    workflowAnalysisService,
    logger,
    crossSessionRetrievalService,
    arangoDBGraphService,
    entityEmbeddingRepository,
    conceptEmbeddingRepository,
    openAIEmbeddingService,
    // Hierarchical workflow services
    hierarchicalTopWorkflowsService,
    stepExtractionService,
    blockExtractionService,
    blockCanonicalizationService,
    blockLinkingService,
  }: {
    workflowAnalysisService: IWorkflowAnalysisService;
    logger: Logger;
    crossSessionRetrievalService?: CrossSessionRetrievalService;
    arangoDBGraphService?: ArangoDBGraphService;
    entityEmbeddingRepository?: EntityEmbeddingRepository;
    conceptEmbeddingRepository?: ConceptEmbeddingRepository;
    openAIEmbeddingService?: OpenAIEmbeddingService;
    // Hierarchical workflow services
    hierarchicalTopWorkflowsService?: HierarchicalTopWorkflowsService;
    stepExtractionService?: StepExtractionService;
    blockExtractionService?: BlockExtractionService;
    blockCanonicalizationService?: BlockCanonicalizationService;
    blockLinkingService?: BlockLinkingService;
  }) {
    super();
    this.workflowAnalysisService = workflowAnalysisService;
    this.logger = logger;
    this.crossSessionRetrievalService = crossSessionRetrievalService;
    this.graphService = arangoDBGraphService;
    this.entityRepository = entityEmbeddingRepository;
    this.conceptRepository = conceptEmbeddingRepository;
    this.embeddingService = openAIEmbeddingService;

    // Hierarchical workflow services
    this.hierarchicalTopWorkflowsService = hierarchicalTopWorkflowsService;
    this.stepExtractionService = stepExtractionService;
    this.blockExtractionService = blockExtractionService;
    this.blockCanonicalizationService = blockCanonicalizationService;
    this.blockLinkingService = blockLinkingService;

    if (this.crossSessionRetrievalService) {
      this.logger.info('Graph RAG services enabled in WorkflowAnalysisController');
    }

    if (this.hierarchicalTopWorkflowsService) {
      this.logger.info('Hierarchical workflow services enabled in WorkflowAnalysisController');
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

  /**
   * GET /api/v2/workflow-analysis/top-workflows
   * POST /api/v2/workflow-analysis/:nodeId/top-workflows
   * Get top/frequently repeated workflow patterns using hybrid search
   */
  async getTopWorkflows(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);
      const { nodeId } = req.params;

      // Parse query parameters or body
      const requestData = getTopWorkflowsRequestSchema.parse({
        nodeId: nodeId || req.body?.nodeId || req.query?.nodeId,
        limit: req.body?.limit || req.query?.limit,
        minOccurrences: req.body?.minOccurrences || req.query?.minOccurrences,
        lookbackDays: req.body?.lookbackDays || req.query?.lookbackDays,
        includeGraphRAG: req.body?.includeGraphRAG ?? req.query?.includeGraphRAG ?? true,
      });

      this.logger.info('Getting top workflows', {
        userId: user.id,
        nodeId: requestData.nodeId,
        limit: requestData.limit,
      });

      // Analyze top workflows
      const result = await this.workflowAnalysisService.analyzeTopWorkflows(
        user.id,
        requestData
      );

      // Validate and return response
      const response = getTopWorkflowsResponseSchema.parse({
        success: true,
        data: result,
        message: result.patterns.length > 0
          ? `Found ${result.patterns.length} top workflow patterns`
          : 'No repeated workflow patterns found. Try lowering minOccurrences or extending lookbackDays.',
      });

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationDetails = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
        this.logger.error('Zod validation error in top workflows',
          new Error(`Validation failed: ${validationDetails}`)
        );
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors,
        });
        return;
      }

      this.logger.error('Failed to get top workflows', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to analyze top workflows',
        data: null,
      });
    }
  }

  /**
   * POST /api/v2/workflow-analysis/migrate-session-keys
   * Run migration to fix activities with incorrect session_key format
   * This is an admin endpoint to fix existing data
   */
  async migrateSessionKeys(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);

      this.logger.info('Running session_key migration', { userId: user.id });

      if (!this.graphService) {
        res.status(503).json({
          success: false,
          message: 'Graph service not available',
        });
        return;
      }

      // First get migration status
      const status = await this.graphService.getMigrationStatus();

      if (status.needsMigration === 0) {
        res.status(200).json({
          success: true,
          message: 'No activities need migration',
          data: status,
        });
        return;
      }

      // Run the migration
      const result = await this.graphService.migrateActivitySessionKeys();

      this.logger.info('Session key migration complete', {
        userId: user.id,
        updated: result.updated,
        failed: result.failed,
      });

      res.status(200).json({
        success: true,
        message: `Migration complete: ${result.updated} activities updated`,
        data: {
          ...status,
          updated: result.updated,
          failed: result.failed,
          errors: result.errors,
        },
      });
    } catch (error) {
      this.logger.error('Migration failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Migration failed',
      });
    }
  }

  /**
   * GET /api/v2/workflow-analysis/migration-status
   * Check how many activities need session_key migration
   */
  async getMigrationStatus(req: Request, res: Response): Promise<void> {
    try {
      this.getAuthenticatedUser(req);

      if (!this.graphService) {
        res.status(503).json({
          success: false,
          message: 'Graph service not available',
        });
        return;
      }

      const status = await this.graphService.getMigrationStatus();

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      this.logger.error('Failed to get migration status', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get migration status',
      });
    }
  }

  // ============================================================================
  // HIERARCHICAL WORKFLOW ENDPOINTS
  // ============================================================================

  /**
   * GET /api/v2/workflow-analysis/hierarchical/top-workflows
   * Get top hierarchical workflow patterns (Level 1 + Level 2)
   */
  async getHierarchicalTopWorkflows(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);

      // Check if hierarchical services are available
      if (!this.hierarchicalTopWorkflowsService) {
        res.status(503).json({
          success: false,
          message: 'Hierarchical workflow services are not enabled on this server',
        });
        return;
      }

      // Parse query parameters
      const requestData = getHierarchicalWorkflowsRequestSchema.parse({
        userId: user.id,
        nodeId: req.query.nodeId,
        limit: req.query.limit,
        minOccurrences: req.query.minOccurrences,
        minConfidence: req.query.minConfidence,
        intentFilter: req.query.intentFilter,
        toolFilter: req.query.toolFilter,
        includeGlobal: req.query.includeGlobal,
      });

      this.logger.info('Getting hierarchical top workflows', {
        userId: user.id,
        nodeId: requestData.nodeId,
        limit: requestData.limit,
      });

      // Get top workflows
      const result = await this.hierarchicalTopWorkflowsService.getTopWorkflows({
        userId: user.id,
        nodeId: requestData.nodeId,
        limit: requestData.limit,
        minOccurrences: requestData.minOccurrences,
        minConfidence: requestData.minConfidence,
        intentFilter: requestData.intentFilter,
        toolFilter: requestData.toolFilter,
      });

      // Validate and return response
      const response = getHierarchicalWorkflowsResponseSchema.parse({
        success: true,
        data: {
          workflows: result.patterns,
          metadata: {
            totalPatterns: result.patterns.length,
            queryParams: {
              userId: user.id,
              nodeId: requestData.nodeId,
              limit: requestData.limit,
              minOccurrences: requestData.minOccurrences,
              minConfidence: requestData.minConfidence,
              intentFilter: requestData.intentFilter,
              toolFilter: requestData.toolFilter,
              includeGlobal: requestData.includeGlobal,
            },
            generatedAt: new Date().toISOString(),
          },
        },
        message: result.patterns.length > 0
          ? `Found ${result.patterns.length} hierarchical workflow patterns`
          : 'No workflow patterns found matching criteria',
      });

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Invalid request parameters',
          errors: error.errors,
        });
        return;
      }

      this.logger.error('Failed to get hierarchical top workflows', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get hierarchical workflows',
        data: null,
      });
    }
  }

  /**
   * GET /api/v2/workflow-analysis/hierarchical/workflows/:workflowId
   * Get a single workflow pattern by ID
   */
  async getWorkflowPattern(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);
      const { workflowId } = req.params;

      // Check if hierarchical services are available
      if (!this.hierarchicalTopWorkflowsService) {
        res.status(503).json({
          success: false,
          message: 'Hierarchical workflow services are not enabled on this server',
        });
        return;
      }

      this.logger.info('Getting workflow pattern', {
        userId: user.id,
        workflowId,
      });

      // Get pattern by ID
      const pattern = await this.hierarchicalTopWorkflowsService.getPatternById(workflowId);

      if (!pattern) {
        res.status(404).json({
          success: false,
          message: `Workflow pattern ${workflowId} not found`,
          data: null,
        });
        return;
      }

      // Validate and return response
      const response = getWorkflowPatternResponseSchema.parse({
        success: true,
        data: pattern,
        message: 'Workflow pattern retrieved successfully',
      });

      res.status(200).json(response);
    } catch (error) {
      this.logger.error('Failed to get workflow pattern', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get workflow pattern',
        data: null,
      });
    }
  }

  /**
   * GET /api/v2/workflow-analysis/hierarchical/blocks/:blockId/steps
   * Drill down into a block to get its steps (Level 3)
   */
  async getBlockSteps(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);
      const { blockId } = req.params;

      // Check if step extraction service is available
      if (!this.stepExtractionService) {
        res.status(503).json({
          success: false,
          message: 'Step extraction service is not enabled on this server',
        });
        return;
      }

      const extractIfMissing = req.query.extractIfMissing !== 'false';

      this.logger.info('Getting block steps', {
        userId: user.id,
        blockId,
        extractIfMissing,
      });

      // Get steps for block (will extract if missing and requested)
      // Note: Screenshots need to be fetched from the session data
      const result = await this.stepExtractionService.getStepsForBlock(
        blockId,
        [], // Screenshots would be loaded from session/block context
        { extractIfMissing }
      );

      // Validate and return response
      const response = getBlockStepsResponseSchema.parse({
        success: true,
        data: result,
        message: result.steps.length > 0
          ? `Found ${result.steps.length} steps in block`
          : 'No steps found for this block',
      });

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message,
          data: null,
        });
        return;
      }

      this.logger.error('Failed to get block steps', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get block steps',
        data: null,
      });
    }
  }

  /**
   * POST /api/v2/workflow-analysis/hierarchical/sessions/:sessionId/extract-blocks
   * Extract blocks from a session's screenshots
   */
  async extractBlocksFromSession(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);
      const { sessionId } = req.params;

      // Check if block extraction services are available
      if (!this.blockExtractionService || !this.blockCanonicalizationService || !this.blockLinkingService) {
        res.status(503).json({
          success: false,
          message: 'Block extraction services are not enabled on this server',
        });
        return;
      }

      const forceReextract = req.body?.forceReextract === true;

      this.logger.info('Extracting blocks from session', {
        userId: user.id,
        sessionId,
        forceReextract,
      });

      // Get screenshots for this session
      // Note: In a full implementation, this would fetch from a screenshot repository
      // For now, we expect screenshots to be passed in the request body or fetched from session data
      const screenshots = req.body?.screenshots || [];

      if (!screenshots || screenshots.length === 0) {
        res.status(400).json({
          success: false,
          message: 'No screenshots provided for block extraction',
          data: null,
        });
        return;
      }

      // Extract raw blocks using extractBlocksFromSession (correct method name)
      const rawBlocks = await this.blockExtractionService.extractBlocksFromSession(
        sessionId,
        screenshots
      );

      // Canonicalize blocks
      const canonicalizedBlocks = await this.blockCanonicalizationService.canonicalizeBlocks(
        rawBlocks
      );

      // Link blocks sequentially
      await this.blockLinkingService.linkBlocksSequentially(
        canonicalizedBlocks,
        sessionId,
        user.id
      );

      // Validate and return response
      const response = extractBlocksResponseSchema.parse({
        success: true,
        data: {
          sessionId,
          blocksExtracted: canonicalizedBlocks.length,
          blocks: canonicalizedBlocks.map((block) => ({
            id: `blk_${block.canonicalSlug}`,
            canonicalName: block.canonicalName,
            intent: block.intentLabel,
            tool: block.primaryTool,
            screenshotCount: block.screenshots.length,
            durationSeconds: block.durationSeconds,
            confidence: block.confidence,
          })),
        },
        message: `Successfully extracted ${canonicalizedBlocks.length} blocks from session`,
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

      this.logger.error('Failed to extract blocks from session', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to extract blocks',
        data: null,
      });
    }
  }

  /**
   * GET /api/v2/workflow-analysis/hierarchical/blocks/:blockId/transitions
   * Get incoming and outgoing transitions for a block
   */
  async getBlockTransitions(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);
      const { blockId } = req.params;

      // Check if block linking service is available
      if (!this.blockLinkingService) {
        res.status(503).json({
          success: false,
          message: 'Block linking service is not enabled on this server',
        });
        return;
      }

      this.logger.info('Getting block transitions', {
        userId: user.id,
        blockId,
      });

      // Extract slug from blockId (format: blk_<slug>)
      const blockSlug = blockId.startsWith('blk_') ? blockId.slice(4) : blockId;

      // Get transitions
      const transitions = await this.blockLinkingService.getBlockTransitions(blockSlug);

      // Validate and return response
      const response = getBlockTransitionsResponseSchema.parse({
        success: true,
        data: {
          blockSlug,
          outgoing: transitions.outgoing,
          incoming: transitions.incoming,
        },
        message: `Found ${transitions.outgoing.length} outgoing and ${transitions.incoming.length} incoming transitions`,
      });

      res.status(200).json(response);
    } catch (error) {
      this.logger.error('Failed to get block transitions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get block transitions',
        data: null,
      });
    }
  }
}
