/**
 * Workflow Screenshot Repository Implementation
 *
 * Implements hybrid search (BM25 + vector similarity) for workflow screenshots.
 * Uses PostgreSQL's built-in full-text search (ts_rank) for BM25-style lexical search
 * and pgvector for semantic similarity search.
 */

import type { WorkflowScreenshot, WorkflowTagType } from '@journey/schema';
import { workflowScreenshots } from '@journey/schema';
import { eq, and, gte, lte, inArray, desc, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import type {
  CreateWorkflowScreenshotData,
  HybridSearchParams,
  HybridSearchResult,
  IWorkflowScreenshotRepository,
  UpdateWorkflowScreenshotData,
  WorkflowSequenceResult,
} from './interfaces';

export class WorkflowScreenshotRepository
  implements IWorkflowScreenshotRepository
{
  private pool: Pool;
  private db: any;

  constructor(pool: Pool, db?: any) {
    this.pool = pool;
    this.db = db || drizzle(pool);
  }

  /**
   * Create a new workflow screenshot
   */
  async createScreenshot(
    data: CreateWorkflowScreenshotData
  ): Promise<WorkflowScreenshot> {
    const result = await this.db
      .insert(workflowScreenshots)
      .values({
        userId: data.userId,
        nodeId: data.nodeId,
        sessionId: data.sessionId,
        screenshotPath: data.screenshotPath,
        cloudUrl: data.cloudUrl,
        timestamp: data.timestamp,
        workflowTag: data.workflowTag,
        summary: data.summary,
        analysis: data.analysis,
        embedding: Array.from(data.embedding),
        meta: data.meta,
      })
      .returning();

    return this.mapToWorkflowScreenshot(result[0]);
  }

  /**
   * Get screenshot by ID
   */
  async getScreenshotById(id: number): Promise<WorkflowScreenshot | null> {
    const result = await this.db
      .select()
      .from(workflowScreenshots)
      .where(eq(workflowScreenshots.id, id))
      .limit(1);

    return result.length > 0 ? this.mapToWorkflowScreenshot(result[0]) : null;
  }

  /**
   * Get screenshots by multiple IDs
   * Used for loading screenshots associated with blocks for step extraction
   */
  async getScreenshotsByIds(ids: number[]): Promise<WorkflowScreenshot[]> {
    if (ids.length === 0) {
      return [];
    }

    const results = await this.db
      .select()
      .from(workflowScreenshots)
      .where(inArray(workflowScreenshots.id, ids))
      .orderBy(desc(workflowScreenshots.timestamp));

    return results.map((r: any) => this.mapToWorkflowScreenshot(r));
  }

  /**
   * Get all screenshots for a node
   */
  async getScreenshotsByNode(
    userId: number,
    nodeId: string,
    options?: {
      limit?: number;
      offset?: number;
      workflowTags?: WorkflowTagType[];
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<WorkflowScreenshot[]> {
    const conditions = [
      eq(workflowScreenshots.userId, userId),
      eq(workflowScreenshots.nodeId, nodeId),
    ];

    if (options?.workflowTags && options.workflowTags.length > 0) {
      conditions.push(inArray(workflowScreenshots.workflowTag, options.workflowTags));
    }

    if (options?.startDate) {
      conditions.push(gte(workflowScreenshots.timestamp, options.startDate));
    }

    if (options?.endDate) {
      conditions.push(lte(workflowScreenshots.timestamp, options.endDate));
    }

    let query = this.db
      .select()
      .from(workflowScreenshots)
      .where(and(...conditions))
      .orderBy(desc(workflowScreenshots.timestamp));

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.offset(options.offset);
    }

    const results = await query;
    return results.map((r) => this.mapToWorkflowScreenshot(r));
  }

  /**
   * Get all screenshots for a session
   */
  async getScreenshotsBySession(
    userId: number,
    sessionId: string
  ): Promise<WorkflowScreenshot[]> {
    const results = await this.db
      .select()
      .from(workflowScreenshots)
      .where(
        and(
          eq(workflowScreenshots.userId, userId),
          eq(workflowScreenshots.sessionId, sessionId)
        )
      )
      .orderBy(desc(workflowScreenshots.timestamp));

    return results.map((r) => this.mapToWorkflowScreenshot(r));
  }

  /**
   * Update a screenshot
   */
  async updateScreenshot(
    id: number,
    data: UpdateWorkflowScreenshotData
  ): Promise<WorkflowScreenshot> {
    const updateData: any = {};

    if (data.summary !== undefined) updateData.summary = data.summary;
    if (data.analysis !== undefined) updateData.analysis = data.analysis;
    if (data.workflowTag !== undefined) updateData.workflowTag = data.workflowTag;
    if (data.cloudUrl !== undefined) updateData.cloudUrl = data.cloudUrl;
    if (data.meta !== undefined) updateData.meta = data.meta;
    if (data.embedding !== undefined) {
      updateData.embedding = Array.from(data.embedding);
    }

    updateData.updatedAt = new Date();

    const result = await this.db
      .update(workflowScreenshots)
      .set(updateData)
      .where(eq(workflowScreenshots.id, id))
      .returning();

    return this.mapToWorkflowScreenshot(result[0]);
  }

  /**
   * Delete a screenshot
   */
  async deleteScreenshot(id: number): Promise<void> {
    await this.db
      .delete(workflowScreenshots)
      .where(eq(workflowScreenshots.id, id));
  }

  /**
   * Hybrid search: Combines BM25 lexical search with vector similarity
   *
   * Algorithm:
   * 1. Perform lexical search using PostgreSQL's ts_rank (BM25-like scoring)
   * 2. Perform vector similarity search using cosine distance
   * 3. Normalize both scores to 0-1 range
   * 4. Combine using weighted average: final_score = (lexicalWeight * lexical_score) + ((1 - lexicalWeight) * semantic_score)
   * 5. Re-rank and return top results
   */
  async hybridSearch(params: HybridSearchParams): Promise<HybridSearchResult[]> {
    const {
      userId,
      queryText,
      queryEmbedding,
      nodeId,
      workflowTags,
      limit = 10,
      lexicalWeight = 0.5,
      similarityThreshold = 0.3,
      startDate,
      endDate,
    } = params;

    // Format embedding as pgvector string format: [x,y,z,...]
    const embeddingStr = `[${Array.from(queryEmbedding).join(',')}]`;

    // Build the hybrid search query
    const queryParams: any[] = [
      userId,
      queryText,
      embeddingStr,
    ];
    let paramIndex = 3;

    let whereConditions = 'ws.user_id = $1';

    if (nodeId) {
      paramIndex++;
      whereConditions += ` AND ws.node_id = $${paramIndex}`;
      queryParams.push(nodeId);
    }

    if (workflowTags && workflowTags.length > 0) {
      paramIndex++;
      whereConditions += ` AND ws.workflow_tag = ANY($${paramIndex}::varchar[])`;
      queryParams.push(workflowTags);
    }

    if (startDate) {
      paramIndex++;
      whereConditions += ` AND ws.timestamp >= $${paramIndex}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      paramIndex++;
      whereConditions += ` AND ws.timestamp <= $${paramIndex}`;
      queryParams.push(endDate);
    }

    // Hybrid search SQL query
    const query = `
      WITH
      -- Lexical search using PostgreSQL full-text search (BM25-like)
      lexical_results AS (
        SELECT
          ws.id,
          ts_rank(
            to_tsvector('english', COALESCE(ws.summary, '') || ' ' || COALESCE(ws.analysis, '')),
            plainto_tsquery('english', $2)
          ) as lexical_score,
          ts_headline(
            'english',
            COALESCE(ws.summary, ''),
            plainto_tsquery('english', $2),
            'MaxWords=50, MinWords=20'
          ) as highlighted_text
        FROM workflow_screenshots ws
        WHERE ${whereConditions}
          AND (
            to_tsvector('english', COALESCE(ws.summary, '') || ' ' || COALESCE(ws.analysis, ''))
            @@ plainto_tsquery('english', $2)
          )
      ),
      -- Vector similarity search
      semantic_results AS (
        SELECT
          ws.id,
          1 - (ws.embedding <=> $3::vector) as semantic_score
        FROM workflow_screenshots ws
        WHERE ${whereConditions}
          AND ws.embedding IS NOT NULL
        ORDER BY ws.embedding <=> $3::vector
        LIMIT ${limit * 3}  -- Get more candidates for better hybrid results
      ),
      -- Normalize scores to 0-1 range
      normalized_scores AS (
        SELECT
          COALESCE(lr.id, sr.id) as id,
          COALESCE(lr.lexical_score, 0) as raw_lexical_score,
          COALESCE(sr.semantic_score, 0) as raw_semantic_score,
          lr.highlighted_text,
          -- Normalize lexical score (ts_rank typically ranges 0-1 already)
          CASE
            WHEN MAX(COALESCE(lr.lexical_score, 0)) OVER () > 0
            THEN COALESCE(lr.lexical_score, 0) / MAX(COALESCE(lr.lexical_score, 0)) OVER ()
            ELSE 0
          END as norm_lexical_score,
          -- Normalize semantic score (cosine similarity is already 0-1)
          COALESCE(sr.semantic_score, 0) as norm_semantic_score
        FROM lexical_results lr
        FULL OUTER JOIN semantic_results sr ON lr.id = sr.id
      ),
      -- Calculate hybrid score with weights
      hybrid_scores AS (
        SELECT
          ns.id,
          ns.raw_lexical_score,
          ns.raw_semantic_score,
          ns.highlighted_text,
          ns.norm_lexical_score,
          ns.norm_semantic_score,
          -- Weighted hybrid score
          (${lexicalWeight} * ns.norm_lexical_score + ${1 - lexicalWeight} * ns.norm_semantic_score) as hybrid_score
        FROM normalized_scores ns
        WHERE ns.norm_semantic_score >= ${similarityThreshold}
          OR ns.norm_lexical_score > 0
      )
      -- Final join with full screenshot data
      SELECT
        ws.*,
        hs.hybrid_score,
        hs.raw_lexical_score as lexical_score,
        hs.raw_semantic_score as semantic_score,
        hs.highlighted_text
      FROM hybrid_scores hs
      JOIN workflow_screenshots ws ON ws.id = hs.id
      ORDER BY hs.hybrid_score DESC
      LIMIT ${limit}
    `;

    const result = await this.pool.query(query, queryParams);

    return result.rows.map((row) => ({
      screenshot: this.mapToWorkflowScreenshot(row),
      score: parseFloat(row.hybrid_score) || 0,
      lexicalScore: parseFloat(row.lexical_score) || undefined,
      semanticScore: parseFloat(row.semantic_score) || undefined,
      highlightedText: row.highlighted_text || undefined,
    }));
  }

  /**
   * Vector-only similarity search
   */
  async vectorSearch(
    userId: number,
    queryEmbedding: Float32Array,
    options?: {
      nodeId?: string;
      limit?: number;
      similarityThreshold?: number;
    }
  ): Promise<HybridSearchResult[]> {
    const limit = options?.limit || 10;
    const threshold = options?.similarityThreshold || 0.3;

    // Format embedding as pgvector string format: [x,y,z,...]
    const embeddingStr = `[${Array.from(queryEmbedding).join(',')}]`;

    const queryParams: any[] = [
      userId,
      embeddingStr,
      threshold,
      limit,
    ];

    let whereConditions = 'user_id = $1 AND embedding IS NOT NULL';

    if (options?.nodeId) {
      queryParams.push(options.nodeId);
      whereConditions += ` AND node_id = $${queryParams.length}`;
    }

    const query = `
      SELECT
        *,
        1 - (embedding <=> $2::vector) as similarity
      FROM workflow_screenshots
      WHERE ${whereConditions}
        AND (1 - (embedding <=> $2::vector)) >= $3
      ORDER BY embedding <=> $2::vector
      LIMIT $4
    `;

    const result = await this.pool.query(query, queryParams);

    return result.rows.map((row) => ({
      screenshot: this.mapToWorkflowScreenshot(row),
      score: parseFloat(row.similarity) || 0,
      semanticScore: parseFloat(row.similarity) || undefined,
    }));
  }

  /**
   * Lexical-only full-text search
   */
  async lexicalSearch(
    userId: number,
    queryText: string,
    options?: {
      nodeId?: string;
      limit?: number;
    }
  ): Promise<HybridSearchResult[]> {
    const limit = options?.limit || 10;

    const queryParams: any[] = [userId, queryText, limit];

    let whereConditions = 'user_id = $1';

    if (options?.nodeId) {
      queryParams.push(options.nodeId);
      whereConditions += ` AND node_id = $${queryParams.length}`;
    }

    const query = `
      SELECT
        *,
        ts_rank(
          to_tsvector('english', COALESCE(summary, '') || ' ' || COALESCE(analysis, '')),
          plainto_tsquery('english', $2)
        ) as rank,
        ts_headline(
          'english',
          COALESCE(summary, ''),
          plainto_tsquery('english', $2),
          'MaxWords=50, MinWords=20'
        ) as highlighted_text
      FROM workflow_screenshots
      WHERE ${whereConditions}
        AND to_tsvector('english', COALESCE(summary, '') || ' ' || COALESCE(analysis, ''))
            @@ plainto_tsquery('english', $2)
      ORDER BY rank DESC
      LIMIT $3
    `;

    const result = await this.pool.query(query, queryParams);

    return result.rows.map((row) => ({
      screenshot: this.mapToWorkflowScreenshot(row),
      score: parseFloat(row.rank) || 0,
      lexicalScore: parseFloat(row.rank) || undefined,
      highlightedText: row.highlighted_text || undefined,
    }));
  }

  /**
   * Get workflow distribution for a node
   */
  async getWorkflowDistribution(
    userId: number,
    nodeId: string
  ): Promise<
    Array<{
      workflowTag: WorkflowTagType;
      count: number;
    }>
  > {
    const query = `
      SELECT
        workflow_tag,
        COUNT(*) as count
      FROM workflow_screenshots
      WHERE user_id = $1 AND node_id = $2
      GROUP BY workflow_tag
      ORDER BY count DESC
    `;

    const result = await this.pool.query(query, [userId, nodeId]);

    return result.rows.map((row) => ({
      workflowTag: row.workflow_tag as WorkflowTagType,
      count: parseInt(row.count, 10),
    }));
  }

  /**
   * Batch create screenshots for efficient ingestion
   */
  async batchCreateScreenshots(
    data: CreateWorkflowScreenshotData[]
  ): Promise<WorkflowScreenshot[]> {
    if (data.length === 0) {
      return [];
    }

    const values = data.map((item) => ({
      userId: item.userId,
      nodeId: item.nodeId,
      sessionId: item.sessionId,
      screenshotPath: item.screenshotPath,
      cloudUrl: item.cloudUrl,
      timestamp: item.timestamp,
      workflowTag: item.workflowTag,
      summary: item.summary,
      analysis: item.analysis,
      embedding: Array.from(item.embedding),
      meta: item.meta,
    }));

    const result = await this.db
      .insert(workflowScreenshots)
      .values(values)
      .returning();

    return result.map((r) => this.mapToWorkflowScreenshot(r));
  }

  /**
   * Get workflow sequences (transitions between workflow tags)
   * Used for identifying top/repeated workflow patterns
   */
  async getWorkflowSequences(
    userId: number,
    options?: {
      nodeId?: string;
      minOccurrences?: number;
      lookbackDays?: number;
      limit?: number;
    }
  ): Promise<WorkflowSequenceResult[]> {
    const minOccurrences = options?.minOccurrences || 2;
    const lookbackDays = options?.lookbackDays || 30;
    const limit = options?.limit || 10;

    const queryParams: any[] = [userId, lookbackDays, minOccurrences, limit];
    let paramIndex = 4;

    let whereConditions = 'user_id = $1 AND timestamp >= NOW() - ($2 || \' days\')::INTERVAL';

    if (options?.nodeId) {
      paramIndex++;
      whereConditions += ` AND node_id = $${paramIndex}`;
      queryParams.push(options.nodeId);
    }

    // This query identifies sequences of workflow tags using window functions
    // It groups consecutive screenshots by session and identifies transition patterns
    const query = `
      WITH ordered_screenshots AS (
        SELECT
          id,
          session_id,
          workflow_tag,
          timestamp,
          LEAD(workflow_tag) OVER (PARTITION BY session_id ORDER BY timestamp) as next_tag,
          LEAD(timestamp) OVER (PARTITION BY session_id ORDER BY timestamp) as next_timestamp
        FROM workflow_screenshots
        WHERE ${whereConditions}
      ),
      transitions AS (
        SELECT
          session_id,
          workflow_tag as from_tag,
          next_tag as to_tag,
          EXTRACT(EPOCH FROM (next_timestamp - timestamp)) as duration_seconds,
          id as screenshot_id
        FROM ordered_screenshots
        WHERE next_tag IS NOT NULL
          AND workflow_tag != next_tag  -- Only count actual transitions
      ),
      -- Group transitions into 3-step sequences
      sequences AS (
        SELECT
          t1.from_tag || '→' || t1.to_tag || '→' || t2.to_tag as sequence_str,
          ARRAY[t1.from_tag, t1.to_tag, t2.to_tag] as sequence_array,
          t1.session_id,
          t1.duration_seconds + COALESCE(t2.duration_seconds, 0) as total_duration,
          ARRAY[t1.screenshot_id, t2.screenshot_id] as screenshot_ids
        FROM transitions t1
        LEFT JOIN transitions t2 ON t1.session_id = t2.session_id
          AND t1.to_tag = t2.from_tag
          AND t2.screenshot_id > t1.screenshot_id
        WHERE t2.to_tag IS NOT NULL
      )
      SELECT
        sequence_array as sequence,
        COUNT(*) as occurrence_count,
        AVG(total_duration) as avg_duration_seconds,
        array_agg(DISTINCT screenshot_ids[1]) as sample_screenshot_ids,
        array_agg(DISTINCT session_id) as sessions
      FROM sequences
      GROUP BY sequence_array
      HAVING COUNT(*) >= $3
      ORDER BY COUNT(*) DESC
      LIMIT $4
    `;

    const result = await this.pool.query(query, queryParams);

    return result.rows.map((row) => ({
      sequence: row.sequence as WorkflowTagType[],
      occurrenceCount: parseInt(row.occurrence_count, 10),
      avgDurationSeconds: parseFloat(row.avg_duration_seconds) || 0,
      sampleScreenshotIds: row.sample_screenshot_ids || [],
      sessions: row.sessions || [],
    }));
  }

  /**
   * Get all screenshots for a user with optional filters
   */
  async getAllScreenshots(
    userId: number,
    options?: {
      nodeId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<WorkflowScreenshot[]> {
    const conditions = [eq(workflowScreenshots.userId, userId)];

    if (options?.nodeId) {
      conditions.push(eq(workflowScreenshots.nodeId, options.nodeId));
    }

    if (options?.startDate) {
      conditions.push(gte(workflowScreenshots.timestamp, options.startDate));
    }

    if (options?.endDate) {
      conditions.push(lte(workflowScreenshots.timestamp, options.endDate));
    }

    let query = this.db
      .select()
      .from(workflowScreenshots)
      .where(and(...conditions))
      .orderBy(desc(workflowScreenshots.timestamp));

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const results = await query;
    return results.map((r: any) => this.mapToWorkflowScreenshot(r));
  }

  /**
   * Map database row to WorkflowScreenshot type
   */
  private mapToWorkflowScreenshot(row: any): WorkflowScreenshot {
    return {
      id: row.id,
      userId: row.userId || row.user_id,
      nodeId: row.nodeId || row.node_id,
      sessionId: row.sessionId || row.session_id,
      screenshotPath: row.screenshotPath || row.screenshot_path,
      cloudUrl: row.cloudUrl || row.cloud_url,
      timestamp: (row.timestamp instanceof Date ? row.timestamp : new Date(row.timestamp)).toISOString(),
      workflowTag: (row.workflowTag || row.workflow_tag) as WorkflowTagType,
      summary: row.summary,
      analysis: row.analysis,
      meta: row.meta || {},
      createdAt: (row.createdAt || row.created_at instanceof Date
        ? row.createdAt || row.created_at
        : new Date(row.createdAt || row.created_at)
      ).toISOString(),
      updatedAt: (row.updatedAt || row.updated_at instanceof Date
        ? row.updatedAt || row.updated_at
        : new Date(row.updatedAt || row.updated_at)
      ).toISOString(),
    };
  }
}
