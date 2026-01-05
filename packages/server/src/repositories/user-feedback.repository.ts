/**
 * UserFeedbackRepository
 * Database access layer for user feedback (thumbs up/down)
 */

import * as schema from '@journey/schema';
import {
  FeedbackFeatureType,
  FeedbackRating,
  userFeedback,
} from '@journey/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { Logger } from '../core/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateUserFeedbackData {
  userId: number;
  featureType: FeedbackFeatureType;
  rating: FeedbackRating;
  comment?: string;
  contextData?: Record<string, any>;
  nodeId?: string;
  sessionMappingId?: string;
}

export interface UserFeedbackFilter {
  userId: number;
  featureType?: FeedbackFeatureType;
  rating?: FeedbackRating;
  nodeId?: string;
}

export interface PaginationOptions {
  limit: number;
  offset: number;
}

export type UserFeedbackRecord = typeof userFeedback.$inferSelect;

// ============================================================================
// REPOSITORY
// ============================================================================

export class UserFeedbackRepository {
  constructor({
    database,
    logger,
  }: {
    database: NodePgDatabase<typeof schema>;
    logger: Logger;
  }) {
    this.database = database;
    this.logger = logger;
  }

  private readonly database: NodePgDatabase<typeof schema>;
  private readonly logger: Logger;

  // --------------------------------------------------------------------------
  // CRUD OPERATIONS
  // --------------------------------------------------------------------------

  /**
   * Create a new feedback entry
   */
  async create(data: CreateUserFeedbackData): Promise<UserFeedbackRecord> {
    try {
      const [created] = await this.database
        .insert(userFeedback)
        .values({
          userId: data.userId,
          featureType: data.featureType,
          rating: data.rating,
          comment: data.comment,
          contextData: data.contextData || {},
          nodeId: data.nodeId,
          sessionMappingId: data.sessionMappingId,
        })
        .returning();

      this.logger.info('Created user feedback', {
        feedbackId: created.id,
        userId: data.userId,
        featureType: data.featureType,
        rating: data.rating,
      });

      return created;
    } catch (error) {
      this.logger.error('Failed to create user feedback', { error, data });
      throw error;
    }
  }

  /**
   * Get feedback by ID
   */
  async findById(id: string): Promise<UserFeedbackRecord | null> {
    try {
      const [feedback] = await this.database
        .select()
        .from(userFeedback)
        .where(eq(userFeedback.id, id))
        .limit(1);

      return feedback || null;
    } catch (error) {
      this.logger.error('Failed to find feedback by ID', { error, id });
      throw error;
    }
  }

  /**
   * List feedback with filters and pagination
   */
  async list(
    filter: UserFeedbackFilter,
    pagination: PaginationOptions
  ): Promise<{ feedback: UserFeedbackRecord[]; total: number }> {
    try {
      const conditions = [eq(userFeedback.userId, filter.userId)];

      if (filter.featureType) {
        conditions.push(eq(userFeedback.featureType, filter.featureType));
      }

      if (filter.rating) {
        conditions.push(eq(userFeedback.rating, filter.rating));
      }

      if (filter.nodeId) {
        conditions.push(eq(userFeedback.nodeId, filter.nodeId));
      }

      const whereClause = and(...conditions);

      // Get feedback items
      const feedback = await this.database
        .select()
        .from(userFeedback)
        .where(whereClause)
        .orderBy(desc(userFeedback.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset);

      // Get total count
      const [countResult] = await this.database
        .select({ count: sql<number>`count(*)::int` })
        .from(userFeedback)
        .where(whereClause);

      return {
        feedback,
        total: countResult?.count || 0,
      };
    } catch (error) {
      this.logger.error('Failed to list feedback', { error, filter });
      throw error;
    }
  }

  /**
   * Check if user has already provided feedback for a specific feature/context
   */
  async findExisting(
    userId: number,
    featureType: FeedbackFeatureType,
    nodeId?: string,
    sessionMappingId?: string
  ): Promise<UserFeedbackRecord | null> {
    try {
      const conditions = [
        eq(userFeedback.userId, userId),
        eq(userFeedback.featureType, featureType),
      ];

      if (nodeId) {
        conditions.push(eq(userFeedback.nodeId, nodeId));
      }

      if (sessionMappingId) {
        conditions.push(eq(userFeedback.sessionMappingId, sessionMappingId));
      }

      const [existing] = await this.database
        .select()
        .from(userFeedback)
        .where(and(...conditions))
        .orderBy(desc(userFeedback.createdAt))
        .limit(1);

      return existing || null;
    } catch (error) {
      this.logger.error('Failed to find existing feedback', { error, userId, featureType });
      throw error;
    }
  }

  /**
   * Delete feedback by ID
   */
  async delete(id: string, userId: number): Promise<boolean> {
    try {
      const result = await this.database
        .delete(userFeedback)
        .where(and(eq(userFeedback.id, id), eq(userFeedback.userId, userId)));

      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      this.logger.error('Failed to delete feedback', { error, id, userId });
      throw error;
    }
  }

  /**
   * Get feedback statistics for a feature type
   */
  async getStats(
    userId: number,
    featureType?: FeedbackFeatureType
  ): Promise<{
    thumbsUp: number;
    thumbsDown: number;
    total: number;
  }> {
    try {
      const conditions = [eq(userFeedback.userId, userId)];

      if (featureType) {
        conditions.push(eq(userFeedback.featureType, featureType));
      }

      const [stats] = await this.database
        .select({
          thumbsUp: sql<number>`count(*) filter (where ${userFeedback.rating} = 'thumbs_up')::int`,
          thumbsDown: sql<number>`count(*) filter (where ${userFeedback.rating} = 'thumbs_down')::int`,
          total: sql<number>`count(*)::int`,
        })
        .from(userFeedback)
        .where(and(...conditions));

      return {
        thumbsUp: stats?.thumbsUp || 0,
        thumbsDown: stats?.thumbsDown || 0,
        total: stats?.total || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get feedback stats', { error, userId, featureType });
      throw error;
    }
  }
}
