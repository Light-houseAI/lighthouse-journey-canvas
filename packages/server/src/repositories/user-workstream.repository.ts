import { userWorkstreams } from '@journey/schema';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@journey/schema';
import type { Logger } from '../core/logger.js';

export type UserWorkstream = typeof userWorkstreams.$inferSelect;

export interface UpsertWorkstreamData {
  userId: number;
  workstreamId: string;
  name: string;
  outcomeDescription?: string;
  sessionIds: string[];
  topics?: string[];
  toolsUsed?: string[];
  confidence: number;
  firstActivity?: Date;
  lastActivity?: Date;
  totalDurationSeconds?: number;
}

export class UserWorkstreamRepository {
  private readonly database: NodePgDatabase<typeof schema>;
  private readonly logger: Logger;

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

  /**
   * Get all active workstreams for a user (for Tier 1 matching).
   */
  async getActiveWorkstreams(userId: number): Promise<UserWorkstream[]> {
    try {
      const results = await this.database
        .select()
        .from(userWorkstreams)
        .where(
          and(
            eq(userWorkstreams.userId, userId),
            eq(userWorkstreams.isActive, true)
          )
        );
      return results;
    } catch (error) {
      this.logger.error('Failed to get active workstreams',
        error instanceof Error ? error : new Error(String(error)),
        { userId }
      );
      return [];
    }
  }

  /**
   * Create or update a workstream.
   * Uses workstreamId + userId as the unique key.
   */
  async upsertWorkstream(data: UpsertWorkstreamData): Promise<UserWorkstream> {
    try {
      const existing = await this.database
        .select()
        .from(userWorkstreams)
        .where(
          and(
            eq(userWorkstreams.userId, data.userId),
            eq(userWorkstreams.workstreamId, data.workstreamId)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        const [updated] = await this.database
          .update(userWorkstreams)
          .set({
            name: data.name,
            outcomeDescription: data.outcomeDescription,
            sessionIds: data.sessionIds,
            topics: data.topics || [],
            toolsUsed: data.toolsUsed || [],
            confidence: data.confidence,
            firstActivity: data.firstActivity,
            lastActivity: data.lastActivity,
            totalDurationSeconds: data.totalDurationSeconds || 0,
          })
          .where(
            and(
              eq(userWorkstreams.userId, data.userId),
              eq(userWorkstreams.workstreamId, data.workstreamId)
            )
          )
          .returning();
        return updated;
      }

      const [created] = await this.database
        .insert(userWorkstreams)
        .values({
          userId: data.userId,
          workstreamId: data.workstreamId,
          name: data.name,
          outcomeDescription: data.outcomeDescription,
          sessionIds: data.sessionIds,
          topics: data.topics || [],
          toolsUsed: data.toolsUsed || [],
          confidence: data.confidence,
          firstActivity: data.firstActivity,
          lastActivity: data.lastActivity,
          totalDurationSeconds: data.totalDurationSeconds || 0,
          isActive: true,
        })
        .returning();
      return created;
    } catch (error) {
      this.logger.error('Failed to upsert workstream',
        error instanceof Error ? error : new Error(String(error)),
        { userId: data.userId, workstreamId: data.workstreamId }
      );
      throw error;
    }
  }

  /**
   * Add a session to an existing workstream and update aggregated fields.
   */
  async addSessionToWorkstream(
    userId: number,
    workstreamId: string,
    sessionId: string,
    updates: {
      toolsUsed?: string[];
      lastActivity?: Date;
      additionalDurationSeconds?: number;
      confidence?: number;
    }
  ): Promise<void> {
    try {
      const existing = await this.database
        .select()
        .from(userWorkstreams)
        .where(
          and(
            eq(userWorkstreams.userId, userId),
            eq(userWorkstreams.workstreamId, workstreamId)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        this.logger.warn('Workstream not found for addSession', {
          userId,
          workstreamId,
        });
        return;
      }

      const ws = existing[0];
      const updatedSessionIds = [...new Set([...(ws.sessionIds || []), sessionId])];
      const updatedTools = [...new Set([...(ws.toolsUsed || []), ...(updates.toolsUsed || [])])];

      await this.database
        .update(userWorkstreams)
        .set({
          sessionIds: updatedSessionIds,
          toolsUsed: updatedTools,
          lastActivity: updates.lastActivity || ws.lastActivity,
          totalDurationSeconds:
            (ws.totalDurationSeconds || 0) + (updates.additionalDurationSeconds || 0),
          confidence: updates.confidence ?? ws.confidence,
        })
        .where(
          and(
            eq(userWorkstreams.userId, userId),
            eq(userWorkstreams.workstreamId, workstreamId)
          )
        );
    } catch (error) {
      this.logger.error('Failed to add session to workstream',
        error instanceof Error ? error : new Error(String(error)),
        { userId, workstreamId, sessionId }
      );
    }
  }
}
