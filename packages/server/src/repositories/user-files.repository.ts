/**
 * UserFilesRepository
 * Database access layer for tracking uploaded files
 */

import * as schema from '@journey/schema';
import { userFiles } from '@journey/schema';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { Logger } from '../core/logger';

export interface UserFileRecord {
  id: number;
  userId: number;
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  fileType: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserFileInput {
  userId: number;
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  fileType: string;
}

export class UserFilesRepository {
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
   * Create a new file record
   */
  async create(input: CreateUserFileInput): Promise<UserFileRecord> {
    try {
      const result = await this.database
        .insert(userFiles)
        .values({
          userId: input.userId,
          storageKey: input.storageKey,
          filename: input.filename,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          fileType: input.fileType,
        })
        .returning();

      this.logger.info('User file record created', {
        userId: input.userId,
        storageKey: input.storageKey,
        sizeBytes: input.sizeBytes,
      });

      return result[0];
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error creating user file record', {
        input,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Find file by storage key (only non-deleted files)
   */
  async findByStorageKey(storageKey: string): Promise<UserFileRecord | null> {
    try {
      const result = await this.database
        .select()
        .from(userFiles)
        .where(eq(userFiles.storageKey, storageKey))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error finding file by storage key', {
        storageKey,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Find all files for a user (only non-deleted files)
   */
  async findByUserId(userId: number): Promise<UserFileRecord[]> {
    try {
      const result = await this.database
        .select()
        .from(userFiles)
        .where(eq(userFiles.userId, userId));

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error finding files by user ID', {
        userId,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Soft delete a file by setting deletedAt timestamp
   */
  async softDelete(storageKey: string): Promise<UserFileRecord> {
    try {
      const result = await this.database
        .update(userFiles)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userFiles.storageKey, storageKey))
        .returning();

      if (result.length === 0) {
        throw new Error('File not found');
      }

      this.logger.info('User file soft deleted', {
        storageKey,
        fileId: result[0].id,
      });

      return result[0];
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error soft deleting file', {
        storageKey,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Get total storage used by user (excluding deleted files)
   */
  async getTotalStorageByUserId(userId: number): Promise<number> {
    try {
      const result = await this.database
        .select()
        .from(userFiles)
        .where(eq(userFiles.userId, userId));

      const activeFiles = result.filter((file) => !file.deletedAt);
      const total = activeFiles.reduce(
        (sum, file) => sum + Number(file.sizeBytes),
        0
      );

      return total;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error calculating total storage', {
        userId,
        error: err.message,
      });
      throw err;
    }
  }
}
