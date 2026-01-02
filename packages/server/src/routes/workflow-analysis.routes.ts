/**
 * Workflow Analysis Routes
 * API endpoints for AI-powered workflow analysis
 *
 * Endpoints:
 * - POST /api/v2/workflow-analysis/ingest                      - Ingest screenshots from desktop app
 * - POST /api/v2/workflow-analysis/:nodeId/trigger             - Trigger workflow analysis for a node
 * - GET  /api/v2/workflow-analysis/:nodeId                     - Get workflow analysis results
 * - POST /api/v2/workflow-analysis/search                      - Hybrid search across screenshots
 *
 * Graph RAG Endpoints:
 * - GET  /api/v2/workflow-analysis/:nodeId/cross-session-context - Get cross-session context from Graph RAG
 * - POST /api/v2/workflow-analysis/entities/search             - Search entities by similarity
 * - POST /api/v2/workflow-analysis/concepts/search             - Search concepts by similarity
 * - GET  /api/v2/workflow-analysis/health/graph                - Health check for Graph RAG services
 */

import { Router } from 'express';

import { CONTAINER_TOKENS } from '../core/container-tokens.js';
import { requireAuth, containerMiddleware } from '../middleware/index.js';

const router = Router();

/**
 * @route GET /api/v2/workflow-analysis/health
 * @summary Health check for workflow analysis service
 * @description Tests if the OpenAI embedding service is configured and working
 * @response {200} Service healthy
 * @response {500} Service unhealthy
 */
router.get('/health', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const embeddingService = req.scope.resolve(
      CONTAINER_TOKENS.OPENAI_EMBEDDING_SERVICE
    );

    // Test embedding generation with a simple text
    const testEmbedding = await embeddingService.generateEmbedding('test');

    res.json({
      success: true,
      message: 'Workflow analysis service is healthy',
      embeddingDimensions: testEmbedding.length,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      openAIKeyPrefix: process.env.OPENAI_API_KEY?.substring(0, 10) + '...',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Workflow analysis service is unhealthy',
      error: error.message,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      openAIKeyPrefix: process.env.OPENAI_API_KEY?.substring(0, 10) + '...',
    });
  }
});

// All workflow analysis routes require authentication
router.use(requireAuth);

/**
 * @route POST /api/v2/workflow-analysis/ingest
 * @summary Ingest screenshots from Desktop-companion
 * @description Receives screenshot data from desktop app session and stores them
 *              in the vector database with embeddings for hybrid search.
 * @body {IngestScreenshotsRequest} Screenshot data from desktop session
 * @response {200} {IngestScreenshotsResponse} Screenshots ingested successfully
 * @response {400} {ApiErrorResponse} Validation error
 * @response {401} {ApiErrorResponse} Authentication required
 * @security BearerAuth
 */
