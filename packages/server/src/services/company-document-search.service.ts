/**
 * Company Document Search Service
 *
 * Provides vector similarity search and GraphRAG expansion over company documents.
 * Uses cosine similarity via pgvector for initial retrieval and graph expansion
 * for context-aware results.
 */

import type { Logger } from '../core/logger.js';
import type { EmbeddingService } from './interfaces/embedding.service.interface.js';
import type { CompanyDocumentRepository } from '../repositories/company-document.repository.js';
import type { Pool } from 'pg';

// ============================================================================
// TYPES
// ============================================================================

export interface CompanyDocSearchResult {
  chunkId: number;
  documentId: number;
  chunkText: string;
  pageNumber?: number;
  sectionTitle?: string;
  filename?: string;
  similarity: number;
  graphScore?: number;
  combinedScore: number;
}

export interface SearchOptions {
  limit?: number;
  minSimilarity?: number;
  useGraphExpansion?: boolean;
  graphDepth?: number;
}

export interface CompanyDocumentSearchServiceDeps {
  logger: Logger;
  embeddingService: EmbeddingService;
  companyDocumentRepository: CompanyDocumentRepository;
  pool: Pool;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_LIMIT = 10;
const DEFAULT_MIN_SIMILARITY = 0.3;
const DEFAULT_GRAPH_DEPTH = 2;

// Scoring weights for combined score
const VECTOR_WEIGHT = 0.7;
const GRAPH_WEIGHT = 0.3;

// ============================================================================
// SERVICE
// ============================================================================

export class CompanyDocumentSearchService {
  private readonly logger: Logger;
  private readonly embeddingService: EmbeddingService;
  private readonly companyDocRepository: CompanyDocumentRepository;
  private readonly pool: Pool;

  constructor(deps: CompanyDocumentSearchServiceDeps) {
    this.logger = deps.logger;
    this.embeddingService = deps.embeddingService;
    this.companyDocRepository = deps.companyDocumentRepository;
    this.pool = deps.pool;
  }

  /**
   * Search company documents using vector similarity
   */
  async searchDocuments(
    userId: number,
    query: string,
    options: SearchOptions = {}
  ): Promise<CompanyDocSearchResult[]> {
    const {
      limit = DEFAULT_LIMIT,
      minSimilarity = DEFAULT_MIN_SIMILARITY,
    } = options;

    this.logger.info('Searching company documents', {
      userId,
      query: query.substring(0, 100),
      limit,
    });

    // Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);
    const embeddingStr = `[${Array.from(queryEmbedding).join(',')}]`;

    // Vector search with company_document filter
    const result = await this.pool.query<{
      id: number;
      chunk_text: string;
      meta: any;
      similarity: number;
    }>(
      `SELECT
        id,
        chunk_text,
        meta,
        1 - (embedding <=> $1::vector) as similarity
      FROM graphrag_chunks
      WHERE node_type = 'company_document'
        AND user_id = $2
        AND 1 - (embedding <=> $1::vector) >= $3
      ORDER BY embedding <=> $1::vector
      LIMIT $4`,
      [embeddingStr, userId, minSimilarity, limit]
    );

    const results: CompanyDocSearchResult[] = result.rows.map((row) => ({
      chunkId: row.id,
      documentId: row.meta?.documentId,
      chunkText: row.chunk_text,
      pageNumber: row.meta?.pageNumber,
      sectionTitle: row.meta?.sectionTitle,
      filename: row.meta?.filename,
      similarity: row.similarity,
      combinedScore: row.similarity,
    }));

    this.logger.info('Document search completed', {
      userId,
      resultCount: results.length,
    });

    return results;
  }

