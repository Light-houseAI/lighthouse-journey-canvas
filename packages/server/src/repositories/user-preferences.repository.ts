import * as schema from '@journey/schema';
import { userPreferences } from '@journey/schema';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from '../core/logger.js';

export interface UserPreferencesData {
  receivePeerInsights?: boolean;
  sharePeerInsights?: boolean;
  shareScopeDefault?: 'all' | 'per_session';
}

export class UserPreferencesRepository {
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

  async findByUserId(userId: number) {
    try {
      const result = await this.database
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId))
        .limit(1);

      return result[0] ?? null;
    } catch (error) {
      this.logger.error('Failed to find user preferences', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async upsert(userId: number, data: UserPreferencesData) {
    try {
      const result = await this.database
        .insert(userPreferences)
        .values({
          userId,
          receivePeerInsights: data.receivePeerInsights ?? false,
          sharePeerInsights: data.sharePeerInsights ?? false,
          shareScopeDefault: data.shareScopeDefault ?? 'all',
        })
        .onConflictDoUpdate({
          target: userPreferences.userId,
          set: {
            ...(data.receivePeerInsights !== undefined && {
              receivePeerInsights: data.receivePeerInsights,
            }),
            ...(data.sharePeerInsights !== undefined && {
              sharePeerInsights: data.sharePeerInsights,
            }),
            ...(data.shareScopeDefault !== undefined && {
              shareScopeDefault: data.shareScopeDefault,
            }),
            updatedAt: new Date(),
          },
        })
        .returning();

      this.logger.info('Upserted user preferences', { userId });
      return result[0];
    } catch (error) {
      this.logger.error('Failed to upsert user preferences', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Returns user IDs that have opted into sharing their sessions with peers.
   */
  async getSharingUserIds(): Promise<number[]> {
    try {
      const result = await this.database
        .select({ userId: userPreferences.userId })
        .from(userPreferences)
        .where(eq(userPreferences.sharePeerInsights, true));

      return result.map((r) => r.userId);
    } catch (error) {
      this.logger.error('Failed to get sharing user IDs', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}
