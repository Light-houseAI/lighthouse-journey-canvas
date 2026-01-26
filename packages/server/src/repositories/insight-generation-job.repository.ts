/**
 * Insight Generation Job Repository
 *
 * Database persistence for insight generation jobs.
 * Replaces in-memory storage for production reliability.
 */

import { insightGenerationJobs } from '@journey/schema';
import { eq, desc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { Logger } from '../core/logger.js';
import type * as schema from '@journey/schema';

// Types inferred from schema
export type InsightGenerationJobRecord = typeof insightGenerationJobs.$inferSelect;
export type InsightGenerationJobInsert = typeof insightGenerationJobs.$inferInsert;

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface CreateJobInput {
  userId: number;
  query: string;
  nodeId?: string | null;
  status?: JobStatus;
  progress?: number;
  currentStage?: string;
}

export interface UpdateJobInput {
  status?: JobStatus;
  progress?: number;
  currentStage?: string;
  agentStates?: Record<string, any>;
  result?: Record<string, any>;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export class InsightGenerationJobRepository {
  private readonly db: NodePgDatabase<typeof schema>;
  private readonly logger: Logger;

  constructor({
    database,
    logger,
  }: {
    database: NodePgDatabase<typeof schema>;
    logger: Logger;
  }) {
    this.db = database;
    this.logger = logger;
  }

  /**
   * Create a new job record
   */
  async create(input: CreateJobInput): Promise<InsightGenerationJobRecord> {
    try {
      const result = await this.db
        .insert(insightGenerationJobs)
        .values({
          userId: input.userId,
          query: input.query,
          nodeId: input.nodeId || null,
          status: input.status || 'pending',
          progress: input.progress || 0,
          currentStage: input.currentStage || 'initializing',
          agentStates: {},
        })
        .returning();

      this.logger.info('Created insight generation job', {
        jobId: result[0].id,
        userId: input.userId,
      });

      return result[0];
    } catch (error) {
      this.logger.error('Failed to create insight generation job', { error, input });
      throw error;
    }
  }

  /**
   * Find job by ID
   */
  async findById(id: string): Promise<InsightGenerationJobRecord | null> {
    try {
      const results = await this.db
        .select()
        .from(insightGenerationJobs)
        .where(eq(insightGenerationJobs.id, id))
        .limit(1);

      return results[0] || null;
    } catch (error) {
      this.logger.error('Failed to find insight generation job', { error, id });
      throw error;
    }
  }

  /**
   * Update job record
   */
  async update(id: string, input: UpdateJobInput): Promise<InsightGenerationJobRecord | null> {
    try {
      const updateData: Record<string, any> = {};

      if (input.status !== undefined) updateData.status = input.status;
      if (input.progress !== undefined) updateData.progress = input.progress;
      if (input.currentStage !== undefined) updateData.currentStage = input.currentStage;
      if (input.agentStates !== undefined) updateData.agentStates = input.agentStates;
      if (input.result !== undefined) updateData.result = input.result;
      if (input.errorMessage !== undefined) updateData.errorMessage = input.errorMessage;
      if (input.startedAt !== undefined) updateData.startedAt = input.startedAt;
      if (input.completedAt !== undefined) updateData.completedAt = input.completedAt;

      const results = await this.db
        .update(insightGenerationJobs)
        .set(updateData)
        .where(eq(insightGenerationJobs.id, id))
        .returning();

      if (results.length === 0) {
        this.logger.warn('Attempted to update non-existent job', { id });
        return null;
      }

      return results[0];
    } catch (error) {
      this.logger.error('Failed to update insight generation job', { error, id, input });
      throw error;
    }
  }

  /**
   * Find jobs by user ID
   */
  async findByUserId(
    userId: number,
    options?: { limit?: number; offset?: number }
  ): Promise<InsightGenerationJobRecord[]> {
    try {
      let query = this.db
        .select()
        .from(insightGenerationJobs)
        .where(eq(insightGenerationJobs.userId, userId))
        .orderBy(desc(insightGenerationJobs.createdAt));

      if (options?.limit) {
        query = query.limit(options.limit) as typeof query;
      }

      if (options?.offset) {
        query = query.offset(options.offset) as typeof query;
      }

      return await query;
    } catch (error) {
      this.logger.error('Failed to find jobs by user ID', { error, userId });
      throw error;
    }
  }

  /**
   * Delete job by ID
   */
  async delete(id: string): Promise<boolean> {
    try {
      const results = await this.db
        .delete(insightGenerationJobs)
        .where(eq(insightGenerationJobs.id, id))
        .returning();

      return results.length > 0;
    } catch (error) {
      this.logger.error('Failed to delete insight generation job', { error, id });
      throw error;
    }
  }

  /**
   * Clean up old completed/failed jobs (for maintenance)
   */
  async cleanupOldJobs(olderThanDays: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // Only delete completed, failed, or cancelled jobs older than cutoff
      const results = await this.db
        .delete(insightGenerationJobs)
        .where(
          eq(insightGenerationJobs.status, 'completed')
        )
        .returning();

      this.logger.info('Cleaned up old insight generation jobs', {
        deletedCount: results.length,
        olderThanDays,
      });

      return results.length;
    } catch (error) {
      this.logger.error('Failed to cleanup old jobs', { error, olderThanDays });
      throw error;
    }
  }
}
