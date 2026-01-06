/**
 * SessionMappingRepository
 * Database access layer for session mappings and classification feedback
 * (LIG-247: Desktop Session to Work Track Mapping)
 */

import * as schema from '@journey/schema';
import {
  SessionFeedbackType,
  SessionMappingAction,
  sessionClassificationFeedback,
  sessionMappings,
  timelineNodes,
  WorkTrackCategory,
} from '@journey/schema';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { Logger } from '../core/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateSessionMappingData {
  userId: number;
  desktopSessionId: string;
  category: WorkTrackCategory;
  categoryConfidence?: number;
  nodeId?: string;
  nodeMatchConfidence?: number;
  mappingAction?: SessionMappingAction;
  workflowName?: string;
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  summaryEmbedding?: number[];
  highLevelSummary?: string;
  userNotes?: string | null;
}

export interface UpdateSessionMappingData {
  category?: WorkTrackCategory;
  categoryConfidence?: number;
  nodeId?: string;
  nodeMatchConfidence?: number;
  mappingAction?: SessionMappingAction;
}

export interface CreateFeedbackData {
  userId: number;
  sessionMappingId: string;
  originalCategory: WorkTrackCategory;
  originalNodeId?: string;
  correctedCategory?: WorkTrackCategory;
  correctedNodeId?: string;
  feedbackType: SessionFeedbackType;
  userRole?: string;
  userReason?: string;
}

export interface SessionMappingFilter {
  userId: number;
  category?: WorkTrackCategory;
  nodeId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export type SessionMapping = typeof sessionMappings.$inferSelect;
export type SessionFeedback = typeof sessionClassificationFeedback.$inferSelect;

// ============================================================================
// REPOSITORY
// ============================================================================

export class SessionMappingRepository {
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
  // SESSION MAPPING CRUD
  // --------------------------------------------------------------------------

  /**
   * Create a new session mapping
   */
  async create(data: CreateSessionMappingData): Promise<SessionMapping> {
    try {
      const [created] = await this.database
        .insert(sessionMappings)
        .values({
          userId: data.userId,
          desktopSessionId: data.desktopSessionId,
          category: data.category,
          categoryConfidence: data.categoryConfidence,
          nodeId: data.nodeId,
          nodeMatchConfidence: data.nodeMatchConfidence,
          mappingAction: data.mappingAction,
          workflowName: data.workflowName,
          startedAt: data.startedAt,
          endedAt: data.endedAt,
          durationSeconds: data.durationSeconds,
          summaryEmbedding: data.summaryEmbedding,
          highLevelSummary: data.highLevelSummary,
          userNotes: data.userNotes,
        })
        .returning();

      this.logger.info('Created session mapping', {
        sessionMappingId: created.id,
        desktopSessionId: data.desktopSessionId,
        category: data.category,
        nodeId: data.nodeId,
      });

      return created;
    } catch (error) {
      this.logger.error('Failed to create session mapping', {
        error: error instanceof Error ? error.message : String(error),
        desktopSessionId: data.desktopSessionId,
      });
      throw error;
    }
  }

  /**
   * Get session mapping by ID
   */
  async getById(id: string): Promise<SessionMapping | null> {
    try {
      const [result] = await this.database
        .select()
        .from(sessionMappings)
        .where(eq(sessionMappings.id, id));

      return result || null;
    } catch (error) {
      this.logger.error('Failed to get session mapping by ID', {
        error: error instanceof Error ? error.message : String(error),
        sessionMappingId: id,
      });
      throw error;
    }
  }

  /**
   * Get session mapping by desktop session ID
   */
  async getByDesktopSessionId(
    userId: number,
    desktopSessionId: string
  ): Promise<SessionMapping | null> {
    try {
      const [result] = await this.database
        .select()
        .from(sessionMappings)
        .where(
          and(
            eq(sessionMappings.userId, userId),
            eq(sessionMappings.desktopSessionId, desktopSessionId)
          )
        );

      return result || null;
    } catch (error) {
      this.logger.error('Failed to get session mapping by desktop session ID', {
        error: error instanceof Error ? error.message : String(error),
        desktopSessionId,
      });
      throw error;
    }
  }

