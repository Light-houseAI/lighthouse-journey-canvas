/**
 * Concept Embedding Repository
 *
 * Handles storage and retrieval of concept embeddings in PostgreSQL
 */

import { conceptEmbeddings } from '@journey/schema';
import { eq, desc, gte, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';

import type { Logger } from '../core/logger.js';

export interface ConceptEmbedding {
  id: number;
  conceptName: string;
  category: string | null;
  embedding: number[];
  sourceType: string | null;
  frequency: number;
  firstSeen: Date;
  lastSeen: Date;
  meta: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConceptEmbeddingData {
  conceptName: string;
  category?: string;
  embedding: Float32Array;
  sourceType?: string;
  meta?: Record<string, any>;
}

export class ConceptEmbeddingRepository {
  private pool: Pool;
  private db: any;
  private logger: Logger;

  constructor(pool: Pool, logger: Logger, db?: any) {
    this.pool = pool;
    this.db = db || drizzle(pool);
    this.logger = logger;
  }

  /**
   * Upsert concept embedding
   * If concept exists, updates frequency and last_seen
   * If new, inserts with frequency = 1
   */
  async upsert(data: CreateConceptEmbeddingData): Promise<ConceptEmbedding> {
    try {
      // Check if concept exists
      const existing = await this.db
        .select()
        .from(conceptEmbeddings)
        .where(eq(conceptEmbeddings.conceptName, data.conceptName))
        .limit(1);

      if (existing.length > 0) {
        // Update existing: increment frequency and update last_seen
        const updated = await this.db
          .update(conceptEmbeddings)
          .set({
            frequency: sql`${conceptEmbeddings.frequency} + 1`,
            lastSeen: new Date(),
            embedding: Array.from(data.embedding),
            category: data.category || existing[0].category,
            meta: data.meta || existing[0].meta,
            updatedAt: new Date(),
          })
          .where(eq(conceptEmbeddings.id, existing[0].id))
          .returning();

        this.logger.debug('Updated concept embedding', {
          conceptName: data.conceptName,
          newFrequency: updated[0].frequency,
        });

        return this.mapToConcept(updated[0]);
      } else {
        // Insert new
        const inserted = await this.db
          .insert(conceptEmbeddings)
          .values({
            conceptName: data.conceptName,
            category: data.category || 'general',
            embedding: Array.from(data.embedding),
            sourceType: data.sourceType || 'extracted',
            frequency: 1,
            meta: data.meta || {},
          })
          .returning();

        this.logger.debug('Inserted new concept embedding', {
          conceptName: data.conceptName,
        });

        return this.mapToConcept(inserted[0]);
      }
    } catch (error) {
      this.logger.error('Failed to upsert concept embedding', {
        conceptName: data.conceptName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Batch upsert multiple concept embeddings
   */
  async upsertBatch(
    dataList: CreateConceptEmbeddingData[]
  ): Promise<ConceptEmbedding[]> {
    const results: ConceptEmbedding[] = [];

    for (const data of dataList) {
      const result = await this.upsert(data);
      results.push(result);
    }

    this.logger.info('Batch upserted concept embeddings', {
      count: dataList.length,
    });

    return results;
  }

  /**
   * Get concept by name
   */
  async getByName(conceptName: string): Promise<ConceptEmbedding | null> {
    const result = await this.db
      .select()
      .from(conceptEmbeddings)
      .where(eq(conceptEmbeddings.conceptName, conceptName))
      .limit(1);

    return result.length > 0 ? this.mapToConcept(result[0]) : null;
  }

  /**
   * Get top concepts by frequency
   */
  async getTopByFrequency(
    limit: number = 20,
    minFrequency: number = 2
  ): Promise<ConceptEmbedding[]> {
    const results = await this.db
      .select()
      .from(conceptEmbeddings)
      .where(gte(conceptEmbeddings.frequency, minFrequency))
      .orderBy(desc(conceptEmbeddings.frequency))
      .limit(limit);

    return results.map((r: any) => this.mapToConcept(r));
  }

  /**
   * Search concepts by similarity (vector search)
   */
  async searchBySimilarity(
    queryEmbedding: Float32Array,
    limit: number = 10,
    minSimilarity: number = 0.5
  ): Promise<Array<ConceptEmbedding & { similarity: number }>> {
    const embeddingArray = Array.from(queryEmbedding);

    const query = sql`
      SELECT
        *,
        1 - (embedding <=> ${embeddingArray}::vector) as similarity
      FROM concept_embeddings
      WHERE 1 - (embedding <=> ${embeddingArray}::vector) >= ${minSimilarity}
      ORDER BY embedding <=> ${embeddingArray}::vector
      LIMIT ${limit}
    `;

    const results = await this.pool.query(query.strings[0], query.values);

    return results.rows.map((row: any) => ({
      ...this.mapToConcept(row),
      similarity: parseFloat(row.similarity),
    }));
  }

  /**
   * Get concepts by category
   */
  async getByCategory(
    category: string,
    limit: number = 50
  ): Promise<ConceptEmbedding[]> {
    const results = await this.db
      .select()
      .from(conceptEmbeddings)
      .where(eq(conceptEmbeddings.category, category))
      .orderBy(desc(conceptEmbeddings.frequency))
      .limit(limit);

    return results.map((r: any) => this.mapToConcept(r));
  }

  /**
   * Map database row to ConceptEmbedding
   */
  private mapToConcept(row: any): ConceptEmbedding {
    return {
      id: row.id,
      conceptName: row.conceptName || row.concept_name,
      category: row.category,
      embedding: row.embedding,
      sourceType: row.sourceType || row.source_type,
      frequency: row.frequency,
      firstSeen: new Date(row.firstSeen || row.first_seen),
      lastSeen: new Date(row.lastSeen || row.last_seen),
      meta: row.meta || {},
      createdAt: new Date(row.createdAt || row.created_at),
      updatedAt: new Date(row.updatedAt || row.updated_at),
    };
  }
}
