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
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
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
  generatedTitle?: string | null;
  userNotes?: string | null;
  /** Full AI-generated summary with chapters (V1) or workflows (V2) and semantic_steps */
  summary?: Record<string, unknown>;
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
          generatedTitle: data.generatedTitle,
          userNotes: data.userNotes,
          summary: data.summary,
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
   * Check if a timeline node exists (for FK validation before insert)
   */
  async nodeExists(nodeId: string): Promise<boolean> {
    try {
      const [result] = await this.database
        .select({ id: timelineNodes.id })
        .from(timelineNodes)
        .where(eq(timelineNodes.id, nodeId))
        .limit(1);

      return !!result;
    } catch {
      // Return false on error to be safe (will save session without node association)
      return false;
    }
  }

  /**
   * Find a node by title/name for a user (to avoid creating duplicates)
   * Searches in meta.title, meta.name, and meta.label
   */
  async findNodeByTitle(
    userId: number,
    title: string
  ): Promise<{ id: string } | null> {
    try {
      const normalizedTitle = title.trim().toLowerCase();

      // Search for nodes where meta->title, meta->name, or meta->label matches
      const results = await this.database
        .select({
          id: timelineNodes.id,
          meta: timelineNodes.meta,
        })
        .from(timelineNodes)
        .where(eq(timelineNodes.userId, userId))
        .limit(50);

      // Check each node for matching title
      for (const node of results) {
        const meta = node.meta as Record<string, unknown> | null;
        if (!meta) continue;

        const nodeTitle = (meta.title || meta.name || meta.label || '') as string;
        if (nodeTitle.trim().toLowerCase() === normalizedTitle) {
          return { id: node.id };
        }
      }

      return null;
    } catch (error) {
      this.logger.warn('Error searching for node by title', {
        userId,
        title,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
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
          summary: sessionMappings.summary,
          generatedTitle: sessionMappings.generatedTitle,
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

  // --------------------------------------------------------------------------
  // PERSONA ACTIVITY TRACKING
  // --------------------------------------------------------------------------

  /**
   * Get last activity timestamp for each node in a list
   * Used by PersonaService to determine persona activity status
   */
  async getLastActivityByNodes(
    userId: number,
    nodeIds: string[]
  ): Promise<Map<string, Date>> {
    try {
      if (nodeIds.length === 0) {
        return new Map();
      }

      const results = await this.database
        .select({
          nodeId: sessionMappings.nodeId,
          lastActivity: sql<Date>`max(${sessionMappings.endedAt})`.as('lastActivity'),
        })
        .from(sessionMappings)
        .where(
          and(
            eq(sessionMappings.userId, userId),
            inArray(sessionMappings.nodeId, nodeIds)
          )
        )
        .groupBy(sessionMappings.nodeId);

      const activityMap = new Map<string, Date>();
      for (const row of results) {
        if (row.nodeId && row.lastActivity) {
          activityMap.set(row.nodeId, new Date(row.lastActivity));
        }
      }

      this.logger.debug('Got last activity for nodes', {
        userId,
        nodeCount: nodeIds.length,
        activityCount: activityMap.size,
      });

      return activityMap;
    } catch (error) {
      this.logger.error('Failed to get last activity by nodes', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        nodeCount: nodeIds.length,
      });
      throw error;
    }
  }

  /**
   * Get recent sessions for a specific node
   * Used by PersonaSuggestionService to generate contextual suggestions
   */
  async getRecentByNode(
    userId: number,
    nodeId: string,
    limit: number = 5
  ): Promise<SessionMapping[]> {
    try {
      const sessions = await this.database
        .select()
        .from(sessionMappings)
        .where(
          and(
            eq(sessionMappings.userId, userId),
            eq(sessionMappings.nodeId, nodeId)
          )
        )
        .orderBy(desc(sessionMappings.endedAt))
        .limit(limit);

      this.logger.debug('Got recent sessions for node', {
        userId,
        nodeId,
        sessionCount: sessions.length,
      });

      return sessions;
    } catch (error) {
      this.logger.error('Failed to get recent sessions by node', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        nodeId,
      });
      throw error;
    }
  }

  /**
   * Get recent sessions for a user (across all nodes)
   * Used for insight generation and activity tracking
   */
  async getRecentSessions(
    userId: number,
    daysBack: number = 30,
    limit: number = 100
  ): Promise<SessionMapping[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      const sessions = await this.database
        .select()
        .from(sessionMappings)
        .where(
          and(
            eq(sessionMappings.userId, userId),
            gte(sessionMappings.startedAt, cutoffDate)
          )
        )
        .orderBy(desc(sessionMappings.endedAt))
        .limit(limit);

      this.logger.debug('Got recent sessions for user', {
        userId,
        daysBack,
        sessionCount: sessions.length,
      });

      return sessions;
    } catch (error) {
      this.logger.error('Failed to get recent sessions', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        daysBack,
      });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // PEER SESSION RETRIEVAL (Cross-User Similarity Search)
  // --------------------------------------------------------------------------

  /**
   * Search for similar sessions from OTHER users using vector similarity.
   * Returns anonymized peer sessions for A3 Comparator agent.
   *
   * @param excludeUserId - Current user to exclude from results
   * @param queryEmbedding - Embedding vector to search with (from user's workflow summary)
   * @param options - Search options
   * @returns Anonymized peer session data
   */
  async searchPeerSessionsByEmbedding(
    excludeUserId: number,
    queryEmbedding: number[] | Float32Array,
    options: {
      minSimilarity?: number;
      limit?: number;
      category?: WorkTrackCategory;
    } = {}
  ): Promise<Array<{
    sessionId: string;
    category: WorkTrackCategory;
    workflowName: string | null;
    durationSeconds: number | null;
    highLevelSummary: string | null;
    summary: Record<string, unknown> | null;
    similarity: number;
  }>> {
    const { minSimilarity = 0.3, limit = 10, category } = options;

    try {
      // Convert to proper array format for pgvector
      const embeddingArray = Array.isArray(queryEmbedding)
        ? queryEmbedding
        : Array.from(queryEmbedding);
      const vectorString = `[${embeddingArray.join(',')}]`;

      this.logger.info('Searching peer sessions by embedding', {
        excludeUserId,
        minSimilarity,
        limit,
        category,
        embeddingDimensions: embeddingArray.length,
      });

      // Build dynamic SQL query for vector similarity search
      // Search sessions from OTHER users (excludeUserId) that have embeddings
      let query = sql`
        SELECT
          desktop_session_id as "sessionId",
          category,
          workflow_name as "workflowName",
          duration_seconds as "durationSeconds",
          high_level_summary as "highLevelSummary",
          summary,
          1 - (summary_embedding <=> ${vectorString}::vector) as similarity
        FROM session_mappings
        WHERE user_id != ${excludeUserId}
          AND summary_embedding IS NOT NULL
          AND 1 - (summary_embedding <=> ${vectorString}::vector) >= ${minSimilarity}
      `;

      // Add category filter if provided
      if (category) {
        query = sql`${query} AND category = ${category}`;
      }

      // Order by similarity and limit results
      query = sql`${query}
        ORDER BY similarity DESC
        LIMIT ${limit}
      `;

      const results = await this.database.execute(query);

      this.logger.info('Found peer sessions', {
        count: results.rows.length,
        topSimilarity: results.rows[0]?.similarity ?? 0,
      });

      return results.rows as Array<{
        sessionId: string;
        category: WorkTrackCategory;
        workflowName: string | null;
        durationSeconds: number | null;
        highLevelSummary: string | null;
        summary: Record<string, unknown> | null;
        similarity: number;
      }>;
    } catch (error) {
      this.logger.error('Failed to search peer sessions by embedding', {
        error: error instanceof Error ? error.message : String(error),
        excludeUserId,
      });
      // Return empty array on error (graceful degradation)
      return [];
    }
  }

  /**
   * Get aggregated peer workflow patterns across all users (anonymized).
   * Groups by category and workflow type to find common patterns.
   */
  async getPeerWorkflowPatterns(
    excludeUserId: number,
    options: { minOccurrences?: number; limit?: number } = {}
  ): Promise<Array<{
    category: WorkTrackCategory;
    avgDurationSeconds: number;
    occurrenceCount: number;
    commonTools: string[];
  }>> {
    const { minOccurrences = 3, limit = 20 } = options;

    try {
      // Get aggregated patterns from other users
      const results = await this.database
        .select({
          category: sessionMappings.category,
          avgDuration: sql<number>`avg(${sessionMappings.durationSeconds})`.as('avgDuration'),
          count: sql<number>`count(*)`.as('count'),
        })
        .from(sessionMappings)
        .where(sql`${sessionMappings.userId} != ${excludeUserId}`)
        .groupBy(sessionMappings.category)
        .having(sql`count(*) >= ${minOccurrences}`)
        .orderBy(sql`count(*) desc`)
        .limit(limit);

      this.logger.debug('Got peer workflow patterns', {
        excludeUserId,
        patternCount: results.length,
      });

      return results.map(r => ({
        category: r.category,
        avgDurationSeconds: Math.round(r.avgDuration || 0),
        occurrenceCount: Number(r.count),
        commonTools: [], // Would need additional query to populate
      }));
    } catch (error) {
      this.logger.error('Failed to get peer workflow patterns', {
        error: error instanceof Error ? error.message : String(error),
        excludeUserId,
      });
      return [];
    }
  }
}


