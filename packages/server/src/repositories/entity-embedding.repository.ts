/**
 * Entity Embedding Repository
 *
 * Handles storage and retrieval of entity embeddings in PostgreSQL
 */

import { entityEmbeddings } from '@journey/schema';
import { eq, desc, gte, and, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';

import type { Logger } from '../core/logger.js';

export interface EntityEmbedding {
  id: number;
  entityName: string;
  entityType: string;
  embedding: number[];
  frequency: number;
  firstSeen: Date;
  lastSeen: Date;
  meta: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEntityEmbeddingData {
  entityName: string;
  entityType: string;
  embedding: Float32Array;
  meta?: Record<string, any>;
}

export class EntityEmbeddingRepository {
  private pool: Pool;
  private db: any;
  private logger: Logger;

  constructor(pool: Pool, logger: Logger, db?: any) {
    this.pool = pool;
    this.db = db || drizzle(pool);
    this.logger = logger;
  }

  /**
   * Upsert entity embedding
   * If entity exists, updates frequency and last_seen
   * If new, inserts with frequency = 1
   */
  async upsert(data: CreateEntityEmbeddingData): Promise<EntityEmbedding> {
    try {
      // Check if entity exists (unique on name + type)
      const existing = await this.db
        .select()
        .from(entityEmbeddings)
        .where(
          and(
            eq(entityEmbeddings.entityName, data.entityName),
            eq(entityEmbeddings.entityType, data.entityType)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing: increment frequency and update last_seen
        const updated = await this.db
          .update(entityEmbeddings)
          .set({
            frequency: sql`${entityEmbeddings.frequency} + 1`,
            lastSeen: new Date(),
            embedding: Array.from(data.embedding),
            meta: data.meta || existing[0].meta,
            updatedAt: new Date(),
          })
          .where(eq(entityEmbeddings.id, existing[0].id))
          .returning();

        this.logger.debug('Updated entity embedding', {
          entityName: data.entityName,
          entityType: data.entityType,
          newFrequency: updated[0].frequency,
        });

        return this.mapToEntity(updated[0]);
      } else {
        // Insert new
        const inserted = await this.db
          .insert(entityEmbeddings)
          .values({
            entityName: data.entityName,
            entityType: data.entityType,
            embedding: Array.from(data.embedding),
            frequency: 1,
            meta: data.meta || {},
          })
          .returning();

        this.logger.debug('Inserted new entity embedding', {
          entityName: data.entityName,
          entityType: data.entityType,
        });

        return this.mapToEntity(inserted[0]);
      }
    } catch (error) {
      this.logger.error('Failed to upsert entity embedding', {
        entityName: data.entityName,
        entityType: data.entityType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Batch upsert multiple entity embeddings
   */
  async upsertBatch(
    dataList: CreateEntityEmbeddingData[]
  ): Promise<EntityEmbedding[]> {
    const results: EntityEmbedding[] = [];

    for (const data of dataList) {
      const result = await this.upsert(data);
      results.push(result);
    }

    this.logger.info('Batch upserted entity embeddings', {
      count: dataList.length,
    });

    return results;
  }

  /**
   * Get entity by name and type
   */
  async getByNameAndType(
    entityName: string,
    entityType: string
  ): Promise<EntityEmbedding | null> {
    const result = await this.db
      .select()
      .from(entityEmbeddings)
      .where(
        and(
          eq(entityEmbeddings.entityName, entityName),
          eq(entityEmbeddings.entityType, entityType)
        )
      )
      .limit(1);

    return result.length > 0 ? this.mapToEntity(result[0]) : null;
  }

  /**
   * Get top entities by frequency
   */
  async getTopByFrequency(
    limit: number = 20,
    minFrequency: number = 2,
    entityType?: string
  ): Promise<EntityEmbedding[]> {
    let query = this.db
      .select()
      .from(entityEmbeddings)
      .where(gte(entityEmbeddings.frequency, minFrequency));

    if (entityType) {
      query = query.where(eq(entityEmbeddings.entityType, entityType));
    }

    const results = await query
      .orderBy(desc(entityEmbeddings.frequency))
      .limit(limit);

    return results.map((r: any) => this.mapToEntity(r));
  }

  /**
   * Search entities by similarity (vector search)
   */
  async searchBySimilarity(
    queryEmbedding: Float32Array,
    limit: number = 10,
    minSimilarity: number = 0.5,
    entityType?: string
  ): Promise<Array<EntityEmbedding & { similarity: number }>> {
    const embeddingArray = Array.from(queryEmbedding);

    let query = sql`
      SELECT
        *,
        1 - (embedding <=> ${embeddingArray}::vector) as similarity
      FROM entity_embeddings
      WHERE 1 - (embedding <=> ${embeddingArray}::vector) >= ${minSimilarity}
    `;

    if (entityType) {
      query = sql`${query} AND entity_type = ${entityType}`;
    }

    query = sql`${query}
      ORDER BY embedding <=> ${embeddingArray}::vector
      LIMIT ${limit}
    `;

    const results = await this.pool.query(query.strings[0], query.values);

    return results.rows.map((row: any) => ({
      ...this.mapToEntity(row),
      similarity: parseFloat(row.similarity),
    }));
  }

  /**
   * Get entities by type
   */
  async getByType(
    entityType: string,
    limit: number = 50
  ): Promise<EntityEmbedding[]> {
    const results = await this.db
      .select()
      .from(entityEmbeddings)
      .where(eq(entityEmbeddings.entityType, entityType))
      .orderBy(desc(entityEmbeddings.frequency))
      .limit(limit);

    return results.map((r: any) => this.mapToEntity(r));
  }

  /**
   * Get all entity types with counts
   */
  async getEntityTypeCounts(): Promise<Array<{ type: string; count: number }>> {
    const query = sql`
      SELECT entity_type as type, COUNT(*) as count
      FROM entity_embeddings
      GROUP BY entity_type
      ORDER BY count DESC
    `;

    const results = await this.pool.query(query.strings[0]);

    return results.rows.map((row: any) => ({
      type: row.type,
      count: parseInt(row.count, 10),
    }));
  }

  /**
   * Map database row to EntityEmbedding
   */
  private mapToEntity(row: any): EntityEmbedding {
    return {
      id: row.id,
      entityName: row.entityName || row.entity_name,
      entityType: row.entityType || row.entity_type,
      embedding: row.embedding,
      frequency: row.frequency,
      firstSeen: new Date(row.firstSeen || row.first_seen),
      lastSeen: new Date(row.lastSeen || row.last_seen),
      meta: row.meta || {},
      createdAt: new Date(row.createdAt || row.created_at),
      updatedAt: new Date(row.updatedAt || row.updated_at),
    };
  }
}
