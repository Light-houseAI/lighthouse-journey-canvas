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
} from '@journey/schema';
import type { Request, Response } from 'express';
import { z } from 'zod';

import type { Logger } from '../core/logger.js';
import type { IWorkflowAnalysisService } from '../services/workflow-analysis.service.js';
import { BaseController } from './base.controller.js';

export class WorkflowAnalysisController extends BaseController {
  private workflowAnalysisService: IWorkflowAnalysisService;
  private logger: Logger;

  constructor({
    workflowAnalysisService,
    logger,
  }: {
    workflowAnalysisService: IWorkflowAnalysisService;
    logger: Logger;
  }) {
    super();
    this.workflowAnalysisService = workflowAnalysisService;
    this.logger = logger;
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
}
