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
  // AI Usage Overview schemas
  getAIUsageOverviewQuerySchema,
  getAIUsageOverviewResponseSchema,
  type AIUsageOverviewResult,
  // Natural Language Query schemas
  naturalLanguageQueryRequestSchema,
  naturalLanguageQueryResponseSchema,
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
import type { IWorkflowScreenshotRepository } from '../repositories/interfaces/workflow-screenshot.repository.interface.js';
import type { NaturalLanguageQueryService } from '../services/natural-language-query.service.js';
import { ArangoDBConnection } from '../config/arangodb.connection.js';
import { BaseController } from './base.controller.js';
import { aql } from 'arangojs';

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
  private workflowScreenshotRepository?: IWorkflowScreenshotRepository;

  // Natural Language Query service
  private naturalLanguageQueryService?: NaturalLanguageQueryService;

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
    workflowScreenshotRepository,
    // Natural Language Query service
    naturalLanguageQueryService,
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
    workflowScreenshotRepository?: IWorkflowScreenshotRepository;
    // Natural Language Query service
    naturalLanguageQueryService?: NaturalLanguageQueryService;
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
    this.workflowScreenshotRepository = workflowScreenshotRepository;

    // Natural Language Query service
    this.naturalLanguageQueryService = naturalLanguageQueryService;

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
      // Note: intentFilter and toolFilter come as comma-separated strings from query params
      const intentFilterRaw = req.query.intentFilter as string | undefined;
      const toolFilterRaw = req.query.toolFilter as string | undefined;

      const requestData = getHierarchicalWorkflowsRequestSchema.parse({
        userId: String(user.id),
        nodeId: req.query.nodeId,
        limit: req.query.limit,
        minOccurrences: req.query.minOccurrences,
        minConfidence: req.query.minConfidence,
        intentFilter: intentFilterRaw ? intentFilterRaw.split(',') : undefined,
        toolFilter: toolFilterRaw ? toolFilterRaw.split(',') : undefined,
        includeGlobal: req.query.includeGlobal,
      });

      this.logger.info('Getting hierarchical top workflows', {
        userId: user.id,
        nodeId: requestData.nodeId,
        limit: requestData.limit,
      });

      // Get top workflows
      const result = await this.hierarchicalTopWorkflowsService.getTopWorkflows({
        userId: String(user.id),
        nodeId: requestData.nodeId,
        limit: requestData.limit,
        minOccurrences: requestData.minOccurrences,
        minConfidence: requestData.minConfidence,
        intentFilter: requestData.intentFilter,
        toolFilter: requestData.toolFilter,
        includeGlobal: requestData.includeGlobal ?? true,
      });

      // Validate and return response
      const response = getHierarchicalWorkflowsResponseSchema.parse({
        success: true,
        data: {
          workflows: result.workflows,
          metadata: {
            totalPatterns: result.workflows.length,
            queryParams: {
              userId: String(user.id),
              nodeId: requestData.nodeId,
              limit: requestData.limit,
              minOccurrences: requestData.minOccurrences,
              minConfidence: requestData.minConfidence,
              intentFilter: requestData.intentFilter,
              toolFilter: requestData.toolFilter,
              includeGlobal: requestData.includeGlobal ?? true,
            },
            generatedAt: new Date().toISOString(),
          },
        },
        message: result.workflows.length > 0
          ? `Found ${result.workflows.length} hierarchical workflow patterns`
          : 'No workflow patterns found matching criteria',
      });

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const zodIssues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
        this.logger.error(`Zod validation failed for hierarchical workflows response: ${zodIssues}`);
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

      // Load screenshots for this block from ArangoDB + PostgreSQL
      let screenshots: Array<{
        id: number;
        summary: string | null;
        analysis?: string | null;
        appName: string;
        timestamp: string;
        cloudUrl?: string;
      }> = [];

      if (extractIfMissing && this.workflowScreenshotRepository) {
        try {
          // Get block from ArangoDB to get screenshot IDs
          const db = await ArangoDBConnection.getConnection();
          const blockQuery = aql`
            FOR block IN blocks
              FILTER block._key == ${blockId}
              RETURN block
          `;
          const cursor = await db.query(blockQuery);
          const block = await cursor.next();

          if (block && block.representativeScreenshotIds && block.representativeScreenshotIds.length > 0) {
            // Load screenshots from PostgreSQL
            const workflowScreenshots = await this.workflowScreenshotRepository.getScreenshotsByIds(
              block.representativeScreenshotIds
            );

            screenshots = workflowScreenshots.map((s) => {
              const meta = (s as any).meta || {};
              return {
                id: s.id,
                summary: s.summary,
                analysis: s.analysis,
                appName: meta.appName || meta.app_name || meta.activeApp || 'unknown',
                timestamp: s.timestamp,
                cloudUrl: s.cloudUrl || undefined,
              };
            });

            this.logger.debug('Loaded screenshots for block step extraction', {
              blockId,
              screenshotCount: screenshots.length,
            });
          }
        } catch (error) {
          this.logger.warn('Failed to load screenshots for block, proceeding without them', {
            blockId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Get steps for block (will extract if missing and requested)
      const result = await this.stepExtractionService.getStepsForBlock(
        blockId,
        screenshots,
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

// ============================================================================
  // AI USAGE OVERVIEW ENDPOINTS
  // ============================================================================

  /**
   * AI tool search queries for vector similarity
   */
  private static readonly AI_TOOL_QUERIES = [
    'ChatGPT GPT-4 OpenAI language model AI assistant',
    'GitHub Copilot AI code completion programming assistant',
    'Claude Anthropic AI assistant conversational',
    'Gemini Google AI Bard language model',
    'Midjourney DALL-E Stable Diffusion AI image generation',
    'Cursor AI code editor programming assistant',
    'Tabnine CodeWhisperer AI autocomplete',
  ];

  /**
   * AI concept search queries for vector similarity
   */
  private static readonly AI_CONCEPT_QUERIES = [
    'prompt engineering AI instruction design',
    'AI assisted coding programming with artificial intelligence',
    'AI debugging error fixing with machine learning',
    'AI research knowledge discovery machine learning',
    'AI content generation writing with language models',
    'AI data analysis machine learning insights',
    'AI automation workflow artificial intelligence',
  ];

  /**
   * GET /api/v2/workflow-analysis/:nodeId/ai-usage
   * Get AI usage overview for a node
   * Uses cross-session retrieval to analyze AI tool usage patterns
   */
  async getAIUsageOverview(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);
      const { nodeId } = req.params;

      // Check if Graph RAG services are available
      if (!this.crossSessionRetrievalService || !this.entityRepository || !this.conceptRepository) {
        res.status(503).json({
          success: false,
          message: 'Graph RAG features are not enabled on this server',
        });
        return;
      }

      // Parse query parameters
      const queryParams = getAIUsageOverviewQuerySchema.parse(req.query);

      this.logger.info('Fetching AI usage overview', {
        userId: user.id,
        nodeId,
        lookbackDays: queryParams.lookbackDays,
      });

      const startTime = Date.now();

      // =========================================================================
      // STRATEGY 1: Cross-Session Retrieval (Graph RAG + general vector search)
      // =========================================================================
      const contextPromise = this.crossSessionRetrievalService.retrieve({
        userId: user.id,
        nodeId: Number(nodeId),
        lookbackDays: queryParams.lookbackDays,
        maxResults: queryParams.limit * 2, // Get more to filter
        includeGraph: queryParams.includeGraph,
        includeVectors: queryParams.includeVectors,
      });

      // =========================================================================
      // STRATEGY 2: Dedicated AI vector similarity searches (parallel)
      // =========================================================================
      const aiEntitySearchPromises = WorkflowAnalysisController.AI_TOOL_QUERIES.map(
        (query) => this.crossSessionRetrievalService!.searchSimilarEntities(query, {
          limit: queryParams.limit,
          minSimilarity: 0.4, // Lower threshold to catch more AI tools
        }).catch((err) => {
          this.logger.warn(`AI entity search failed for query: ${query}`, { error: err.message });
          return [];
        })
      );

      const aiConceptSearchPromises = WorkflowAnalysisController.AI_CONCEPT_QUERIES.map(
        (query) => this.crossSessionRetrievalService!.searchSimilarConcepts(query, {
          limit: queryParams.limit,
          minSimilarity: 0.4,
        }).catch((err) => {
          this.logger.warn(`AI concept search failed for query: ${query}`, { error: err.message });
          return [];
        })
      );

      // Execute all queries in parallel
      const [context, ...searchResults] = await Promise.all([
        contextPromise,
        ...aiEntitySearchPromises,
        ...aiConceptSearchPromises,
      ]);

      // Split search results
      const aiEntitySearchResults = searchResults.slice(0, WorkflowAnalysisController.AI_TOOL_QUERIES.length);
      const aiConceptSearchResults = searchResults.slice(WorkflowAnalysisController.AI_TOOL_QUERIES.length);

      // =========================================================================
      // STRATEGY 3: Keyword filtering of cross-session results
      // =========================================================================
      const aiToolKeywords = ['gpt', 'chatgpt', 'claude', 'copilot', 'gemini', 'bard', 'ai', 'llm', 'openai', 'anthropic', 'midjourney', 'dall-e', 'stable diffusion', 'cursor', 'github copilot', 'tabnine', 'codewhisperer'];

      const keywordFilteredEntities = context.entities.filter((entity) => {
        const nameLower = entity.entityName.toLowerCase();
        return aiToolKeywords.some((keyword) => nameLower.includes(keyword)) ||
          entity.entityType?.toLowerCase().includes('ai') ||
          entity.entityType?.toLowerCase().includes('llm');
      });

      const aiConceptKeywords = ['prompt', 'ai', 'llm', 'machine learning', 'neural', 'model', 'inference', 'embedding', 'generation', 'completion', 'chat', 'assistant'];

      const keywordFilteredConcepts = context.concepts.filter((concept) => {
        const nameLower = concept.conceptName.toLowerCase();
        const categoryLower = concept.category?.toLowerCase() || '';
        return aiConceptKeywords.some((keyword) => nameLower.includes(keyword) || categoryLower.includes(keyword));
      });

      // =========================================================================
      // FUSION: Merge results from all strategies
      // =========================================================================
      const entityMap = new Map<string, typeof context.entities[0] & { similarity?: number }>();

      // Add keyword-filtered entities
      for (const entity of keywordFilteredEntities) {
        const key = entity.entityName.toLowerCase();
        entityMap.set(key, { ...entity, similarity: entity.similarity || 0.7 });
      }

      // Add vector similarity search results (higher similarity scores)
      for (const searchResult of aiEntitySearchResults) {
        for (const entity of searchResult as any[]) {
          const key = entity.entityName.toLowerCase();
          const existing = entityMap.get(key);
          if (existing) {
            // Boost score if found in both
            entityMap.set(key, {
              ...existing,
              similarity: Math.max(existing.similarity || 0, entity.similarity || 0) + 0.1,
              frequency: Math.max(existing.frequency, entity.frequency),
            });
          } else {
            entityMap.set(key, entity);
          }
        }
      }

      const conceptMap = new Map<string, typeof context.concepts[0] & { similarity?: number }>();

      // Add keyword-filtered concepts
      for (const concept of keywordFilteredConcepts) {
        const key = concept.conceptName.toLowerCase();
        conceptMap.set(key, { ...concept, similarity: concept.similarity || 0.7 });
      }

      // Add vector similarity search results
      for (const searchResult of aiConceptSearchResults) {
        for (const concept of searchResult as any[]) {
          const key = concept.conceptName.toLowerCase();
          const existing = conceptMap.get(key);
          if (existing) {
            conceptMap.set(key, {
              ...existing,
              similarity: Math.max(existing.similarity || 0, concept.similarity || 0) + 0.1,
              frequency: Math.max(existing.frequency, concept.frequency),
            });
          } else {
            conceptMap.set(key, concept);
          }
        }
      }

      // Convert to arrays and sort by combined score
      const aiEntities = Array.from(entityMap.values())
        .sort((a, b) => {
          const scoreA = (a.similarity || 0) * 0.5 + Math.log(a.frequency + 1) * 0.5;
          const scoreB = (b.similarity || 0) * 0.5 + Math.log(b.frequency + 1) * 0.5;
          return scoreB - scoreA;
        })
        .slice(0, queryParams.limit);

      const aiConcepts = Array.from(conceptMap.values())
        .sort((a, b) => {
          const scoreA = (a.similarity || 0) * 0.5 + Math.log(a.frequency + 1) * 0.5;
          const scoreB = (b.similarity || 0) * 0.5 + Math.log(b.frequency + 1) * 0.5;
          return scoreB - scoreA;
        })
        .slice(0, queryParams.limit);

      // Calculate metrics
      const totalSessions = context.relatedSessions.length;
      const sessionsWithAI = context.relatedSessions.filter((session) => {
        // Check if session has AI-related activity
        return aiEntities.some((e) => e.lastSeen === session.startTime) ||
          aiConcepts.some((c) => c.lastSeen === session.startTime);
      }).length;

      const aiAdoptionRate = totalSessions > 0 ? (sessionsWithAI / totalSessions) * 100 : 0;

      // Helper to convert Date to ISO string
      const toISOString = (date: Date | string | undefined): string => {
        if (!date) return new Date().toISOString();
        if (date instanceof Date) return date.toISOString();
        return String(date);
      };

      // Map entities to AI tools format
      const topAITools = aiEntities.slice(0, queryParams.limit).map((entity) => ({
        name: entity.entityName,
        category: this.categorizeAITool(entity.entityName) as 'llm' | 'code_assistant' | 'image_generation' | 'search' | 'automation' | 'analytics' | 'other',
        usageCount: entity.usageCount || entity.frequency,
        sessionCount: Math.ceil((entity.usageCount || entity.frequency) / 3), // Estimate
        lastUsed: toISOString(entity.lastSeen),
        confidence: entity.similarity || 0.8,
      }));

      // Map concepts to AI concepts format
      const aiConceptsFormatted = aiConcepts.slice(0, queryParams.limit).map((concept) => ({
        name: concept.conceptName,
        category: this.categorizeAIConcept(concept.category || 'other') as 'prompt_engineering' | 'ai_assisted_coding' | 'ai_debugging' | 'ai_research' | 'ai_content_generation' | 'ai_data_analysis' | 'ai_automation' | 'other',
        frequency: concept.frequency,
        sessionCount: Math.ceil(concept.frequency / 2), // Estimate
        lastSeen: toISOString(concept.lastSeen),
        confidence: concept.similarity || 0.8,
      }));

      // Build usage trends from temporal sequence (convert Date to string)
      const temporalSequenceStrings = context.temporalSequence.map((t) => ({
        sessionId: t.sessionId,
        timestamp: toISOString(t.timestamp),
      }));
      const usageTrends = this.buildUsageTrends(temporalSequenceStrings, aiEntities);

      // Build AI workflows from workflow patterns
      const topAIWorkflows = context.workflowPatterns
        .filter((pattern) => {
          const transitionLower = pattern.transition.toLowerCase();
          return aiToolKeywords.some((keyword) => transitionLower.includes(keyword));
        })
        .slice(0, 5)
        .map((pattern, index) => ({
          id: `ai-workflow-${index}`,
          name: pattern.transition,
          description: `AI-related workflow pattern`,
          aiToolsUsed: aiEntities.slice(0, 3).map((e) => e.entityName),
          occurrenceCount: pattern.frequency,
          avgDurationSeconds: pattern.avgTransitionTime || 300,
          confidence: 0.75,
          lastOccurred: new Date().toISOString(),
        }));

      // Build recent AI sessions
      const recentAISessions = context.relatedSessions.slice(0, 10).map((session) => ({
        sessionId: session.sessionId,
        date: toISOString(session.startTime),
        durationSeconds: session.endTime
          ? Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000)
          : 1800,
        aiToolsUsed: aiEntities.slice(0, 3).map((e) => e.entityName),
        aiConceptsApplied: aiConcepts.slice(0, 2).map((c) => c.conceptName),
        workflowName: session.workflowClassification,
      }));

      const totalTimeMs = Date.now() - startTime;

      // Build response
      const result: AIUsageOverviewResult = {
        nodeId,
        userId: user.id,
        metrics: {
          totalSessions,
          sessionsWithAI: sessionsWithAI || Math.min(totalSessions, aiEntities.length),
          aiAdoptionRate: aiAdoptionRate || (aiEntities.length > 0 ? 50 : 0),
          totalAIToolUsages: aiEntities.reduce((sum, e) => sum + (e.usageCount || e.frequency), 0),
          uniqueAITools: aiEntities.length,
          mostUsedTool: aiEntities[0]?.entityName,
          avgAIToolsPerSession: totalSessions > 0 ? aiEntities.length / totalSessions : 0,
          totalTimeWithAI: sessionsWithAI * 1800, // Estimate 30 min per session
        },
        topAITools,
        aiConcepts: aiConceptsFormatted,
        topAIWorkflows,
        usageTrends,
        recentAISessions,
        retrievalMetadata: {
          graphQueryTimeMs: context.retrievalMetadata.graphQueryTimeMs,
          vectorQueryTimeMs: context.retrievalMetadata.vectorQueryTimeMs,
          totalTimeMs,
          entitiesScanned: context.retrievalMetadata.graphResultCount,
          conceptsScanned: context.retrievalMetadata.vectorResultCount,
          sessionsAnalyzed: totalSessions,
        },
        analyzedAt: new Date().toISOString(),
        dataRangeStart: new Date(Date.now() - queryParams.lookbackDays * 24 * 60 * 60 * 1000).toISOString(),
        dataRangeEnd: new Date().toISOString(),
      };

      // Validate and return response
      const response = getAIUsageOverviewResponseSchema.parse({
        success: true,
        data: result,
        message: aiEntities.length > 0
          ? `Found ${aiEntities.length} AI tools and ${aiConcepts.length} AI concepts`
          : 'No AI usage data found for this node',
      });

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

      this.logger.error('Failed to get AI usage overview', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to retrieve AI usage overview',
        data: null,
      });
    }
  }

  /**
   * POST /api/v2/workflow-analysis/:nodeId/ai-usage/trigger
   * Trigger AI usage analysis for a node
   */
  async triggerAIUsageAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);
      const { nodeId } = req.params;

      this.logger.info('Triggering AI usage analysis', {
        userId: user.id,
        nodeId,
      });

      // For now, just return success - the getAIUsageOverview already does the analysis
      res.status(200).json({
        success: true,
        message: 'AI usage analysis triggered successfully',
        analysisJobId: crypto.randomUUID(),
      });
    } catch (error) {
      this.logger.error('Failed to trigger AI usage analysis', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to trigger AI usage analysis',
      });
    }
  }

  /**
   * Helper: Categorize AI tool by name
   */
  private categorizeAITool(toolName: string): string {
    const nameLower = toolName.toLowerCase();

    if (nameLower.includes('gpt') || nameLower.includes('claude') || nameLower.includes('gemini') || nameLower.includes('llama') || nameLower.includes('bard')) {
      return 'llm';
    }
    if (nameLower.includes('copilot') || nameLower.includes('tabnine') || nameLower.includes('codewhisperer') || nameLower.includes('cursor')) {
      return 'code_assistant';
    }
    if (nameLower.includes('dall-e') || nameLower.includes('midjourney') || nameLower.includes('stable diffusion') || nameLower.includes('imagen')) {
      return 'image_generation';
    }
    if (nameLower.includes('perplexity') || nameLower.includes('you.com') || nameLower.includes('search')) {
      return 'search';
    }
    if (nameLower.includes('zapier') || nameLower.includes('make') || nameLower.includes('automation')) {
      return 'automation';
    }

    return 'other';
  }

  /**
   * Helper: Categorize AI concept by category
   */
  private categorizeAIConcept(category: string): string {
    const categoryLower = category.toLowerCase();

    if (categoryLower.includes('prompt')) {
      return 'prompt_engineering';
    }
    if (categoryLower.includes('coding') || categoryLower.includes('code')) {
      return 'ai_assisted_coding';
    }
    if (categoryLower.includes('debug')) {
      return 'ai_debugging';
    }
    if (categoryLower.includes('research')) {
      return 'ai_research';
    }
    if (categoryLower.includes('content') || categoryLower.includes('writing')) {
      return 'ai_content_generation';
    }
    if (categoryLower.includes('data') || categoryLower.includes('analysis')) {
      return 'ai_data_analysis';
    }
    if (categoryLower.includes('automation')) {
      return 'ai_automation';
    }

    return 'other';
  }

  /**
   * Helper: Build usage trends from temporal sequence
   */
  private buildUsageTrends(
    temporalSequence: Array<{ sessionId: string; timestamp: string }>,
    aiEntities: Array<{ entityName: string; frequency: number }>
  ): Array<{ date: string; sessionCount: number; toolUsageCount: number; topTools: string[] }> {
    const trendMap = new Map<string, { sessionCount: number; toolUsageCount: number }>();

    // Group sessions by date
    temporalSequence.forEach((item) => {
      const date = new Date(item.timestamp).toISOString().split('T')[0];
      const existing = trendMap.get(date) || { sessionCount: 0, toolUsageCount: 0 };
      existing.sessionCount += 1;
      existing.toolUsageCount += Math.min(aiEntities.length, 3); // Estimate
      trendMap.set(date, existing);
    });

    // Convert to array and sort by date
    const trends = Array.from(trendMap.entries())
      .map(([date, data]) => ({
        date,
        sessionCount: data.sessionCount,
        toolUsageCount: data.toolUsageCount,
        topTools: aiEntities.slice(0, 3).map((e) => e.entityName),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7); // Last 7 days

    return trends;
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

  // ============================================================================
  // NATURAL LANGUAGE QUERY ENDPOINT
  // ============================================================================

  /**
   * POST /api/v2/workflow-analysis/query
   * Natural language query over work history using RAG
   * Combines Graph RAG (ArangoDB) + Vector Search (pgvector) + LLM generation
   */
  async naturalLanguageQuery(req: Request, res: Response): Promise<void> {
    try {
      const user = this.getAuthenticatedUser(req);

      // Check if Natural Language Query service is available
      if (!this.naturalLanguageQueryService) {
        res.status(503).json({
          success: false,
          message: 'Natural language query service is not enabled on this server',
        });
        return;
      }

      // Validate request body
      const requestData = naturalLanguageQueryRequestSchema.parse(req.body);

      this.logger.info('Processing natural language query', {
        userId: user.id,
        query: requestData.query,
        nodeId: requestData.nodeId,
        lookbackDays: requestData.lookbackDays,
      });

      // Execute the RAG query pipeline
      const result = await this.naturalLanguageQueryService.query(
        user.id,
        requestData
      );

      // Validate and return response
      const response = naturalLanguageQueryResponseSchema.parse({
        success: true,
        data: result,
        message: result.sources.length > 0
          ? `Found ${result.sources.length} relevant sources`
          : 'No relevant sources found, but generated a response based on available context',
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

      this.logger.error('Natural language query failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Natural language query failed',
        data: null,
      });
    }
  }
}