router.post(
  '/ingest',
  containerMiddleware,
  async (req: any, res: any, next: any) => {
    try {
      const controller = req.scope.resolve(
        CONTAINER_TOKENS.WORKFLOW_ANALYSIS_CONTROLLER
      );
      await controller.ingestScreenshots(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Migration Endpoints - MUST be before /:nodeId routes
 */

/**
 * @route GET /api/v2/workflow-analysis/migration-status
 * @summary Check session_key migration status
 * @description Returns count of activities that need session_key format migration
 * @response {200} Migration status
 * @response {503} Graph service not available
 * @security BearerAuth
 */
router.get(
  '/migration-status',
  containerMiddleware,
  async (req: any, res: any, next: any) => {
    try {
      const controller = req.scope.resolve(
        CONTAINER_TOKENS.WORKFLOW_ANALYSIS_CONTROLLER
      );
      await controller.getMigrationStatus(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/v2/workflow-analysis/migrate-session-keys
 * @summary Run session_key migration
 * @description Fixes activities with incorrect session_key format (missing session_ prefix)
 * @response {200} Migration complete
 * @response {503} Graph service not available
 * @security BearerAuth
 */
router.post(
  '/migrate-session-keys',
  containerMiddleware,
  async (req: any, res: any, next: any) => {
    try {
      const controller = req.scope.resolve(
        CONTAINER_TOKENS.WORKFLOW_ANALYSIS_CONTROLLER
      );
      await controller.migrateSessionKeys(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/v2/workflow-analysis/:nodeId/trigger
 * @summary Trigger comprehensive workflow analysis
 * @description Analyzes all screenshots for a timeline node using the "Head Analyst" AI
 *              to generate insights, patterns, bottlenecks, and recommendations.
 * @param {string} nodeId - Timeline node UUID
 * @body {TriggerWorkflowAnalysisRequest} Analysis configuration
 * @response {200} {TriggerWorkflowAnalysisResponse} Analysis triggered successfully
 * @response {400} {ApiErrorResponse} Validation error
 * @response {401} {ApiErrorResponse} Authentication required
 * @response {404} {ApiErrorResponse} Node not found or no screenshots available
 * @security BearerAuth
 */
router.post(
  '/:nodeId/trigger',
  containerMiddleware,
  async (req: any, res: any, next: any) => {
    try {
      const controller = req.scope.resolve(
        CONTAINER_TOKENS.WORKFLOW_ANALYSIS_CONTROLLER
      );
      await controller.triggerWorkflowAnalysis(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/v2/workflow-analysis/:nodeId
 * @summary Get workflow analysis results
 * @description Retrieves the latest workflow analysis for a timeline node,
 *              including insights, metrics, and recommendations.
 * @param {string} nodeId - Timeline node UUID
 * @response {200} {GetWorkflowAnalysisResponse} Workflow analysis data
 * @response {401} {ApiErrorResponse} Authentication required
 * @response {404} {ApiErrorResponse} Analysis not found
 * @security BearerAuth
 */
router.get(
  '/:nodeId',
  containerMiddleware,
  async (req: any, res: any, next: any) => {
    try {
      const controller = req.scope.resolve(
        CONTAINER_TOKENS.WORKFLOW_ANALYSIS_CONTROLLER
      );
      await controller.getWorkflowAnalysis(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/v2/workflow-analysis/search
 * @summary Hybrid search across workflow screenshots
 * @description Performs hybrid search combining BM25 lexical search and vector similarity
 *              to find relevant screenshots based on natural language queries.
 * @body {HybridSearchQuery} Search query and parameters
 * @response {200} {HybridSearchResponse} Search results
 * @response {400} {ApiErrorResponse} Validation error
 * @response {401} {ApiErrorResponse} Authentication required
 * @security BearerAuth
 */
router.post(
  '/search',
  containerMiddleware,
  async (req: any, res: any, next: any) => {
    try {
      const controller = req.scope.resolve(
        CONTAINER_TOKENS.WORKFLOW_ANALYSIS_CONTROLLER
      );
      await controller.hybridSearch(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Graph RAG Endpoints
 */

/**
 * @route GET /api/v2/workflow-analysis/:nodeId/cross-session-context
 * @summary Get cross-session context from Graph RAG
 * @description Retrieves entities, concepts, patterns, and related sessions
 *              from across multiple sessions using Graph RAG.
 * @param {string} nodeId - Timeline node UUID
 * @query {number} lookbackDays - How many days to look back (default: 30)
 * @query {number} maxResults - Maximum results to return (default: 20)
 * @query {boolean} includeGraph - Include graph traversal results (default: true)
 * @query {boolean} includeVectors - Include vector similarity results (default: true)
 * @response {200} {CrossSessionContextResponse} Cross-session context data
 * @response {401} {ApiErrorResponse} Authentication required
 * @response {503} {ApiErrorResponse} Graph RAG not enabled
 * @security BearerAuth
 */
router.get(
  '/:nodeId/cross-session-context',
  containerMiddleware,
  async (req: any, res: any, next: any) => {
    try {
      const controller = req.scope.resolve(
        CONTAINER_TOKENS.WORKFLOW_ANALYSIS_CONTROLLER
      );
      await controller.getCrossSessionContext(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/v2/workflow-analysis/entities/search
 * @summary Search entities by similarity
 * @description Searches for technologies, tools, and other entities
 *              using vector similarity search.
 * @body {SearchEntitiesRequest} Search query and filters
 * @response {200} {EntitySearchResponse} Matching entities with similarity scores
 * @response {400} {ApiErrorResponse} Validation error
 * @response {401} {ApiErrorResponse} Authentication required
 * @response {503} {ApiErrorResponse} Graph RAG not enabled
 * @security BearerAuth
 */
router.post(
  '/entities/search',
  containerMiddleware,
  async (req: any, res: any, next: any) => {
    try {
      const controller = req.scope.resolve(
        CONTAINER_TOKENS.WORKFLOW_ANALYSIS_CONTROLLER
      );
      await controller.searchEntities(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/v2/workflow-analysis/concepts/search
 * @summary Search concepts by similarity
 * @description Searches for programming concepts, activities, and patterns
 *              using vector similarity search.
 * @body {SearchConceptsRequest} Search query and filters
 * @response {200} {ConceptSearchResponse} Matching concepts with similarity scores
 * @response {400} {ApiErrorResponse} Validation error
 * @response {401} {ApiErrorResponse} Authentication required
 * @response {503} {ApiErrorResponse} Graph RAG not enabled
 * @security BearerAuth
 */
router.post(
  '/concepts/search',
  containerMiddleware,
  async (req: any, res: any, next: any) => {
    try {
      const controller = req.scope.resolve(
        CONTAINER_TOKENS.WORKFLOW_ANALYSIS_CONTROLLER
      );
      await controller.searchConcepts(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/v2/workflow-analysis/health/graph
 * @summary Health check for Graph RAG services
 * @description Checks connectivity and status of ArangoDB and PostgreSQL
 *              vector embeddings for Graph RAG functionality.
 * @response {200} Graph RAG services healthy
 * @response {503} Graph RAG services degraded or unhealthy
 */
router.get(
  '/health/graph',
  containerMiddleware,
  async (req: any, res: any, next: any) => {
    try {
      const controller = req.scope.resolve(
        CONTAINER_TOKENS.WORKFLOW_ANALYSIS_CONTROLLER
      );
      await controller.getGraphRAGHealth(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Top Workflow Endpoints
 */

/**
 * @route GET /api/v2/workflow-analysis/top-workflows
 * @summary Get top workflow patterns across all nodes
 * @description Analyzes workflow data using hybrid search (Graph RAG + semantic + BM25)
 *              to identify frequently repeated workflow patterns.
 * @query {number} limit - Maximum patterns to return (default: 5, max: 10)
 * @query {number} minOccurrences - Minimum occurrences for a pattern (default: 2)
 * @query {number} lookbackDays - Days to look back for analysis (default: 30)
 * @query {boolean} includeGraphRAG - Include Graph RAG context (default: true)
 * @response {200} {GetTopWorkflowsResponse} Top workflow patterns
 * @response {401} {ApiErrorResponse} Authentication required
 * @security BearerAuth
 */
router.get(
  '/top-workflows',
  containerMiddleware,
  async (req: any, res: any, next: any) => {
    try {
      const controller = req.scope.resolve(
        CONTAINER_TOKENS.WORKFLOW_ANALYSIS_CONTROLLER
      );
      await controller.getTopWorkflows(req, res);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/v2/workflow-analysis/:nodeId/top-workflows
 * @summary Get top workflow patterns for a specific node
 * @description Analyzes workflow data for a specific timeline node using hybrid search
 *              (Graph RAG + semantic + BM25) to identify frequently repeated patterns.
 * @param {string} nodeId - Timeline node UUID
 * @body {GetTopWorkflowsRequest} Analysis parameters
 * @response {200} {GetTopWorkflowsResponse} Top workflow patterns for the node
 * @response {400} {ApiErrorResponse} Validation error
 * @response {401} {ApiErrorResponse} Authentication required
 * @security BearerAuth
 */
router.post(
  '/:nodeId/top-workflows',
  containerMiddleware,
  async (req: any, res: any, next: any) => {
    try {
      const controller = req.scope.resolve(
        CONTAINER_TOKENS.WORKFLOW_ANALYSIS_CONTROLLER
      );
      await controller.getTopWorkflows(req, res);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
