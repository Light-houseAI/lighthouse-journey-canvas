/**
 * Insight Assistant Controller
 *
 * HTTP request handlers for the Insight Assistant feature.
 * Handles strategy proposal generation, feedback, and multi-agent insight generation.
 */

import {
  generateProposalsRequestSchema,
  proposalFeedbackRequestSchema,
  getProposalsQuerySchema,
  getPersonaSuggestionsRequestSchema,
} from '@journey/schema';
import { type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';

import type { Logger } from '../core/logger.js';
import type { InsightAssistantService } from '../services/insight-assistant.service.js';
import type { InsightGenerationService } from '../services/insight-generation/insight-generation.service.js';
import type { PersonaSuggestionService } from '../services/persona-suggestion.service.js';
import type { PersonaService } from '../services/persona.service.js';
import { generateInsightsRequestSchema } from '../services/insight-generation/schemas.js';
import { getInsightCacheManager } from '../services/insight-generation/utils/insight-cache.js';

/**
 * Insight Assistant Controller
 */
export class InsightAssistantController {
  private readonly insightAssistantService: InsightAssistantService;
  private readonly insightGenerationService?: InsightGenerationService;
  private readonly personaSuggestionService?: PersonaSuggestionService;
  private readonly personaService?: PersonaService;
  private readonly logger: Logger;

  constructor({
    insightAssistantService,
    insightGenerationService,
    personaSuggestionService,
    personaService,
    logger,
  }: {
    insightAssistantService: InsightAssistantService;
    insightGenerationService?: InsightGenerationService;
    personaSuggestionService?: PersonaSuggestionService;
    personaService?: PersonaService;
    logger: Logger;
  }) {
    this.insightAssistantService = insightAssistantService;
    this.insightGenerationService = insightGenerationService;
    this.personaSuggestionService = personaSuggestionService;
    this.personaService = personaService;
    this.logger = logger;
  }

  /**
   * POST /api/v2/insight-assistant/proposals
   * Generate strategy proposals based on user query
   */
  generateProposals = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const validatedData = generateProposalsRequestSchema.parse(req.body);

      const result = await this.insightAssistantService.generateProposals(
        userId,
        validatedData
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * POST /api/v2/insight-assistant/proposals/:id/feedback
   * Submit feedback for a strategy proposal
   */
  submitFeedback = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const { id } = req.params;
      const validatedData = proposalFeedbackRequestSchema.parse(req.body);

      const result = await this.insightAssistantService.submitFeedback(
        userId,
        id,
        validatedData
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Proposal not found') {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Proposal not found' },
        });
        return;
      }
      this.handleError(error, res);
    }
  };

  /**
   * GET /api/v2/insight-assistant/proposals
   * Get saved/bookmarked proposals for the user
   */
  getProposals = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const query = getProposalsQuerySchema.parse(req.query);

      const result = await this.insightAssistantService.getProposals(userId, {
        bookmarkedOnly: query.bookmarkedOnly,
        limit: query.limit,
        offset: query.offset,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  // ============================================================================
  // MULTI-AGENT INSIGHT GENERATION ENDPOINTS
  // ============================================================================

  /**
   * POST /api/v2/insight-assistant/generate
   * Start async insight generation job
   */
  generateInsights = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      if (!this.insightGenerationService) {
        res.status(503).json({
          success: false,
          error: { code: 'SERVICE_UNAVAILABLE', message: 'Insight generation service not available' },
        });
        return;
      }

      const validatedData = generateInsightsRequestSchema.parse(req.body);

      const { jobId, status } = await this.insightGenerationService.startJob(
        userId,
        validatedData.query,
        validatedData.options,
        validatedData.sessionContext,
        validatedData.workflowContext
      );

      res.status(202).json({
        success: true,
        data: { jobId, status },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * GET /api/v2/insight-assistant/jobs/:jobId
   * Get job status and result
   */
  getJob = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      if (!this.insightGenerationService) {
        res.status(503).json({
          success: false,
          error: { code: 'SERVICE_UNAVAILABLE', message: 'Insight generation service not available' },
        });
        return;
      }

      const { jobId } = req.params;
      const job = await this.insightGenerationService.getJob(jobId);

      if (!job) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Job not found' },
        });
        return;
      }

      // Verify ownership
      if (job.userId !== userId) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied' },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          jobId: job.id,
          status: job.status,
          progress: job.progress,
          currentStage: job.currentStage,
          result: job.result,
          error: job.error,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * GET /api/v2/insight-assistant/jobs/:jobId/stream
   * SSE stream for job progress
   */
  streamJobProgress = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      if (!this.insightGenerationService) {
        res.status(503).json({
          success: false,
          error: { code: 'SERVICE_UNAVAILABLE', message: 'Insight generation service not available' },
        });
        return;
      }

      const { jobId } = req.params;
      const job = await this.insightGenerationService.getJob(jobId);

      if (!job) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Job not found' },
        });
        return;
      }

      if (job.userId !== userId) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied' },
        });
        return;
      }

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      // Send initial progress
      const initialProgress = await this.insightGenerationService.getJobProgress(jobId);
      if (initialProgress) {
        res.write(`data: ${JSON.stringify(initialProgress)}\n\n`);
      }

      // Subscribe to progress updates
      const unsubscribe = this.insightGenerationService.subscribeToProgress(
        jobId,
        (progress) => {
          res.write(`data: ${JSON.stringify(progress)}\n\n`);

          // Close stream when job completes
          if (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'cancelled') {
            res.write('event: complete\ndata: {}\n\n');
            res.end();
          }
        }
      );

      // Clean up on client disconnect
      req.on('close', () => {
        unsubscribe();
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * POST /api/v2/insight-assistant/quick-insights
   * Generate quick insights synchronously
   */
  quickInsights = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      if (!this.insightGenerationService) {
        res.status(503).json({
          success: false,
          error: { code: 'SERVICE_UNAVAILABLE', message: 'Insight generation service not available' },
        });
        return;
      }

      const validatedData = generateInsightsRequestSchema.parse(req.body);

      const result = await this.insightGenerationService.generateQuickInsights(
        userId,
        validatedData.query,
        validatedData.options
      );

      if (!result) {
        res.status(500).json({
          success: false,
          error: { code: 'GENERATION_FAILED', message: 'Failed to generate insights' },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * DELETE /api/v2/insight-assistant/jobs/:jobId
   * Cancel a running job
   */
  cancelJob = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      if (!this.insightGenerationService) {
        res.status(503).json({
          success: false,
          error: { code: 'SERVICE_UNAVAILABLE', message: 'Insight generation service not available' },
        });
        return;
      }

      const { jobId } = req.params;
      const job = await this.insightGenerationService.getJob(jobId);

      if (!job) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Job not found' },
        });
        return;
      }

      if (job.userId !== userId) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Access denied' },
        });
        return;
      }

      const cancelled = await this.insightGenerationService.cancelJob(jobId);

      res.status(200).json({
        success: true,
        data: { cancelled },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  // ============================================================================
  // PERSONA-BASED SUGGESTIONS
  // ============================================================================

  /**
   * GET /api/v2/insight-assistant/suggestions
   * Get persona-based query suggestions
   */
  getSuggestions = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      if (!this.personaSuggestionService || !this.personaService) {
        res.status(503).json({
          success: false,
          error: { code: 'SERVICE_UNAVAILABLE', message: 'Persona services not available' },
        });
        return;
      }

      const query = getPersonaSuggestionsRequestSchema.parse(req.query);

      // Generate suggestions (now includes CTA)
      const { suggestions, cta } = await this.personaSuggestionService.generateSuggestions(
        userId,
        {
          limit: query.limit,
          personaTypes: query.personaTypes,
        }
      );

      // Get active personas for context
      const activePersonas = await this.personaService.getActivePersonas(userId);
      const personaSummary = activePersonas.map((p) => ({
        type: p.type,
        displayName: p.displayName,
        nodeId: p.nodeId,
        isActive: p.isActive,
      }));

      res.status(200).json({
        success: true,
        data: {
          suggestions,
          activePersonas: personaSummary,
          cta,
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  /**
   * POST /api/v2/insight-assistant/cache/clear
   * Clear all insight generation caches
   */
  clearCache = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const cacheManager = getInsightCacheManager();
      const statsBefore = cacheManager.getStats();
      cacheManager.clearAll();
      const statsAfter = cacheManager.getStats();

      this.logger.info('Insight cache cleared', { userId, statsBefore, statsAfter });

      res.status(200).json({
        success: true,
        data: {
          message: 'Cache cleared successfully',
          cleared: {
            queryEmbeddings: statsBefore.queryEmbeddings.size,
            peerWorkflows: statsBefore.peerWorkflows.size,
            similarQueries: statsBefore.similarQueries.size,
          },
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * GET /api/v2/insight-assistant/cache/stats
   * Get cache statistics
   */
  getCacheStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const cacheManager = getInsightCacheManager();
      const stats = cacheManager.getStats();

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * Handle errors and send appropriate response
   */
  private handleError(error: unknown, res: Response): void {
    if (error instanceof ZodError) {
      const friendlyError = fromZodError(error);
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: friendlyError.message,
          details: error.errors,
        },
      });
      return;
    }

    this.logger.error('Insight Assistant Controller error', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}
