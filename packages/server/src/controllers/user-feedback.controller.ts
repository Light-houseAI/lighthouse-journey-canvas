/**
 * UserFeedbackController
 * HTTP request handlers for user feedback APIs (thumbs up/down)
 */

import {
  listFeedbackQuerySchema,
  submitUserFeedbackRequestSchema,
} from '@journey/schema';
import { type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';

import type { Logger } from '../core/logger.js';
import type { UserFeedbackService } from '../services/user-feedback.service.js';

// ============================================================================
// CONTROLLER
// ============================================================================

export class UserFeedbackController {
  private readonly userFeedbackService: UserFeedbackService;
  private readonly logger: Logger;

  constructor({
    userFeedbackService,
    logger,
  }: {
    userFeedbackService: UserFeedbackService;
    logger: Logger;
  }) {
    this.userFeedbackService = userFeedbackService;
    this.logger = logger;
  }

  /**
   * POST /api/v2/feedback
   * Submit feedback for a feature
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

      const validatedData = submitUserFeedbackRequestSchema.parse(req.body);

      const result = await this.userFeedbackService.submitFeedback(
        validatedData,
        userId
      );

      res.status(201).json({
        success: true,
        data: {
          feedback: this.serializeFeedback(result.feedback),
          message: result.message,
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * GET /api/v2/feedback
   * List feedback for the authenticated user
   */
  listFeedback = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const query = listFeedbackQuerySchema.parse(req.query);

      const result = await this.userFeedbackService.listFeedback(userId, {
        featureType: query.featureType,
        rating: query.rating,
        nodeId: query.nodeId,
        limit: query.limit,
        offset: query.offset,
      });

      res.status(200).json({
        success: true,
        data: {
          feedback: result.feedback.map((f) => this.serializeFeedback(f)),
          total: result.total,
          hasMore: result.hasMore,
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * GET /api/v2/feedback/stats
   * Get feedback statistics
   */
  getStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const { featureType } = req.query;
      const stats = await this.userFeedbackService.getStats(
        userId,
        featureType as any
      );

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * DELETE /api/v2/feedback/:id
   * Delete a feedback entry
   */
  deleteFeedback = async (req: Request, res: Response): Promise<void> => {
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
      const deleted = await this.userFeedbackService.deleteFeedback(id, userId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Feedback not found' },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { message: 'Feedback deleted successfully' },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  // --------------------------------------------------------------------------
  // PRIVATE HELPERS
  // --------------------------------------------------------------------------

  private serializeFeedback(feedback: any) {
    return {
      id: feedback.id,
      userId: feedback.userId,
      featureType: feedback.featureType,
      rating: feedback.rating,
      comment: feedback.comment,
      contextData: feedback.contextData,
      nodeId: feedback.nodeId,
      sessionMappingId: feedback.sessionMappingId,
      createdAt: feedback.createdAt?.toISOString() || feedback.createdAt,
    };
  }

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

    this.logger.error('Controller error', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  }
}
