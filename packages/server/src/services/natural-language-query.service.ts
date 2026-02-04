/**
 * Natural Language Query Service
 *
 * Provides a RAG (Retrieval-Augmented Generation) pipeline for natural language queries:
 * 1. Embed the user's natural language query using OpenAI embeddings
 * 2. Retrieve relevant nodes and relationships from ArangoDB using AQL
 * 3. Perform cosine similarity search over pgvector for semantic matching
 * 4. Aggregate and rank results from both sources
 * 5. Send top results to LLM with original query to generate contextual response
 */

import { z } from 'zod';
import type { Pool } from 'pg';
import type { Logger } from '../core/logger.js';
import type { LLMProvider } from '../core/llm-provider.js';
import type { ArangoDBGraphService } from './arangodb-graph.service.js';
import type { HelixGraphService } from './helix-graph.service.js';
import type { EmbeddingService } from './interfaces/index.js';

// Generic graph service type - supports both ArangoDB and Helix implementations
type GraphService = ArangoDBGraphService | HelixGraphService;
import type { IWorkflowScreenshotRepository } from '../repositories/interfaces/workflow-screenshot.repository.interface.js';
import { createTracer } from '../core/langfuse.js';
import type {
  NaturalLanguageQueryRequest,
  RetrievedSource,
} from '@journey/schema';

/**
 * Response from natural language query
 */
export interface NaturalLanguageQueryResult {
  query: string;
  answer: string;
  confidence: number;
  sources: RetrievedSource[];
  relatedWorkSessions?: Array<{
    sessionId: string;
    name: string;
    summary?: string;
    timestamp: string;
    relevanceScore: number;
  }>;
  suggestedFollowUps?: string[];
  retrievalMetadata: {
    graphQueryTimeMs: number;
    vectorQueryTimeMs: number;
    llmGenerationTimeMs: number;
    totalTimeMs: number;
    sourcesRetrieved: number;
    tokensUsed?: number;
  };
}

/**
 * Service dependencies
 * Property names must match the Awilix container token camelCase names
 */
export interface NaturalLanguageQueryServiceDeps {
  logger: Logger;
  llmProvider: LLMProvider;
  openAIEmbeddingService: EmbeddingService;
  graphService?: GraphService;
  workflowScreenshotRepository?: IWorkflowScreenshotRepository;
  pool?: Pool; // For company document retrieval from graphrag_chunks
}

/**
 * LLM response schema for natural language query
 * Note: All fields must be required for OpenAI structured output compatibility
 */
const LLMResponseSchema = z.object({
  answer: z.string().describe('A comprehensive answer to the user query based on the provided context'),
  confidence: z.number().min(0).max(1).describe('Confidence score for the answer (0-1)'),
  suggestedFollowUps: z.array(z.string()).max(3).describe('Up to 3 suggested follow-up questions (can be empty array)'),
  keySourceIds: z.array(z.string()).describe('IDs of the most relevant sources used (can be empty array)'),
});

type LLMResponse = z.infer<typeof LLMResponseSchema>;

/**
 * Natural Language Query Service
 */
export class NaturalLanguageQueryService {
  private logger: Logger;
  private llmProvider: LLMProvider;
  private embeddingService: EmbeddingService;
  private graphService?: GraphService;
  private screenshotRepository?: IWorkflowScreenshotRepository;
  private pool?: Pool;
  private enableCrossSessionContext: boolean;

  constructor(deps: NaturalLanguageQueryServiceDeps) {
    this.logger = deps.logger;
    this.llmProvider = deps.llmProvider;
    this.embeddingService = deps.openAIEmbeddingService;
    this.graphService = deps.graphService;
    this.screenshotRepository = deps.workflowScreenshotRepository;
    this.pool = deps.pool;
    this.enableCrossSessionContext = process.env.ENABLE_CROSS_SESSION_CONTEXT === 'true';
  }

