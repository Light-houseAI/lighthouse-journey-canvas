/**
 * PgVector GraphRAG Repository Implementation
 *
 * Implements vector search, graph expansion, and combined scoring
 * for the pgvector-based GraphRAG system
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import type {
  CreateChunkData,
  CreateEdgeData,
  GraphExpansionResult,
  GraphRAGChunk,
  GraphRAGEdge,
  GraphRAGSearchOptions,
  IPgVectorGraphRAGRepository,
  ScoringWeights,
} from '../types/graphrag.types.js';
import { buildPermissionCTEForSearch } from './sql/permission-cte';

export class PgVectorGraphRAGRepository implements IPgVectorGraphRAGRepository {
  private pool: Pool;
  private db: any;

  constructor(pool: Pool, db?: any) {
    this.pool = pool;
    this.db = db || drizzle(pool);
  }

  /**
   * Vector similarity search using pgvector with permission filtering
   */
  async vectorSearch(
    embedding: Float32Array,
    options: GraphRAGSearchOptions
  ): Promise<GraphRAGChunk[]> {
    const {
      limit,
      tenantId = 'default',
      since,
      excludeUserId,
      requestingUserId,
    } = options;

    // Build the query with permission filtering if requesting user is provided
    let query: string;
    const params: any[] = [`[${Array.from(embedding).join(',')}]`, tenantId];
    let paramCount = 2;

    if (requestingUserId) {
      // Include permission filtering using shared CTE logic
      const permissionCTE = buildPermissionCTEForSearch(
        requestingUserId,
        'view'
      );
      query = `
        ${permissionCTE}
        SELECT
          gc.id,
          gc.user_id,
          gc.node_id,
          gc.chunk_text,
          gc.embedding::text as embedding,
          gc.node_type,
          gc.meta,
          gc.tenant_id,
          gc.created_at,
          gc.updated_at,
          1 - (gc.embedding <=> $1::vector) as similarity
        FROM graphrag_chunks gc
        LEFT JOIN authorized_nodes an ON an.node_id = gc.node_id
        WHERE gc.tenant_id = $2
          AND (
            gc.node_id IS NULL
            OR an.node_id IS NOT NULL
            OR gc.user_id = ${requestingUserId}
          )
      `;
    } else {
      // Original query without permission filtering
      query = `
        SELECT
          id,
          user_id,
          node_id,
          chunk_text,
          embedding::text as embedding,
          node_type,
          meta,
          tenant_id,
          created_at,
          updated_at,
          1 - (embedding <=> $1::vector) as similarity
        FROM graphrag_chunks
        WHERE tenant_id = $2
      `;
    }

    // Add recency filter if provided
    if (since) {
      paramCount++;
      query += ` AND updated_at >= $${paramCount}`;
      params.push(since);
    }

    // Exclude specific user if provided
    if (excludeUserId) {
      paramCount++;
      query += ` AND user_id != $${paramCount}`;
      params.push(excludeUserId);
    }

    // Order by similarity and limit
    paramCount++;
    query += ` ORDER BY embedding <=> $1::vector LIMIT $${paramCount}`;
    params.push(limit);

    const result = await this.pool.query(query, params);

    return result.rows.map((row) => ({
      ...row,
      embedding: row.embedding, // Keep as string for now
      similarity: parseFloat(row.similarity),
    }));
  }

  /**
   * Graph expansion using recursive CTEs
   */
  async graphExpansion(
    seedChunkIds: string[],
    seedSimilarities: number[],
    options: { maxDepth: number; tenantId?: string }
  ): Promise<GraphExpansionResult[]> {
    const { maxDepth } = options;

    // Build recursive CTE for k-hop expansion
    const query = `
      WITH RECURSIVE expansion AS (
        -- Base case: seed chunks
        SELECT
          unnest($1::bigint[]) as chunk_id,
          (unnest($2::float[]))::double precision as best_seed_sim,
          1.0::double precision as best_path_w,
          0::integer as depth

        UNION ALL

        -- Recursive case: expand to neighbors
        SELECT
          CASE
            WHEN e.directed THEN e.dst_chunk_id
            ELSE COALESCE(e.dst_chunk_id, e.src_chunk_id)
          END as chunk_id,
          exp.best_seed_sim::double precision,
          (exp.best_path_w * e.weight::double precision)::double precision as best_path_w,
          (exp.depth + 1)::integer
        FROM expansion exp
        JOIN graphrag_edges e ON (
          (e.src_chunk_id = exp.chunk_id AND e.directed = true) OR
          ((e.src_chunk_id = exp.chunk_id OR e.dst_chunk_id = exp.chunk_id) AND e.directed = false)
        )
        WHERE exp.depth < $3
      )
      SELECT DISTINCT ON (chunk_id)
        chunk_id,
        best_seed_sim,
        best_path_w,
        (0.7::double precision * best_seed_sim + 0.3::double precision * best_path_w) as graph_aware_score
      FROM expansion
      WHERE chunk_id NOT IN (SELECT unnest($1::bigint[]))
      ORDER BY chunk_id, graph_aware_score DESC
    `;

    const result = await this.pool.query(query, [
      seedChunkIds,
      seedSimilarities,
      maxDepth,
    ]);

    return result.rows.map((row) => ({
      chunk_id: row.chunk_id,
      best_seed_sim: parseFloat(row.best_seed_sim),
      best_path_w: parseFloat(row.best_path_w),
      graph_aware_score: parseFloat(row.graph_aware_score),
    }));
  }

  /**
   * Combined scoring with vector, graph, and recency
   */
  async combinedScoring(
    candidateIds: string[],
    vectorScores: Map<string, number>,
    graphScores: Map<string, number>,
    weights: ScoringWeights = {
      vectorSimilarity: 0.6,
      graphDistance: 0.3,
      recency: 0.1,
    }
  ): Promise<GraphRAGChunk[]> {
    if (candidateIds.length === 0) {
      return [];
    }

    // Build dynamic scoring query
    const query = `
      SELECT
        c.*,
        (
          $2 * COALESCE($3::jsonb->>(c.id::text), '0')::float +
          $4 * COALESCE($5::jsonb->>(c.id::text), '0')::float +
          $6 * EXTRACT(EPOCH FROM (NOW() - c.updated_at)) / (30 * 24 * 3600)
        ) as final_score
      FROM graphrag_chunks c
      WHERE c.id = ANY($1::bigint[])
      ORDER BY final_score DESC, c.id
    `;

    // Convert maps to JSON objects for PostgreSQL
    const vectorScoresJson = Object.fromEntries(
      candidateIds.map((id) => [id, vectorScores.get(id) || 0])
    );
    const graphScoresJson = Object.fromEntries(
      candidateIds.map((id) => [id, graphScores.get(id) || 0])
    );

    const result = await this.pool.query(query, [
      candidateIds,
      weights.vectorSimilarity,
      JSON.stringify(vectorScoresJson),
      weights.graphDistance,
      JSON.stringify(graphScoresJson),
      weights.recency,
    ]);

    return result.rows.map((row) => ({
      ...row,
      final_score: parseFloat(row.final_score),
    }));
  }

  /**
   * Create a new chunk
   */
  async createChunk(data: CreateChunkData): Promise<GraphRAGChunk> {
    const now = new Date();

    const query = `
      INSERT INTO graphrag_chunks (
        user_id, node_id, chunk_text,
        embedding, node_type, meta, tenant_id,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3,
        $4::vector, $5, $6, $7,
        $8, $9
      ) RETURNING *
    `;

    const result = await this.pool.query(query, [
      data.userId,
      data.nodeId || null,
      data.chunkText,
      `[${Array.from(data.embedding).join(',')}]`,
      data.nodeType || null,
      JSON.stringify(data.meta || {}),
      data.tenantId || 'default',
      now,
      now,
    ]);

    return result.rows[0];
  }

  /**
   * Create an edge between chunks
   */
  async createEdge(data: CreateEdgeData): Promise<GraphRAGEdge> {
    const now = new Date();

    const query = `
      INSERT INTO graphrag_edges (
        src_chunk_id, dst_chunk_id, rel_type,
        weight, directed, meta, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7
      ) RETURNING *
    `;

    const result = await this.pool.query(query, [
      data.srcChunkId,
      data.dstChunkId,
      data.relType,
      data.weight || 1.0,
      data.directed !== false, // Default to true
      JSON.stringify((data as any).meta || {}),
      now,
    ]);

    return result.rows[0];
  }

  /**
   * Get chunks by node ID
   */
  async getChunksByNodeId(nodeId: string): Promise<GraphRAGChunk[]> {
    const query = `
      SELECT * FROM graphrag_chunks
      WHERE node_id = $1
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [nodeId]);
    return result.rows;
  }

  /**
   * Get chunks by user ID
   */
  async getChunksByUserId(userId: number): Promise<GraphRAGChunk[]> {
    const query = `
      SELECT * FROM graphrag_chunks
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [userId]);
    return result.rows;
  }
}