  /**
   * List session mappings with filters and pagination
   */
  async list(
    filter: SessionMappingFilter,
    options: PaginationOptions
  ): Promise<{ sessions: SessionMapping[]; total: number }> {
    try {
      const { page, limit } = options;
      const offset = (page - 1) * limit;

      // Build where conditions
      const conditions = [eq(sessionMappings.userId, filter.userId)];

      if (filter.category) {
        conditions.push(eq(sessionMappings.category, filter.category));
      }
      if (filter.nodeId) {
        conditions.push(eq(sessionMappings.nodeId, filter.nodeId));
      }
      if (filter.startDate) {
        conditions.push(gte(sessionMappings.startedAt, filter.startDate));
      }
      if (filter.endDate) {
        conditions.push(lte(sessionMappings.endedAt, filter.endDate));
      }

      const whereClause = and(...conditions);

      // Get total count
      const [{ count }] = await this.database
        .select({ count: sql<number>`count(*)` })
        .from(sessionMappings)
        .where(whereClause);

      // Get sessions
      const sessions = await this.database
        .select()
        .from(sessionMappings)
        .where(whereClause)
        .orderBy(desc(sessionMappings.createdAt))
        .limit(limit)
        .offset(offset);

      this.logger.debug('Listed session mappings', {
        userId: filter.userId,
        count: sessions.length,
        total: count,
        page,
        limit,
      });

      return {
        sessions,
        total: count,
      };
    } catch (error) {
      this.logger.error('Failed to list session mappings', {
        error: error instanceof Error ? error.message : String(error),
        filter,
      });
      throw error;
    }
  }

