/**
 * StorageQuotaRepository
 * Database access layer for user storage quota management
 */

import * as schema from '@journey/schema';
import { userStorageUsage } from '@journey/schema';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { Logger } from '../core/logger';

export interface StorageQuotaRecord {
  id: string;
  userId: number;
  bytesUsed: number;
  quotaBytes: number;
  createdAt: Date;
  updatedAt: Date;
}

export class StorageQuotaRepository {
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
   * Get quota record for user
   */
  async getByUserId(userId: number): Promise<StorageQuotaRecord | null> {
    try {
      const result = await this.database
        .select()
        .from(userStorageUsage)
        .where(eq(userStorageUsage.userId, userId))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error fetching storage quota', {
        userId,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Create quota record for user with default quota
   */
  async create(
    userId: number,
    quotaBytes: number = 104857600
  ): Promise<StorageQuotaRecord> {
    try {
      const result = await this.database
        .insert(userStorageUsage)
        .values({
          userId,
          bytesUsed: 0,
          quotaBytes,
        })
        .onConflictDoNothing()
        .returning();

      if (result.length === 0) {
        // Race condition - record was created by another request
        // Fetch and return the existing record
        const existing = await this.getByUserId(userId);
        if (!existing) {
          throw new Error('Failed to create or fetch storage quota record');
        }
        return existing;
      }

      this.logger.info('Storage quota record created', {
        userId,
        quotaBytes,
      });

      return result[0];
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error creating storage quota', {
        userId,
        quotaBytes,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Update storage usage atomically
   * Uses SQL to prevent race conditions
   * @param userId - User ID
   * @param bytesChange - Bytes to add (positive) or remove (negative)
   */
  async updateUsage(
    userId: number,
    bytesChange: number
  ): Promise<StorageQuotaRecord> {
    try {
      // Use atomic SQL update to prevent race conditions
      // GREATEST ensures bytesUsed never goes negative
      const result = await this.database
        .update(userStorageUsage)
        .set({
          bytesUsed: sql`GREATEST(0, ${userStorageUsage.bytesUsed} + ${bytesChange})`,
          updatedAt: new Date(),
        })
        .where(eq(userStorageUsage.userId, userId))
        .returning();

      if (result.length === 0) {
        throw new Error('Storage quota record not found for user');
      }

      this.logger.info('Storage usage updated', {
        userId,
        bytesChange,
        newBytesUsed: result[0].bytesUsed,
      });

      return result[0];
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error updating storage usage', {
        userId,
        bytesChange,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Get or create quota record for user
   * Ensures record exists before returning
   */
  async getOrCreate(
    userId: number,
    defaultQuotaBytes: number = 104857600
  ): Promise<StorageQuotaRecord> {
    try {
      // Try to get existing record
      const existing = await this.getByUserId(userId);
      if (existing) {
        return existing;
      }

      // Create if not exists
      return await this.create(userId, defaultQuotaBytes);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error in getOrCreate storage quota', {
        userId,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Update quota limit for user
   */
  async updateQuota(
    userId: number,
    newQuotaBytes: number
  ): Promise<StorageQuotaRecord> {
    try {
      const result = await this.database
        .update(userStorageUsage)
        .set({
          quotaBytes: newQuotaBytes,
          updatedAt: new Date(),
        })
        .where(eq(userStorageUsage.userId, userId))
        .returning();

      if (result.length === 0) {
        throw new Error('Storage quota record not found for user');
      }

      this.logger.info('Storage quota limit updated', {
        userId,
        newQuotaBytes,
      });

      return result[0];
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error updating quota limit', {
        userId,
        newQuotaBytes,
        error: err.message,
      });
      throw err;
    }
  }
}