  /**
   * Check if a user has any indexed company documents
   * Used to skip A4-Company agent when no documents are available
   */
  async hasCompanyDocuments(userId: number): Promise<boolean> {
    if (!this.pool) {
      return false;
    }

    try {
      const result = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM graphrag_chunks
         WHERE user_id = $1 AND node_type = 'company_document'
         LIMIT 1`,
        [userId]
      );
      const count = parseInt(result.rows[0]?.count || '0', 10);
      return count > 0;
    } catch (error) {
      this.logger.warn('Failed to check company documents', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Process a natural language query using RAG pipeline
   */
  async query(
    userId: number,
    request: NaturalLanguageQueryRequest
  ): Promise<NaturalLanguageQueryResult> {
    const startTime = Date.now();

    // Create Langfuse trace
    const tracer = createTracer();
    tracer.startTrace({
      name: 'natural-language-query',
      userId: String(userId),
      input: {
        query: request.query,
        nodeId: request.nodeId,
        lookbackDays: request.lookbackDays,
      },
      metadata: {
        maxResults: request.maxResults,
        includeGraph: request.includeGraph,
        includeVectors: request.includeVectors,
      },
      tags: ['rag', 'natural-language', 'query'],
    });

    this.logger.info('Processing natural language query', {
      userId,
      query: request.query,
      nodeId: request.nodeId,
    });

    let graphQueryTimeMs = 0;
    let vectorQueryTimeMs = 0;
    let llmGenerationTimeMs = 0;

    try {
      // Step 1: Generate embedding for the query
      const embeddingStart = Date.now();
      const queryEmbedding = await this.embeddingService.generateEmbedding(request.query);
      vectorQueryTimeMs = Date.now() - embeddingStart;

      // Convert Float32Array to number[] for retrieval methods
      const queryEmbeddingArray = Array.from(queryEmbedding);

      // Step 2 & 3: Retrieve context from graph and vector databases in parallel
      // This includes:
      // - AQL-based text search in ArangoDB (converts query to AQL patterns)
      // - Graph structure traversal for related entities/concepts
      // - Screenshot vector search (user's track-specific, session-specific)
      // - Company document vector search (user's uploaded documents)
      const [graphContext, aqlSearchContext, screenshotContext, companyDocContext] = await Promise.all([
        this.retrieveGraphContext(userId, request, queryEmbeddingArray),
        this.retrieveAqlSearchContext(userId, request),
        this.retrieveScreenshotContext(userId, request, queryEmbeddingArray),
        this.retrieveCompanyDocContext(userId, request, queryEmbeddingArray),
      ]);

      graphQueryTimeMs = graphContext.queryTimeMs + aqlSearchContext.queryTimeMs;
      vectorQueryTimeMs = Math.max(vectorQueryTimeMs, screenshotContext.queryTimeMs, companyDocContext.queryTimeMs);

      // Step 4: Aggregate and rank results from all retrieval methods
      // Combines: Graph traversal + AQL text search + screenshot vectors + company documents
      const aggregatedSources = this.aggregateAndRankSources(
        graphContext.sources,
        aqlSearchContext.sources,
        screenshotContext.sources,
        companyDocContext.sources,
        request.maxResults
      );

      // Extract related work sessions from all sources
      const relatedWorkSessions = this.extractWorkSessions(
        graphContext.sessions,
        aqlSearchContext.sessions,
        screenshotContext.sessions
      );

      // Step 5: Generate LLM response
      const llmStart = Date.now();
      const llmResponse = await this.generateLLMResponse(
        request.query,
        aggregatedSources,
        relatedWorkSessions
      );
      llmGenerationTimeMs = Date.now() - llmStart;

      const totalTimeMs = Date.now() - startTime;

      // Build result
      const result: NaturalLanguageQueryResult = {
        query: request.query,
        answer: llmResponse.answer,
        confidence: llmResponse.confidence,
        sources: aggregatedSources,
        relatedWorkSessions: relatedWorkSessions.slice(0, 5),
        suggestedFollowUps: llmResponse.suggestedFollowUps,
        retrievalMetadata: {
          graphQueryTimeMs,
          vectorQueryTimeMs,
          llmGenerationTimeMs,
          totalTimeMs,
          sourcesRetrieved: aggregatedSources.length,
        },
      };

      // End Langfuse trace
      tracer.endTrace({
        success: true,
        sourcesRetrieved: aggregatedSources.length,
        confidence: llmResponse.confidence,
        totalTimeMs,
      });

      this.logger.info('Natural language query completed', {
        userId,
        sourcesRetrieved: aggregatedSources.length,
        confidence: llmResponse.confidence,
        totalTimeMs,
      });

      return result;
    } catch (error) {
      tracer.endTrace({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });

      this.logger.error(
        'Natural language query failed',
        error instanceof Error ? error : new Error(String(error)),
        { userId, query: request.query }
      );
      throw error;
    }
  }

  /**
   * Retrieve context from ArangoDB graph database
   */
  private async retrieveGraphContext(
    userId: number,
    request: NaturalLanguageQueryRequest,
    _queryEmbedding: number[]
  ): Promise<{
    sources: RetrievedSource[];
    sessions: Array<{ sessionId: string; name: string; summary?: string; timestamp: string; relevanceScore: number }>;
    queryTimeMs: number;
  }> {
    const startTime = Date.now();
    const sources: RetrievedSource[] = [];
    const sessions: Array<{ sessionId: string; name: string; summary?: string; timestamp: string; relevanceScore: number }> = [];

    if (!this.graphService || !request.includeGraph || !this.enableCrossSessionContext) {
      return { sources, sessions, queryTimeMs: 0 };
    }

    try {
      // Get cross-session context from graph
      // Note: nodeId is a UUID string, pass it directly (don't convert to Number which would result in NaN)
      const context = await this.graphService.getCrossSessionContext(
        userId,
        request.nodeId || userId,
        request.lookbackDays
      );

      // Convert entities to sources
      for (const entity of context.entities || []) {
        sources.push({
          id: `entity_${entity.name}`,
          type: 'entity',
          title: entity.name,
          description: `${entity.type} entity with ${entity.frequency || 0} occurrences`,
          relevanceScore: 0.7,
          metadata: { entityType: entity.type, frequency: entity.frequency },
        });
      }

      // Convert concepts to sources
      for (const concept of context.concepts || []) {
        sources.push({
          id: `concept_${concept.name}`,
          type: 'concept',
          title: concept.name,
          description: `${concept.category || 'general'} concept`,
          relevanceScore: 0.65,
          metadata: { category: concept.category, frequency: concept.frequency },
        });
      }

      // Convert workflow patterns to sources
      for (const pattern of context.workflowPatterns || []) {
        sources.push({
          id: `pattern_${pattern.transition}`,
          type: 'workflow_pattern',
          title: pattern.transition,
          description: `Workflow pattern with ${pattern.frequency} occurrences`,
          relevanceScore: 0.6,
          metadata: { frequency: pattern.frequency, avgTransitionTime: pattern.avg_transition_time },
        });
      }

      // Convert related sessions
      for (const session of context.relatedSessions || []) {
        const sessionId = session.external_id || session.externalId || session._key;
        sessions.push({
          sessionId,
          name: session.workflow_classification?.primary || session.workflowClassification?.primary || 'Work Session',
          summary: session.summary,
          timestamp: session.start_time || session.startTime || new Date().toISOString(),
          relevanceScore: 0.5,
        });

        sources.push({
          id: `session_${sessionId}`,
          type: 'session',
          title: session.workflow_classification?.primary || 'Work Session',
          description: session.summary || 'Work session from graph context',
          relevanceScore: 0.55,
          timestamp: session.start_time || session.startTime,
          sessionId,
        });
      }

      return { sources, sessions, queryTimeMs: Date.now() - startTime };
    } catch (error) {
      this.logger.warn('Graph context retrieval failed, continuing with other sources', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { sources, sessions, queryTimeMs: Date.now() - startTime };
    }
  }

  /**
   * Retrieve context using AQL-based text search in ArangoDB
   * Converts natural language query into AQL patterns for text matching
   * Searches entities, concepts, sessions, and activities by text similarity
   */
  private async retrieveAqlSearchContext(
    userId: number,
    request: NaturalLanguageQueryRequest
  ): Promise<{
    sources: RetrievedSource[];
    sessions: Array<{ sessionId: string; name: string; summary?: string; timestamp: string; relevanceScore: number }>;
    queryTimeMs: number;
  }> {
    const startTime = Date.now();
    const sources: RetrievedSource[] = [];
    const sessions: Array<{ sessionId: string; name: string; summary?: string; timestamp: string; relevanceScore: number }> = [];

    if (!this.graphService || !request.includeGraph) {
      return { sources, sessions, queryTimeMs: 0 };
    }

    try {
      // Execute AQL-based text search
      const searchResults = await this.graphService.searchByNaturalLanguageQuery(
        userId,
        request.query,
        {
          lookbackDays: request.lookbackDays,
          maxResults: request.maxResults,
          includeActivities: true,
          includeSessions: true,
          includeEntities: true,
          includeConcepts: true,
        }
      );

      // Convert matched entities to sources
      for (const entity of searchResults.entities) {
        sources.push({
          id: `aql_entity_${entity.name}`,
          type: 'entity',
          title: entity.name,
          description: `${entity.type} entity (AQL match: ${Math.round(entity.matchScore * 100)}% on ${entity.matchedOn})`,
          relevanceScore: entity.matchScore * 0.85, // Scale AQL matches slightly lower than vector
          metadata: {
            entityType: entity.type,
            frequency: entity.frequency,
            source: 'aql_search',
            matchedOn: entity.matchedOn,
          },
        });
      }

      // Convert matched concepts to sources
      for (const concept of searchResults.concepts) {
        sources.push({
          id: `aql_concept_${concept.name}`,
          type: 'concept',
          title: concept.name,
          description: `${concept.category || 'general'} concept (AQL match: ${Math.round(concept.matchScore * 100)}% on ${concept.matchedOn})`,
          relevanceScore: concept.matchScore * 0.8,
          metadata: {
            category: concept.category,
            frequency: concept.frequency,
            source: 'aql_search',
            matchedOn: concept.matchedOn,
          },
        });
      }

      // Convert matched sessions to sources and session list
      for (const session of searchResults.sessions) {
        const sessionId = session.externalId || session.sessionKey;

        sources.push({
          id: `aql_session_${sessionId}`,
          type: 'session',
          title: session.workflowClassification || 'Work Session',
          description: session.summary || `Session matched via AQL (${Math.round(session.matchScore * 100)}%)`,
          relevanceScore: session.matchScore * 0.9, // Sessions are highly relevant
          timestamp: session.startTime,
          sessionId,
          metadata: {
            source: 'aql_search',
            matchedOn: session.matchedOn,
          },
        });

        sessions.push({
          sessionId,
          name: session.workflowClassification || 'Work Session',
          summary: session.summary,
          timestamp: session.startTime,
          relevanceScore: session.matchScore * 0.9,
        });
      }

      // Convert matched activities to sources (activities provide detailed context)
      for (const activity of searchResults.activities) {
        sources.push({
          id: `aql_activity_${activity.activityKey}`,
          type: 'screenshot', // Activities correspond to screenshots
          title: activity.summary?.slice(0, 100) || 'Activity',
          description: `${activity.workflowTag} activity (AQL match: ${Math.round(activity.matchScore * 100)}%)`,
          relevanceScore: activity.matchScore * 0.75,
          timestamp: activity.timestamp,
          metadata: {
            workflowTag: activity.workflowTag,
            source: 'aql_search',
            matchedOn: activity.matchedOn,
          },
        });
      }

      this.logger.debug('AQL search context retrieved', {
        userId,
        query: request.query,
        entitiesFound: searchResults.entities.length,
        conceptsFound: searchResults.concepts.length,
        sessionsFound: searchResults.sessions.length,
        activitiesFound: searchResults.activities.length,
        queryTimeMs: Date.now() - startTime,
      });

      return { sources, sessions, queryTimeMs: Date.now() - startTime };
    } catch (error) {
      this.logger.warn('AQL search context retrieval failed, continuing with other sources', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { sources, sessions, queryTimeMs: Date.now() - startTime };
    }
  }

  /**
   * Retrieve context from workflow screenshots
   */
  private async retrieveScreenshotContext(
    userId: number,
    request: NaturalLanguageQueryRequest,
    queryEmbedding: number[]
  ): Promise<{
    sources: RetrievedSource[];
    sessions: Array<{ sessionId: string; name: string; summary?: string; timestamp: string; relevanceScore: number }>;
    queryTimeMs: number;
  }> {
    const startTime = Date.now();
    const sources: RetrievedSource[] = [];
    const sessions: Array<{ sessionId: string; name: string; summary?: string; timestamp: string; relevanceScore: number }> = [];

    if (!this.screenshotRepository) {
      return { sources, sessions, queryTimeMs: 0 };
    }

    try {
      // Convert number[] to Float32Array for the repository method
      const embeddingArray = new Float32Array(queryEmbedding);

      // Use a lower similarity threshold for better recall
      // 0.15 captures more semantically related content while still filtering noise
      const similarityThreshold = 0.15;

      // Debug: Log the vector search parameters
      this.logger.info('[VECTOR_SEARCH_DEBUG] Starting screenshot vector search', {
        userId,
        nodeId: request.nodeId,
        maxResults: request.maxResults,
        embeddingLength: queryEmbedding.length,
        similarityThreshold,
      });

      // Search screenshots by semantic similarity using vectorSearch
      const searchResults = await this.screenshotRepository.vectorSearch(
        userId,
        embeddingArray,
        {
          nodeId: request.nodeId,
          limit: request.maxResults,
          similarityThreshold,
        }
      );

      // Debug: Log the results
      this.logger.info('[VECTOR_SEARCH_DEBUG] Screenshot vector search completed', {
        userId,
        nodeId: request.nodeId,
        resultsCount: searchResults.length,
        topScores: searchResults.slice(0, 3).map(r => ({
          id: r.screenshot.id,
          score: r.score,
          sessionId: r.screenshot.sessionId,
        })),
      });

      for (const result of searchResults) {
        const screenshot = result.screenshot;
        sources.push({
          id: `screenshot_${screenshot.id}`,
          type: 'screenshot',
          title: screenshot.summary || 'Work screenshot',
          description: screenshot.analysis || screenshot.summary || 'Screenshot from work session',
          relevanceScore: result.semanticScore || result.score || 0.5,
          timestamp: screenshot.timestamp,
          sessionId: screenshot.sessionId,
          nodeId: screenshot.nodeId,
          metadata: {
            workflowTag: screenshot.workflowTag,
            similarity: result.semanticScore || result.score,
          },
        });

        // Track unique sessions
        if (screenshot.sessionId) {
          const existingSession = sessions.find(s => s.sessionId === screenshot.sessionId);
          if (!existingSession) {
            sessions.push({
              sessionId: screenshot.sessionId,
              name: screenshot.summary?.split('.')[0] || 'Work Session',
              summary: screenshot.summary || undefined,
              timestamp: screenshot.timestamp,
              relevanceScore: result.semanticScore || result.score || 0.5,
            });
          } else {
            // Update relevance score if higher
            existingSession.relevanceScore = Math.max(
              existingSession.relevanceScore,
              result.semanticScore || result.score || 0.5
            );
          }
        }
      }

      return { sources, sessions, queryTimeMs: Date.now() - startTime };
    } catch (error) {
      this.logger.warn('Screenshot context retrieval failed, continuing with other sources', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { sources, sessions, queryTimeMs: Date.now() - startTime };
    }
  }

  /**
   * Retrieve context from company documents stored in graphrag_chunks
   * Uses pgvector cosine similarity search filtered by node_type='company_document'
   */
  private async retrieveCompanyDocContext(
    userId: number,
    request: NaturalLanguageQueryRequest,
    queryEmbedding: number[]
  ): Promise<{
    sources: RetrievedSource[];
    queryTimeMs: number;
  }> {
    const startTime = Date.now();
    const sources: RetrievedSource[] = [];

    if (!this.pool) {
      return { sources, queryTimeMs: 0 };
    }

    try {
      // Convert embedding to pgvector format
      const embeddingStr = `[${queryEmbedding.join(',')}]`;
      const minSimilarity = 0.3;
      const limit = request.maxResults || 10;

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

      this.logger.info('[COMPANY_DOC_SEARCH] Retrieved company documents', {
        userId,
        resultCount: result.rows.length,
        topScores: result.rows.slice(0, 3).map(r => ({
          id: r.id,
          similarity: r.similarity,
          filename: r.meta?.filename,
        })),
      });

      for (const row of result.rows) {
        sources.push({
          id: `company_doc_${row.id}`,
          type: 'company_document',
          title: row.meta?.filename || 'Company Document',
          description: row.chunk_text.slice(0, 500),
          relevanceScore: row.similarity,
          metadata: {
            documentId: row.meta?.documentId,
            pageNumber: row.meta?.pageNumber,
            sectionTitle: row.meta?.sectionTitle,
            chunkIndex: row.meta?.chunkIndex,
            isCompanyDoc: true,
            source: 'graphrag_chunks',
          },
        });
      }

      return { sources, queryTimeMs: Date.now() - startTime };
    } catch (error) {
      this.logger.warn('Company document context retrieval failed, continuing with other sources', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { sources, queryTimeMs: Date.now() - startTime };
    }
  }

  /**
   * Search company documents with graph expansion for better context
   * Follows sequential edges between document chunks
   */
  async searchCompanyDocuments(
    userId: number,
    query: string,
    options: { limit?: number; minSimilarity?: number; useGraphExpansion?: boolean } = {}
  ): Promise<Array<{
    chunkId: number;
    documentId: number;
    chunkText: string;
    pageNumber?: number;
    sectionTitle?: string;
    filename?: string;
    similarity: number;
    combinedScore: number;
  }>> {
    const { limit = 10, minSimilarity = 0.3, useGraphExpansion = true } = options;

    if (!this.pool) {
      this.logger.warn('Pool not available for company document search');
      return [];
    }

    // Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);
    const embeddingStr = `[${Array.from(queryEmbedding).join(',')}]`;

    if (!useGraphExpansion) {
      // Simple vector search
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

      return result.rows.map(row => ({
        chunkId: row.id,
        documentId: row.meta?.documentId,
        chunkText: row.chunk_text,
        pageNumber: row.meta?.pageNumber,
        sectionTitle: row.meta?.sectionTitle,
        filename: row.meta?.filename,
        similarity: row.similarity,
        combinedScore: row.similarity,
      }));
    }

    // Graph expansion search
    const VECTOR_WEIGHT = 0.7;
    const GRAPH_WEIGHT = 0.3;
    const graphDepth = 2;
    const seedLimit = Math.ceil(limit / 2);

    // Get seed results
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
      return [];
    }

    const seedChunkIds = seedResults.rows.map(r => r.id);

    // Graph expansion using recursive CTE
    const expandedResults = await this.pool.query<{
      id: number;
      chunk_text: string;
      meta: any;
      similarity: number;
      graph_score: number;
    }>(
      `WITH RECURSIVE expansion AS (
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
        path_weight as graph_score
      FROM expansion
      ORDER BY id, (${VECTOR_WEIGHT} * similarity + ${GRAPH_WEIGHT} * path_weight) DESC
      LIMIT $5`,
      [embeddingStr, seedChunkIds, graphDepth, userId, limit]
    );

    const results = expandedResults.rows.map(row => {
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
        combinedScore,
      };
    });

    // Sort by combined score
    results.sort((a, b) => b.combinedScore - a.combinedScore);

    this.logger.info('Company document graph expansion search completed', {
      userId,
      seedCount: seedResults.rows.length,
      expandedCount: results.length,
    });

    return results.slice(0, limit);
  }

  /**
   * Aggregate and rank sources from all retrieval methods
   * Accepts variable number of source arrays plus maxResults as final argument
   */
  private aggregateAndRankSources(
    ...args: [...RetrievedSource[][], number]
  ): RetrievedSource[] {
    // Last argument is maxResults
    const maxResults = args.pop() as number;
    const sourceArrays = args as RetrievedSource[][];

    // Combine all sources from all arrays
    const allSources = sourceArrays.flat();

    // Deduplicate by ID and merge scores
    const sourceMap = new Map<string, RetrievedSource>();
    for (const source of allSources) {
      const existing = sourceMap.get(source.id);
      if (existing) {
        // Merge: take higher relevance score and combine metadata
        sourceMap.set(source.id, {
          ...existing,
          relevanceScore: Math.max(existing.relevanceScore, source.relevanceScore),
          metadata: { ...existing.metadata, ...source.metadata, mergedFromMultipleSources: true },
        });
      } else {
        sourceMap.set(source.id, source);
      }
    }

    // Sort by relevance score and take top results
    return Array.from(sourceMap.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);
  }

  /**
   * Extract and deduplicate work sessions
   */
  private extractWorkSessions(
    ...sessionArrays: Array<Array<{ sessionId: string; name: string; summary?: string; timestamp: string; relevanceScore: number }>>
  ): Array<{ sessionId: string; name: string; summary?: string; timestamp: string; relevanceScore: number }> {
    const sessionMap = new Map<string, { sessionId: string; name: string; summary?: string; timestamp: string; relevanceScore: number }>();

    for (const sessions of sessionArrays) {
      for (const session of sessions) {
        const existing = sessionMap.get(session.sessionId);
        if (existing) {
          sessionMap.set(session.sessionId, {
            ...existing,
            relevanceScore: Math.max(existing.relevanceScore, session.relevanceScore),
          });
        } else {
          sessionMap.set(session.sessionId, session);
        }
      }
    }

    return Array.from(sessionMap.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Generate LLM response based on retrieved context
   */
  private async generateLLMResponse(
    query: string,
    sources: RetrievedSource[],
    sessions: Array<{ sessionId: string; name: string; summary?: string; timestamp: string; relevanceScore: number }>
  ): Promise<LLMResponse> {
    // Build context from sources
    const sourceContext = sources
      .slice(0, 10) // Limit context size
      .map((source, idx) => {
        let context = `[${idx + 1}] ${source.type.toUpperCase()}: ${source.title}`;
        if (source.description) {
          context += `\n   Description: ${source.description}`;
        }
        if (source.timestamp) {
          context += `\n   Time: ${new Date(source.timestamp).toLocaleString()}`;
        }
        return context;
      })
      .join('\n\n');

    const sessionContext = sessions
      .slice(0, 5)
      .map((session, idx) => {
        let context = `[Session ${idx + 1}] ${session.name}`;
        if (session.summary) {
          context += `\n   Summary: ${session.summary}`;
        }
        context += `\n   Time: ${new Date(session.timestamp).toLocaleString()}`;
        return context;
      })
      .join('\n\n');

    const systemPrompt = `You are a helpful assistant that answers questions about a user's work history and activities.
You have access to context from the user's work sessions, including technologies used, concepts applied, and workflow patterns.

Guidelines:
1. Answer based ONLY on the provided context. Do not make up information.
2. If the context doesn't contain enough information, say so clearly.
3. Reference specific sources when making claims.
4. Provide a confidence score based on how well the context supports your answer.
5. Suggest relevant follow-up questions that could help the user explore further.

Context from retrieved sources:
${sourceContext || 'No relevant sources found.'}

${sessionContext ? `Related work sessions:\n${sessionContext}` : ''}`;

    const userPrompt = `Based on the context above, please answer this question:

"${query}"

Provide a comprehensive answer with:
1. A direct response to the question
2. Your confidence level (0-1) in the answer
3. Up to 3 suggested follow-up questions`;

    try {
      const response = await this.llmProvider.generateStructuredResponse(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        LLMResponseSchema,
        { temperature: 0.3, maxTokens: 1500 }
      );

      return response.content;
    } catch (error) {
      this.logger.error(
        'LLM response generation failed',
        error instanceof Error ? error : new Error(String(error))
      );

      // Return a fallback response
      return {
        answer: sources.length > 0
          ? `I found ${sources.length} relevant items in your work history related to "${query}". However, I encountered an issue generating a detailed response. The most relevant items include: ${sources.slice(0, 3).map(s => s.title).join(', ')}.`
          : `I couldn't find specific information about "${query}" in your work history. Try rephrasing your question or asking about a different topic.`,
        confidence: 0.3,
        suggestedFollowUps: [
          'Can you show me recent work sessions?',
          'What technologies have I used most?',
          'What are my common workflow patterns?',
        ],
        keySourceIds: sources.slice(0, 3).map(s => s.id),
      };
    }
  }
}