  /**
   * List session mappings with node info joined
   */
  async listWithNodeInfo(
    filter: SessionMappingFilter,
    options: PaginationOptions
  ): Promise<{
    sessions: Array<SessionMapping & { nodeTitle?: string; nodeType?: string }>;
    total: number;
  }> {
    try {
      const { page, limit } = options;
      const offset = (page - 1) * limit;

      // Build where conditions
      const conditions = [eq(sessionMappings.userId, filter.userId)];

      if (filter.category) {
        conditions.push(eq(sessionMappings.category, filter.category));
      }
      if (filter.nodeId) {
        conditions.push(eq(sessionMappings.nodeId, filter.nodeId));
      }
      if (filter.startDate) {
        conditions.push(gte(sessionMappings.startedAt, filter.startDate));
      }
      if (filter.endDate) {
        conditions.push(lte(sessionMappings.endedAt, filter.endDate));
      }

      const whereClause = and(...conditions);

      // Get total count
      const [{ count }] = await this.database
        .select({ count: sql<number>`count(*)` })
        .from(sessionMappings)
        .where(whereClause);

      // Get sessions with node info
      const sessions = await this.database
        .select({
          id: sessionMappings.id,
          userId: sessionMappings.userId,
          desktopSessionId: sessionMappings.desktopSessionId,
          category: sessionMappings.category,
          categoryConfidence: sessionMappings.categoryConfidence,
          nodeId: sessionMappings.nodeId,
          nodeMatchConfidence: sessionMappings.nodeMatchConfidence,
          mappingAction: sessionMappings.mappingAction,
          workflowName: sessionMappings.workflowName,
          startedAt: sessionMappings.startedAt,
          endedAt: sessionMappings.endedAt,
          durationSeconds: sessionMappings.durationSeconds,
          summaryEmbedding: sessionMappings.summaryEmbedding,
          highLevelSummary: sessionMappings.highLevelSummary,
          createdAt: sessionMappings.createdAt,
          updatedAt: sessionMappings.updatedAt,
          nodeTitle: sql<string>`(${timelineNodes.meta}->>'title')`.as(
            'nodeTitle'
          ),
          nodeType: timelineNodes.type,
        })
        .from(sessionMappings)
        .leftJoin(timelineNodes, eq(sessionMappings.nodeId, timelineNodes.id))
        .where(whereClause)
        .orderBy(desc(sessionMappings.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        sessions: sessions as Array<
          SessionMapping & { nodeTitle?: string; nodeType?: string }
        >,
        total: count,
      };
    } catch (error) {
      this.logger.error('Failed to list session mappings with node info', {
        error: error instanceof Error ? error.message : String(error),
        filter,
      });
      throw error;
    }
  }

  /**
   * Get sessions by node ID with aggregated stats
   */
  async getByNodeId(
    nodeId: string,
    options: PaginationOptions
  ): Promise<{
    sessions: SessionMapping[];
    total: number;
    totalDurationSeconds: number;
  }> {
    try {
      const { page, limit } = options;
      const offset = (page - 1) * limit;

      // Get total count and duration
      const [stats] = await this.database
        .select({
          count: sql<number>`count(*)`,
          totalDuration: sql<number>`coalesce(sum(${sessionMappings.durationSeconds}), 0)`,
        })
        .from(sessionMappings)
        .where(eq(sessionMappings.nodeId, nodeId));

      // Get sessions
      const sessions = await this.database
        .select()
        .from(sessionMappings)
        .where(eq(sessionMappings.nodeId, nodeId))
        .orderBy(desc(sessionMappings.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        sessions,
        total: stats.count,
        totalDurationSeconds: stats.totalDuration,
      };
    } catch (error) {
      this.logger.error('Failed to get sessions by node ID', {
        error: error instanceof Error ? error.message : String(error),
        nodeId,
      });
      throw error;
    }
  }

  /**
   * Get sessions by node ID with node metadata (includes chapters)
   */
  async getByNodeIdWithMeta(
    nodeId: string,
    options: PaginationOptions
  ): Promise<{
    sessions: SessionMapping[];
    total: number;
    totalDurationSeconds: number;
    nodeMeta: Record<string, any> | null;
  }> {
    try {
      const { page, limit } = options;
      const offset = (page - 1) * limit;

      // Get total count and duration
      const [stats] = await this.database
        .select({
          count: sql<number>`count(*)`,
          totalDuration: sql<number>`coalesce(sum(${sessionMappings.durationSeconds}), 0)`,
        })
        .from(sessionMappings)
        .where(eq(sessionMappings.nodeId, nodeId));

      // Get sessions
      const sessions = await this.database
        .select()
        .from(sessionMappings)
        .where(eq(sessionMappings.nodeId, nodeId))
        .orderBy(desc(sessionMappings.createdAt))
        .limit(limit)
        .offset(offset);

      // Get node metadata (contains chapters)
      const [node] = await this.database
        .select({ meta: timelineNodes.meta })
        .from(timelineNodes)
        .where(eq(timelineNodes.id, nodeId))
        .limit(1);

      return {
        sessions,
        total: stats.count,
        totalDurationSeconds: stats.totalDuration,
        nodeMeta: node?.meta || null,
      };
    } catch (error) {
      this.logger.error('Failed to get sessions by node ID with meta', {
        error: error instanceof Error ? error.message : String(error),
        nodeId,
      });
      throw error;
    }
  }

  /**
   * Update a session mapping
   */
  async update(
    id: string,
    data: UpdateSessionMappingData
  ): Promise<SessionMapping | null> {
    try {
      const [updated] = await this.database
        .update(sessionMappings)
        .set({
          ...data,
          updatedAt: sql`now()`,
        })
        .where(eq(sessionMappings.id, id))
        .returning();

      if (updated) {
        this.logger.info('Updated session mapping', {
          sessionMappingId: id,
          changes: Object.keys(data),
        });
      }

      return updated || null;
    } catch (error) {
      this.logger.error('Failed to update session mapping', {
        error: error instanceof Error ? error.message : String(error),
        sessionMappingId: id,
      });
      throw error;
    }
  }

  /**
   * Check if session mapping belongs to user
   */
  async belongsToUser(sessionMappingId: string, userId: number): Promise<boolean> {
    try {
      const [result] = await this.database
        .select({ userId: sessionMappings.userId })
        .from(sessionMappings)
        .where(eq(sessionMappings.id, sessionMappingId));

      return result?.userId === userId;
    } catch (error) {
      this.logger.error('Failed to check session mapping ownership', {
        error: error instanceof Error ? error.message : String(error),
        sessionMappingId,
        userId,
      });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // FEEDBACK CRUD
  // --------------------------------------------------------------------------

  /**
   * Create feedback record
   */
  async createFeedback(data: CreateFeedbackData): Promise<SessionFeedback> {
    try {
      const [created] = await this.database
        .insert(sessionClassificationFeedback)
        .values({
          userId: data.userId,
          sessionMappingId: data.sessionMappingId,
          originalCategory: data.originalCategory,
          originalNodeId: data.originalNodeId,
          correctedCategory: data.correctedCategory,
          correctedNodeId: data.correctedNodeId,
          feedbackType: data.feedbackType,
          userRole: data.userRole,
          userReason: data.userReason,
        })
        .returning();

      this.logger.info('Created classification feedback', {
        feedbackId: created.id,
        sessionMappingId: data.sessionMappingId,
        feedbackType: data.feedbackType,
      });

      return created;
    } catch (error) {
      this.logger.error('Failed to create classification feedback', {
        error: error instanceof Error ? error.message : String(error),
        sessionMappingId: data.sessionMappingId,
      });
      throw error;
    }
  }

  /**
   * Get feedback by user for RLHF learning
   */
  async getFeedbackByUser(
    userId: number,
    options: PaginationOptions
  ): Promise<{ feedback: SessionFeedback[]; total: number }> {
    try {
      const { page, limit } = options;
      const offset = (page - 1) * limit;

      const [{ count }] = await this.database
        .select({ count: sql<number>`count(*)` })
        .from(sessionClassificationFeedback)
        .where(eq(sessionClassificationFeedback.userId, userId));

      const feedback = await this.database
        .select()
        .from(sessionClassificationFeedback)
        .where(eq(sessionClassificationFeedback.userId, userId))
        .orderBy(desc(sessionClassificationFeedback.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        feedback,
        total: count,
      };
    } catch (error) {
      this.logger.error('Failed to get feedback by user', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw error;
    }
  }

  /**
   * Get feedback patterns for a category (for RLHF aggregation)
   */
  async getFeedbackPatternsByCategory(
    category: WorkTrackCategory,
    limit: number = 100
  ): Promise<SessionFeedback[]> {
    try {
      const feedback = await this.database
        .select()
        .from(sessionClassificationFeedback)
        .where(eq(sessionClassificationFeedback.originalCategory, category))
        .orderBy(desc(sessionClassificationFeedback.createdAt))
        .limit(limit);

      return feedback;
    } catch (error) {
      this.logger.error('Failed to get feedback patterns by category', {
        error: error instanceof Error ? error.message : String(error),
        category,
      });
      throw error;
    }
  }

  /**
   * Get feedback patterns for a user role (for RLHF aggregation)
   */
  async getFeedbackPatternsByRole(
    role: string,
    limit: number = 100
  ): Promise<SessionFeedback[]> {
    try {
      const feedback = await this.database
        .select()
        .from(sessionClassificationFeedback)
        .where(eq(sessionClassificationFeedback.userRole, role))
        .orderBy(desc(sessionClassificationFeedback.createdAt))
        .limit(limit);

      return feedback;
    } catch (error) {
      this.logger.error('Failed to get feedback patterns by role', {
        error: error instanceof Error ? error.message : String(error),
        role,
      });
      throw error;
    }
  }
}


