/**
 * GroupRepository
 * Database access layer for groups and group items.
 * Groups are user-created collections of sessions, workflows, or steps.
 */

import * as schema from '@journey/schema';
import { groups, groupItems, sessionMappings } from '@journey/schema';
import { and, eq, sql, desc, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { Logger } from '../core/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateGroupData {
  userId: number;
  name: string;
  description?: string;
  nodeId?: string;
}

export interface UpdateGroupData {
  name?: string;
  description?: string;
}

export interface CreateGroupItemData {
  itemType: 'session' | 'workflow' | 'step';
  sessionMappingId: string;
  workflowId?: string;
  stepId?: string;
  metadata?: Record<string, unknown>;
}

export type Group = typeof groups.$inferSelect;
export type GroupItem = typeof groupItems.$inferSelect;

export interface GroupWithItemCount extends Group {
  itemCount: number;
}

export interface ResolvedSessionData {
  id: string;
  generatedTitle: string | null;
  highLevelSummary: string | null;
  summary: unknown;
  screenshotDescriptions: unknown;
  summaryEmbedding: number[] | null;
  highLevelSummaryEmbedding: number[] | null;
  screenshotDescriptionsEmbedding: number[] | null;
  gapAnalysisEmbedding: number[] | null;
  durationSeconds: number | null;
  workflowName: string | null;
}

// ============================================================================
// REPOSITORY
// ============================================================================

export class GroupRepository {
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
  // GROUP CRUD
  // --------------------------------------------------------------------------

