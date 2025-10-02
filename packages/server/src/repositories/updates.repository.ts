/**
 * UpdatesRepository
 * Database access layer for career transition updates
 */

import * as schema from '@journey/schema';
import {
  Update,
  updates,
  CreateUpdateRequest,
  UpdateUpdateRequest,
  UpdatesListResponse,
  timelineNodes,
} from '@journey/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { Logger } from '../core/logger.js';

export interface PaginationOptions {
  page: number;
  limit: number;
}

export class UpdatesRepository {
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

  /**
   * Create a new update
   */
  async create(nodeId: string, data: CreateUpdateRequest): Promise<Update> {
    try {
      const renderedText = this.generateRenderedText(data);

      const [created] = await this.database
        .insert(updates)
        .values({
          nodeId,
          notes: data.notes,
          meta: data.meta || {},
          renderedText,
        })
        .returning();

      this.logger.info('Created update', {
        updateId: created.id,
        nodeId,
      });

      return created;
    } catch (error) {
      this.logger.error('Failed to create update', {
        error: error instanceof Error ? error.message : String(error),
        nodeId,
      });
      throw error;
    }
  }

  /**
   * Get update by ID
   */
  async getById(id: string): Promise<Update | null> {
    try {
      const [result] = await this.database
        .select()
        .from(updates)
        .where(and(eq(updates.id, id), eq(updates.isDeleted, false)));

      return result || null;
    } catch (error) {
      this.logger.error('Failed to get update by ID', {
        error: error instanceof Error ? error.message : String(error),
        updateId: id,
      });
      throw error;
    }
  }

  /**
   * Get updates by node ID with pagination
   */
  async getByNodeId(
    nodeId: string, 
    options: PaginationOptions
  ): Promise<{ updates: Update[]; total: number }> {
    try {
      const { page, limit } = options;
      const offset = (page - 1) * limit;

      // Get total count
      const [{ count }] = await this.database
        .select({ count: sql<number>`count(*)` })
        .from(updates)
        .where(and(eq(updates.nodeId, nodeId), eq(updates.isDeleted, false)));

      // Get updates
      const results = await this.database
        .select()
        .from(updates)
        .where(and(eq(updates.nodeId, nodeId), eq(updates.isDeleted, false)))
        .orderBy(desc(updates.createdAt))
        .limit(limit)
        .offset(offset);

      this.logger.debug('Retrieved updates for node', {
        nodeId,
        count: results.length,
        total: count,
        page,
        limit,
      });

      return {
        updates: results,
        total: count,
      };
    } catch (error) {
      this.logger.error('Failed to get updates by node ID', {
        error: error instanceof Error ? error.message : String(error),
        nodeId,
      });
      throw error;
    }
  }

  /**
   * Update an existing update
   */
  async update(id: string, data: UpdateUpdateRequest): Promise<Update | null> {
    try {
      const renderedText = this.generateRenderedText(data);

      const [updated] = await this.database
        .update(updates)
        .set({
          notes: data.notes,
          meta: data.meta || {},
          renderedText,
          updatedAt: sql`now()`,
        })
        .where(and(eq(updates.id, id), eq(updates.isDeleted, false)))
        .returning();

      if (updated) {
        this.logger.info('Updated update', {
          updateId: id,
        });
      }

      return updated || null;
    } catch (error) {
      this.logger.error('Failed to update update', {
        error: error instanceof Error ? error.message : String(error),
        updateId: id,
      });
      throw error;
    }
  }

  /**
   * Soft delete an update
   */
  async softDelete(id: string): Promise<boolean> {
    try {
      const [deleted] = await this.database
        .update(updates)
        .set({
          isDeleted: true,
          updatedAt: sql`now()`,
        })
        .where(and(eq(updates.id, id), eq(updates.isDeleted, false)))
        .returning({ id: updates.id });

      const success = !!deleted;
      
      if (success) {
        this.logger.info('Soft deleted update', {
          updateId: id,
        });
      }

      return success;
    } catch (error) {
      this.logger.error('Failed to soft delete update', {
        error: error instanceof Error ? error.message : String(error),
        updateId: id,
      });
      throw error;
    }
  }

  /**
   * Check if update belongs to node
   */
  async belongsToNode(updateId: string, nodeId: string): Promise<boolean> {
    try {
      const [result] = await this.database
        .select({ nodeId: updates.nodeId })
        .from(updates)
        .where(and(eq(updates.id, updateId), eq(updates.isDeleted, false)));

      return result?.nodeId === nodeId;
    } catch (error) {
      this.logger.error('Failed to check update node ownership', {
        error: error instanceof Error ? error.message : String(error),
        updateId,
        nodeId,
      });
      throw error;
    }
  }

  /**
   * Generate rendered text for vector database search
   */
  private generateRenderedText(data: CreateUpdateRequest | UpdateUpdateRequest): string {
    const sections: string[] = [];

    // Job search preparation activities
    const prepActivities: string[] = [];
    if (data.meta?.appliedToJobs) prepActivities.push('applied to jobs');
    if (data.meta?.updatedResumeOrPortfolio) prepActivities.push('updated resume or portfolio');
    if (data.meta?.networked) prepActivities.push('networked');
    if (data.meta?.developedSkills) prepActivities.push('developed skills');

    if (prepActivities.length > 0) {
      sections.push(`Job Search Preparation: ${prepActivities.join(', ')}`);
    }

    // Interview activities
    const interviewActivities: string[] = [];
    if (data.meta?.pendingInterviews) interviewActivities.push('pending interviews');
    if (data.meta?.completedInterviews) interviewActivities.push('completed interviews');
    if (data.meta?.practicedMock) interviewActivities.push('practiced mock interviews');
    if (data.meta?.receivedOffers) interviewActivities.push('received offers');
    if (data.meta?.receivedRejections) interviewActivities.push('received rejections');
    if (data.meta?.possiblyGhosted) interviewActivities.push('possibly ghosted');

    if (interviewActivities.length > 0) {
      sections.push(`Interview Activity: ${interviewActivities.join(', ')}`);
    }

    // Other notes
    if (data.notes?.trim()) {
      sections.push(`Notes: ${data.notes.trim()}`);
    }

    return sections.join('\n');
  }
}