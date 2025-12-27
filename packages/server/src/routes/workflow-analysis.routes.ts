/**
 * Workflow Analysis Routes
 * API endpoints for AI-powered workflow analysis
 *
 * Endpoints:
 * - POST /api/v2/workflow-analysis/ingest            - Ingest screenshots from desktop app
 * - POST /api/v2/workflow-analysis/:nodeId/trigger   - Trigger workflow analysis for a node
 * - GET  /api/v2/workflow-analysis/:nodeId           - Get workflow analysis results
 * - POST /api/v2/workflow-analysis/search            - Hybrid search across screenshots
 */

import { Router } from 'express';

import { CONTAINER_TOKENS } from '../core/container-tokens.js';
import { requireAuth, containerMiddleware } from '../middleware/index.js';

const router = Router();

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

export default router;