  async createGroup(data: CreateGroupData): Promise<Group> {
    try {
      const [created] = await this.database
        .insert(groups)
        .values({
          userId: data.userId,
          name: data.name,
          description: data.description,
          nodeId: data.nodeId,
        })
        .returning();

      this.logger.info('Created group', {
        groupId: created.id,
        name: data.name,
        userId: data.userId,
      });

      return created;
    } catch (error) {
      this.logger.error('Failed to create group', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getGroupsByUser(userId: number): Promise<GroupWithItemCount[]> {
    try {
      const result = await this.database
        .select({
          id: groups.id,
          userId: groups.userId,
          nodeId: groups.nodeId,
          name: groups.name,
          description: groups.description,
          createdAt: groups.createdAt,
          updatedAt: groups.updatedAt,
          itemCount: sql<number>`cast(count(${groupItems.id}) as integer)`,
        })
        .from(groups)
        .leftJoin(groupItems, eq(groups.id, groupItems.groupId))
        .where(eq(groups.userId, userId))
        .groupBy(groups.id)
        .orderBy(desc(groups.updatedAt));

      return result;
    } catch (error) {
      this.logger.error('Failed to get groups for user', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw error;
    }
  }

  async getGroupsByNode(
    userId: number,
    nodeId: string
  ): Promise<GroupWithItemCount[]> {
    try {
      const result = await this.database
        .select({
          id: groups.id,
          userId: groups.userId,
          nodeId: groups.nodeId,
          name: groups.name,
          description: groups.description,
          createdAt: groups.createdAt,
          updatedAt: groups.updatedAt,
          itemCount: sql<number>`cast(count(${groupItems.id}) as integer)`,
        })
        .from(groups)
        .leftJoin(groupItems, eq(groups.id, groupItems.groupId))
        .where(and(eq(groups.userId, userId), eq(groups.nodeId, nodeId)))
        .groupBy(groups.id)
        .orderBy(desc(groups.updatedAt));

      return result;
    } catch (error) {
      this.logger.error('Failed to get groups for node', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        nodeId,
      });
      throw error;
    }
  }

  async getGroupById(
    groupId: string,
    userId: number
  ): Promise<Group | null> {
    try {
      const [result] = await this.database
        .select()
        .from(groups)
        .where(and(eq(groups.id, groupId), eq(groups.userId, userId)));

      return result || null;
    } catch (error) {
      this.logger.error('Failed to get group by ID', {
        error: error instanceof Error ? error.message : String(error),
        groupId,
      });
      throw error;
    }
  }

  async updateGroup(
    groupId: string,
    userId: number,
    data: UpdateGroupData
  ): Promise<Group> {
    try {
      const [updated] = await this.database
        .update(groups)
        .set(data)
        .where(and(eq(groups.id, groupId), eq(groups.userId, userId)))
        .returning();

      if (!updated) {
        throw new Error(`Group not found: ${groupId}`);
      }

      this.logger.info('Updated group', { groupId });
      return updated;
    } catch (error) {
      this.logger.error('Failed to update group', {
        error: error instanceof Error ? error.message : String(error),
        groupId,
      });
      throw error;
    }
  }

  async deleteGroup(groupId: string, userId: number): Promise<void> {
    try {
      const result = await this.database
        .delete(groups)
        .where(and(eq(groups.id, groupId), eq(groups.userId, userId)));

      this.logger.info('Deleted group', { groupId });
    } catch (error) {
      this.logger.error('Failed to delete group', {
        error: error instanceof Error ? error.message : String(error),
        groupId,
      });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // GROUP ITEMS
  // --------------------------------------------------------------------------

  async addItems(
    groupId: string,
    items: CreateGroupItemData[]
  ): Promise<GroupItem[]> {
    try {
      const values = items.map((item) => ({
        groupId,
        itemType: item.itemType,
        sessionMappingId: item.sessionMappingId,
        workflowId: item.workflowId ?? null,
        stepId: item.stepId ?? null,
        metadata: item.metadata ?? null,
      }));

      const created = await this.database
        .insert(groupItems)
        .values(values)
        .onConflictDoNothing()
        .returning();

      this.logger.info('Added items to group', {
        groupId,
        count: created.length,
      });

      return created;
    } catch (error) {
      this.logger.error('Failed to add items to group', {
        error: error instanceof Error ? error.message : String(error),
        groupId,
      });
      throw error;
    }
  }

  async removeItem(groupId: string, itemId: string): Promise<void> {
    try {
      await this.database
        .delete(groupItems)
        .where(
          and(eq(groupItems.id, itemId), eq(groupItems.groupId, groupId))
        );

      this.logger.info('Removed item from group', { groupId, itemId });
    } catch (error) {
      this.logger.error('Failed to remove item from group', {
        error: error instanceof Error ? error.message : String(error),
        groupId,
        itemId,
      });
      throw error;
    }
  }

  async getGroupItems(groupId: string): Promise<GroupItem[]> {
    try {
      return await this.database
        .select()
        .from(groupItems)
        .where(eq(groupItems.groupId, groupId))
        .orderBy(desc(groupItems.addedAt));
    } catch (error) {
      this.logger.error('Failed to get group items', {
        error: error instanceof Error ? error.message : String(error),
        groupId,
      });
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // RESOLVE GROUP → SESSION MAPPINGS DATA
  // --------------------------------------------------------------------------

  /**
   * Resolve all group items to their parent session_mappings data.
   * Returns deduplicated sessions with all 6 key columns:
   * 4 vectors (summaryEmbedding, highLevelSummaryEmbedding, screenshotDescriptionsEmbedding, gapAnalysisEmbedding)
   * 2 JSONB (summary, screenshotDescriptions)
   * Plus display fields (generatedTitle, highLevelSummary, durationSeconds, workflowName)
   */
  async resolveGroupSessions(
    groupId: string
  ): Promise<ResolvedSessionData[]> {
    try {
      const result = await this.database
        .selectDistinctOn([sessionMappings.id], {
          id: sessionMappings.id,
          generatedTitle: sessionMappings.generatedTitle,
          highLevelSummary: sessionMappings.highLevelSummary,
          summary: sessionMappings.summary,
          screenshotDescriptions: sessionMappings.screenshotDescriptions,
          summaryEmbedding: sessionMappings.summaryEmbedding,
          highLevelSummaryEmbedding: sessionMappings.highLevelSummaryEmbedding,
          screenshotDescriptionsEmbedding:
            sessionMappings.screenshotDescriptionsEmbedding,
          gapAnalysisEmbedding: sessionMappings.gapAnalysisEmbedding,
          durationSeconds: sessionMappings.durationSeconds,
          workflowName: sessionMappings.workflowName,
        })
        .from(groupItems)
        .innerJoin(
          sessionMappings,
          eq(groupItems.sessionMappingId, sessionMappings.id)
        )
        .where(eq(groupItems.groupId, groupId));

      this.logger.info('Resolved group sessions', {
        groupId,
        sessionCount: result.length,
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to resolve group sessions', {
        error: error instanceof Error ? error.message : String(error),
        groupId,
      });
      throw error;
    }
  }
}