  /**
   * Search with graph expansion for better context
   */
  async graphExpansionSearch(
    userId: number,
    query: string,
    options: SearchOptions = {}
  ): Promise<CompanyDocSearchResult[]> {
    const {
      limit = DEFAULT_LIMIT,
      minSimilarity = DEFAULT_MIN_SIMILARITY,
      graphDepth = DEFAULT_GRAPH_DEPTH,
    } = options;

    this.logger.info('Graph expansion search', {
      userId,
      query: query.substring(0, 100),
      limit,
      graphDepth,
    });

    // Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);
    const embeddingStr = `[${Array.from(queryEmbedding).join(',')}]`;

    // First, get seed results via vector search
    const seedLimit = Math.ceil(limit / 2);
    const seedResults = await this.pool.query<{
      id: number;
      chunk_text: string;
      meta: any;
      similarity: number;
    }>(
      `SELECT
        id,
        chunk_text,
        meta,
        1 - (embedding <=> $1::vector) as similarity
      FROM graphrag_chunks
      WHERE node_type = 'company_document'
        AND user_id = $2
        AND 1 - (embedding <=> $1::vector) >= $3
      ORDER BY embedding <=> $1::vector
      LIMIT $4`,
      [embeddingStr, userId, minSimilarity, seedLimit]
    );

    if (seedResults.rows.length === 0) {
      this.logger.info('No seed results found');
      return [];
    }

    const seedChunkIds = seedResults.rows.map((r) => r.id);
    const seedSimilarities = new Map(
      seedResults.rows.map((r) => [r.id, r.similarity])
    );

    // Graph expansion using recursive CTE
    const expandedResults = await this.pool.query<{
      id: number;
      chunk_text: string;
      meta: any;
      similarity: number;
      graph_score: number;
      depth: number;
    }>(
      `WITH RECURSIVE expansion AS (
        -- Seed chunks
        SELECT
          gc.id,
          gc.chunk_text,
          gc.meta,
          1 - (gc.embedding <=> $1::vector) as similarity,
          1.0 as path_weight,
          0 as depth
        FROM graphrag_chunks gc
        WHERE gc.id = ANY($2)

        UNION ALL

        -- Expand to neighbors
        SELECT
          neighbor.id,
          neighbor.chunk_text,
          neighbor.meta,
          1 - (neighbor.embedding <=> $1::vector) as similarity,
          e.path_weight * ge.weight as path_weight,
          e.depth + 1
        FROM expansion e
        JOIN graphrag_edges ge ON (
          ge.src_chunk_id = e.id OR
          (ge.dst_chunk_id = e.id AND NOT ge.directed)
        )
        JOIN graphrag_chunks neighbor ON (
          neighbor.id = CASE
            WHEN ge.src_chunk_id = e.id THEN ge.dst_chunk_id
            ELSE ge.src_chunk_id
          END
        )
        WHERE e.depth < $3
          AND neighbor.node_type = 'company_document'
          AND neighbor.user_id = $4
      )
      SELECT DISTINCT ON (id)
        id,
        chunk_text,
        meta,
        similarity,
        path_weight as graph_score,
        depth
      FROM expansion
      ORDER BY id, (${VECTOR_WEIGHT} * similarity + ${GRAPH_WEIGHT} * path_weight) DESC
      LIMIT $5`,
      [embeddingStr, seedChunkIds, graphDepth, userId, limit]
    );

    // Combine and score results
    const results: CompanyDocSearchResult[] = expandedResults.rows.map((row) => {
      const vectorScore = row.similarity;
      const graphScore = row.graph_score;
      const combinedScore = VECTOR_WEIGHT * vectorScore + GRAPH_WEIGHT * graphScore;

      return {
        chunkId: row.id,
        documentId: row.meta?.documentId,
        chunkText: row.chunk_text,
        pageNumber: row.meta?.pageNumber,
        sectionTitle: row.meta?.sectionTitle,
        filename: row.meta?.filename,
        similarity: vectorScore,
        graphScore,
        combinedScore,
      };
    });

    // Sort by combined score
    results.sort((a, b) => b.combinedScore - a.combinedScore);

    this.logger.info('Graph expansion search completed', {
      userId,
      seedCount: seedResults.rows.length,
      expandedCount: results.length,
    });

    return results.slice(0, limit);
  }

  /**
   * Get all documents for a user (metadata only)
   */
  async getUserDocuments(userId: number) {
    return this.companyDocRepository.findByUserId(userId);
  }

  /**
   * Check if user has any company documents
   */
  async hasDocuments(userId: number): Promise<boolean> {
    const stats = await this.companyDocRepository.getStats(userId);
    return stats.totalDocuments > 0 && stats.processingCounts.completed > 0;
  }

  /**
   * Get document statistics for a user
   */
  async getDocumentStats(userId: number) {
    return this.companyDocRepository.getStats(userId);
  }
}
