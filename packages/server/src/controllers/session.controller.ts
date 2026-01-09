/**
 * SessionController
 * HTTP request handlers for desktop session APIs
 * (LIG-247: Desktop Session to Work Track Mapping)
 */

import {
  generateProgressSnapshotRequestSchema,
  listSessionsQuerySchema,
  nodeSessionsQuerySchema,
  pushSessionRequestSchema,
  reclassifySessionRequestSchema,
  remapSessionRequestSchema,
  submitFeedbackRequestSchema,
} from '@journey/schema';
import { type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';

import type { Logger } from '../core/logger.js';
import type { ProgressSnapshotService } from '../services/progress-snapshot.service.js';
import type { SessionService } from '../services/session.service.js';

// ============================================================================
// CONTROLLER
// ============================================================================

export class SessionController {
  private readonly sessionService: SessionService;
  private readonly progressSnapshotService: ProgressSnapshotService;
  private readonly logger: Logger;

  constructor({
    sessionService,
    progressSnapshotService,
    logger,
  }: {
    sessionService: SessionService;
    progressSnapshotService: ProgressSnapshotService;
    logger: Logger;
  }) {
    this.sessionService = sessionService;
    this.progressSnapshotService = progressSnapshotService;
    this.logger = logger;
  }

  /**
   * POST /api/v2/sessions/push
   * Push a session from desktop app
   */
  pushSession = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const validatedData = pushSessionRequestSchema.parse(req.body);

      const result = await this.sessionService.pushSession(validatedData, userId);

      res.status(201).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * GET /api/v2/sessions
   * List sessions with filtering and pagination
   */
  listSessions = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const query = listSessionsQuerySchema.parse(req.query);

      const result = await this.sessionService.listSessions(query, userId);

      res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * POST /api/v2/sessions/:id/reclassify
   * Reclassify a session into a different category
   */
  reclassifySession = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const sessionMappingId = req.params.id;
      const validatedData = reclassifySessionRequestSchema.parse(req.body);

      const result = await this.sessionService.reclassifySession(
        sessionMappingId,
        validatedData,
        userId
      );

      res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * POST /api/v2/sessions/:id/remap
   * Remap a session to a different node
   */
  remapSession = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const sessionMappingId = req.params.id;
      const validatedData = remapSessionRequestSchema.parse(req.body);

      const result = await this.sessionService.remapSession(
        sessionMappingId,
        validatedData,
        userId
      );

      res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * GET /api/v2/sessions/categories
   * Get all category definitions for UI
   */
  getCategories = async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = this.sessionService.getCategories();
      res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * GET /api/v2/timeline/nodes/:nodeId/sessions
   * Get sessions mapped to a specific node
   */
  getNodeSessions = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const nodeId = req.params.nodeId;
      const query = nodeSessionsQuerySchema.parse(req.query);

      const result = await this.sessionService.getNodeSessions(
        nodeId,
        query,
        userId
      );

      res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * POST /api/v2/sessions/feedback
   * Submit explicit RLHF feedback
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

      const validatedData = submitFeedbackRequestSchema.parse(req.body);

      const result = await this.sessionService.submitFeedback(
        validatedData,
        userId
      );

      res.status(201).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * POST /api/v2/sessions/progress-snapshot
   * Generate an LLM-powered progress snapshot for a node
   */
  generateProgressSnapshot = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const validatedData = generateProgressSnapshotRequestSchema.parse(req.body);

      const snapshot = await this.progressSnapshotService.generateSnapshot({
        nodeId: validatedData.nodeId,
        rangeLabel: validatedData.rangeLabel,
        journeyName: validatedData.journeyName,
        days: validatedData.days,
      });

      res.status(200).json({
        success: true,
        data: snapshot,
      });
    } catch (error) {
      // For snapshot generation failures, return useFallback flag
      // so UI can gracefully degrade to client-side clustering
      if (error instanceof Error && 
          (error.message.includes('timeout') || 
           error.message.includes('LLM') ||
           error.message.includes('generation'))) {
        this.logger.warn('Progress snapshot generation failed, suggesting fallback', {
          error: error.message,
        });
        res.status(200).json({
          success: false,
          data: null,
          message: error.message,
          useFallback: true,
        });
        return;
      }
      this.handleError(error, res);
    }
  };

  /**
   * Centralized error handling
   */
  private handleError(error: unknown, res: Response): void {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validationError.toString(),
          details: error.issues,
        },
      });
      return;
    }

    if (error instanceof Error) {
      this.logger.warn(`Session controller error: ${error.message}`);

      // Handle specific error types
      if (
        error.message.includes('not found') ||
        error.message.includes('access denied')
      ) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
        });
        return;
      }

      // Return actual error message for debugging (safe since it's server-side error)
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message,
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}


