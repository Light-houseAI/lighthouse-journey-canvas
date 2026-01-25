/**
 * Company Document Repository
 *
 * Handles CRUD operations for company documents used in RAG-based insight generation.
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from '../core/logger.js';
import * as schema from '@journey/schema';
import {
  companyDocuments,
  graphragChunks,
  type CompanyDocument,
  type InsertCompanyDocument,
  type CompanyDocProcessingStatus,
} from '@journey/schema';

// ============================================================================
// TYPES
// ============================================================================

export interface CompanyDocumentRepositoryDeps {
  database: NodePgDatabase<typeof schema>;
  logger: Logger;
}

// ============================================================================
// REPOSITORY
// ============================================================================

export class CompanyDocumentRepository {
  private readonly db: NodePgDatabase<typeof schema>;
  private readonly logger: Logger;

  constructor(deps: CompanyDocumentRepositoryDeps) {
    this.db = deps.database;
    this.logger = deps.logger;
  }

  /**
   * Create a new company document record
   */
  async create(data: InsertCompanyDocument): Promise<CompanyDocument> {
    this.logger.debug('Creating company document', {
      userId: data.userId,
      filename: data.filename,
    });

    const result = await this.db
      .insert(companyDocuments)
      .values(data)
      .returning();

    return result[0];
  }

  /**
   * Find a company document by ID
   */
  async findById(id: number): Promise<CompanyDocument | null> {
    const result = await this.db
      .select()
      .from(companyDocuments)
      .where(eq(companyDocuments.id, id))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find a company document by storage key
   */
  async findByStorageKey(storageKey: string): Promise<CompanyDocument | null> {
    const result = await this.db
      .select()
      .from(companyDocuments)
      .where(eq(companyDocuments.storageKey, storageKey))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find all company documents for a user
   */
  async findByUserId(userId: number): Promise<CompanyDocument[]> {
    this.logger.debug('Finding company documents for user', { userId });

    const result = await this.db
      .select()
      .from(companyDocuments)
      .where(eq(companyDocuments.userId, userId))
      .orderBy(desc(companyDocuments.createdAt));

    return result;
  }

  /**
   * Update processing status of a document
   */
  async updateProcessingStatus(
    id: number,
    status: CompanyDocProcessingStatus,
    error?: string,
    chunkCount?: number
  ): Promise<void> {
    this.logger.debug('Updating document processing status', {
      id,
      status,
      chunkCount,
    });

    const updateData: Partial<CompanyDocument> = {
      processingStatus: status,
      updatedAt: new Date(),
    };

    if (error !== undefined) {
      updateData.processingError = error;
    }

    if (chunkCount !== undefined) {
      updateData.chunkCount = chunkCount;
    }

    if (status === 'completed') {
      updateData.processedAt = new Date();
    }

    await this.db
      .update(companyDocuments)
      .set(updateData)
      .where(eq(companyDocuments.id, id));
  }

  /**
   * Delete a company document and its chunks
   */
  async delete(id: number, userId: number): Promise<boolean> {
    this.logger.debug('Deleting company document', { id, userId });

    // First, delete associated chunks from graphrag_chunks
    await this.db.execute(sql`
      DELETE FROM graphrag_chunks
      WHERE node_type = 'company_document'
      AND meta->>'documentId' = ${id.toString()}
      AND user_id = ${userId}
    `);

    // Then delete the document record
    const result = await this.db
      .delete(companyDocuments)
      .where(
        and(
          eq(companyDocuments.id, id),
          eq(companyDocuments.userId, userId)
        )
      )
      .returning({ id: companyDocuments.id });

    return result.length > 0;
  }

  /**
   * Get statistics for a user's company documents
   */
  async getStats(userId: number): Promise<{
    totalDocuments: number;
    totalChunks: number;
    totalSizeBytes: number;
    processingCounts: Record<CompanyDocProcessingStatus, number>;
  }> {
    const docs = await this.findByUserId(userId);

    const processingCounts: Record<CompanyDocProcessingStatus, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    let totalChunks = 0;
    let totalSizeBytes = 0;

    for (const doc of docs) {
      const status = doc.processingStatus as CompanyDocProcessingStatus;
      processingCounts[status] = (processingCounts[status] || 0) + 1;
      totalChunks += doc.chunkCount || 0;
      totalSizeBytes += doc.sizeBytes;
    }

    return {
      totalDocuments: docs.length,
      totalChunks,
      totalSizeBytes,
      processingCounts,
    };
  }

  /**
   * Find documents with pending status for processing
   */
  async findPendingDocuments(limit: number = 10): Promise<CompanyDocument[]> {
    const result = await this.db
      .select()
      .from(companyDocuments)
      .where(eq(companyDocuments.processingStatus, 'pending'))
      .orderBy(companyDocuments.createdAt)
      .limit(limit);

    return result;
  }
}
