/**
 * UserFeedbackService
 * Business logic for user feedback (thumbs up/down)
 */

import {
  FeedbackFeatureType,
  FeedbackRating,
  type SubmitUserFeedbackRequest,
} from '@journey/schema';

import type { Logger } from '../core/logger.js';
import type {
  UserFeedbackRepository,
  UserFeedbackRecord,
} from '../repositories/user-feedback.repository.js';

// ============================================================================
// TYPES
// ============================================================================

export interface SubmitFeedbackResult {
  feedback: UserFeedbackRecord;
  message: string;
  isUpdate: boolean;
}

export interface ListFeedbackResult {
  feedback: UserFeedbackRecord[];
  total: number;
  hasMore: boolean;
}

export interface FeedbackStats {
  thumbsUp: number;
  thumbsDown: number;
  total: number;
  positiveRate: number;
}

// ============================================================================
// SERVICE
// ============================================================================

export class UserFeedbackService {
  constructor({
    userFeedbackRepository,
    logger,
  }: {
    userFeedbackRepository: UserFeedbackRepository;
    logger: Logger;
  }) {
    this.userFeedbackRepository = userFeedbackRepository;
    this.logger = logger;
  }

  private readonly userFeedbackRepository: UserFeedbackRepository;
  private readonly logger: Logger;

  // --------------------------------------------------------------------------
  // PUBLIC METHODS
  // --------------------------------------------------------------------------

  /**
   * Submit feedback for a feature
   * If the user has already submitted feedback for the same feature/context,
   * the existing feedback is replaced (one feedback per feature per user)
   */
  async submitFeedback(
    request: SubmitUserFeedbackRequest,
    userId: number
  ): Promise<SubmitFeedbackResult> {
    this.logger.info('Submitting user feedback', {
      userId,
      featureType: request.featureType,
      rating: request.rating,
    });

    // Check for existing feedback
    const existing = await this.userFeedbackRepository.findExisting(
      userId,
      request.featureType,
      request.nodeId,
      request.sessionMappingId
    );

    if (existing) {
      // Delete existing feedback before creating new one
      await this.userFeedbackRepository.delete(existing.id, userId);
      this.logger.info('Replaced existing feedback', {
        oldFeedbackId: existing.id,
        oldRating: existing.rating,
        newRating: request.rating,
      });
    }

    // Create new feedback
    const feedback = await this.userFeedbackRepository.create({
      userId,
      featureType: request.featureType,
      rating: request.rating,
      comment: request.comment,
      contextData: request.contextData,
      nodeId: request.nodeId,
      sessionMappingId: request.sessionMappingId,
    });

    const ratingLabel = request.rating === FeedbackRating.ThumbsUp ? 'positive' : 'negative';
    const message = existing
      ? `Updated your feedback to ${ratingLabel}`
      : `Thank you for your ${ratingLabel} feedback!`;

    return {
      feedback,
      message,
      isUpdate: !!existing,
    };
  }

  /**
   * List feedback for a user with optional filters
   */
  async listFeedback(
    userId: number,
    options: {
      featureType?: FeedbackFeatureType;
      rating?: FeedbackRating;
      nodeId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<ListFeedbackResult> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const result = await this.userFeedbackRepository.list(
      {
        userId,
        featureType: options.featureType,
        rating: options.rating,
        nodeId: options.nodeId,
      },
      { limit, offset }
    );

    return {
      feedback: result.feedback,
      total: result.total,
      hasMore: offset + result.feedback.length < result.total,
    };
  }

  /**
   * Get feedback statistics for a user
   */
  async getStats(
    userId: number,
    featureType?: FeedbackFeatureType
  ): Promise<FeedbackStats> {
    const stats = await this.userFeedbackRepository.getStats(userId, featureType);

    return {
      thumbsUp: stats.thumbsUp,
      thumbsDown: stats.thumbsDown,
      total: stats.total,
      positiveRate: stats.total > 0 ? stats.thumbsUp / stats.total : 0,
    };
  }

  /**
   * Delete a feedback entry
   */
  async deleteFeedback(feedbackId: string, userId: number): Promise<boolean> {
    return this.userFeedbackRepository.delete(feedbackId, userId);
  }

  /**
   * Get a single feedback entry
   */
  async getFeedback(feedbackId: string): Promise<UserFeedbackRecord | null> {
    return this.userFeedbackRepository.findById(feedbackId);
  }
}
