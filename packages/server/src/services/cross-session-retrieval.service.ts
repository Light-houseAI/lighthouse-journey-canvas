/**
 * Cross-Session Retrieval Service
 *
 * Orchestrates hybrid retrieval across:
 * - ArangoDB (graph traversal for relationships)
 * - PostgreSQL (vector similarity for content)
 *
 * Implements parallel query execution, result fusion, and ranking.
 */

import type { Logger } from '../core/logger.js';
import type { ArangoDBGraphService } from './arangodb-graph.service.js';
import type { ConceptEmbeddingRepository } from '../repositories/concept-embedding.repository.js';
import type { EntityEmbeddingRepository } from '../repositories/entity-embedding.repository.js';
import type { EmbeddingService } from './interfaces/index.js';

/**
 * Query options for cross-session retrieval
 */
export interface CrossSessionQueryOptions {
  userId: number;
  nodeId: number | string;
  lookbackDays?: number;
  minSimilarity?: number;
  maxResults?: number;
  includeGraph?: boolean;
  includeVectors?: boolean;
  entityTypes?: string[];
  conceptCategories?: string[];
}

/**
 * Entity result with similarity and frequency
 */
export interface EntityResult {
  entityName: string;
  entityType: string;
  embedding?: number[];
  frequency: number;
  usageCount?: number;
  similarity?: number;
  lastSeen: Date;
  meta?: Record<string, any>;
  source: 'graph' | 'vector' | 'both';
}

/**
 * Concept result with similarity and frequency
 */
export interface ConceptResult {
  conceptName: string;
  category: string;
  embedding?: number[];
  frequency: number;
  usageCount?: number;
  similarity?: number;
  lastSeen: Date;
  source: 'graph' | 'vector' | 'both';
}

/**
 * Session result with metadata
 */
export interface SessionResult {
  sessionId: string;
  workflowClassification: string;
  startTime: Date;
  endTime?: Date;
  activityCount: number;
  similarity?: number;
}

/**
 * Workflow pattern result
 */
export interface WorkflowPatternResult {
  transition: string;
  frequency: number;
  avgTransitionTime?: number;
}

/**
 * Complete cross-session retrieval result
 */
export interface CrossSessionRetrievalResult {
  entities: EntityResult[];
  concepts: ConceptResult[];
  relatedSessions: SessionResult[];
  workflowPatterns: WorkflowPatternResult[];
  temporalSequence: Array<{ sessionId: string; timestamp: Date }>;
  retrievalMetadata: {
    graphQueryTimeMs: number;
    vectorQueryTimeMs: number;
    totalTimeMs: number;
    graphResultCount: number;
    vectorResultCount: number;
    fusedResultCount: number;
  };
}

/**
 * Service dependencies
 */
export interface CrossSessionRetrievalServiceDeps {
  arangoDBGraphService: ArangoDBGraphService;
  conceptEmbeddingRepository: ConceptEmbeddingRepository;
  entityEmbeddingRepository: EntityEmbeddingRepository;
  openAIEmbeddingService: EmbeddingService;
  logger: Logger;
}

/**
 * Cross-Session Retrieval Service
 */
export class CrossSessionRetrievalService {
  private graphService: ArangoDBGraphService;
  private conceptRepo: ConceptEmbeddingRepository;
  private entityRepo: EntityEmbeddingRepository;
  private embeddingService: EmbeddingService;
  private logger: Logger;

  constructor(deps: CrossSessionRetrievalServiceDeps) {
    this.graphService = deps.arangoDBGraphService;
    this.conceptRepo = deps.conceptEmbeddingRepository;
    this.entityRepo = deps.entityEmbeddingRepository;
    this.embeddingService = deps.openAIEmbeddingService;
    this.logger = deps.logger;
  }

  /**
   * Execute hybrid cross-session retrieval
   */
  async retrieve(
    options: CrossSessionQueryOptions
  ): Promise<CrossSessionRetrievalResult> {
    const startTime = Date.now();

    const {
      userId,
      nodeId,
      lookbackDays = 30,
      minSimilarity = 0.5,
      maxResults = 20,
      includeGraph = true,
      includeVectors = true,
      entityTypes,
      conceptCategories,
    } = options;

    this.logger.info('Starting cross-session retrieval', {
      userId,
      nodeId,
      lookbackDays,
      includeGraph,
      includeVectors,
    });

    // Execute queries in parallel
    const [graphResults, vectorResults] = await Promise.all([
      includeGraph
        ? this.queryGraph(userId, nodeId, lookbackDays)
        : Promise.resolve(null),
      includeVectors
        ? this.queryVectors(
            userId,
            nodeId,
            minSimilarity,
            maxResults,
            entityTypes,
            conceptCategories
          )
        : Promise.resolve(null),
    ]);

    const graphQueryTime = graphResults?.queryTimeMs || 0;
    const vectorQueryTime = vectorResults?.queryTimeMs || 0;

    // Fuse results
    const fusedEntities = this.fuseEntityResults(
      graphResults?.entities || [],
      vectorResults?.entities || []
    );

    const fusedConcepts = this.fuseConceptResults(
      graphResults?.concepts || [],
      vectorResults?.concepts || []
    );

    // Rank results
    const rankedEntities = this.rankEntities(fusedEntities, maxResults);
    const rankedConcepts = this.rankConcepts(fusedConcepts, maxResults);

    const totalTime = Date.now() - startTime;

    this.logger.info('Cross-session retrieval completed', {
      totalTimeMs: totalTime,
      entityCount: rankedEntities.length,
      conceptCount: rankedConcepts.length,
    });

    return {
      entities: rankedEntities,
      concepts: rankedConcepts,
      relatedSessions: graphResults?.relatedSessions || [],
      workflowPatterns: graphResults?.workflowPatterns || [],
      temporalSequence: graphResults?.temporalSequence || [],
      retrievalMetadata: {
        graphQueryTimeMs: graphQueryTime,
        vectorQueryTimeMs: vectorQueryTime,
        totalTimeMs: totalTime,
        graphResultCount:
          (graphResults?.entities?.length || 0) +
          (graphResults?.concepts?.length || 0),
        vectorResultCount:
          (vectorResults?.entities?.length || 0) +
          (vectorResults?.concepts?.length || 0),
        fusedResultCount: rankedEntities.length + rankedConcepts.length,
      },
    };
  }

  /**
   * Query ArangoDB for graph-based context
   */
  private async queryGraph(
    userId: number,
    nodeId: number | string,
    lookbackDays: number
  ): Promise<{
    entities: EntityResult[];
    concepts: ConceptResult[];
    relatedSessions: SessionResult[];
    workflowPatterns: WorkflowPatternResult[];
    temporalSequence: Array<{ sessionId: string; timestamp: Date }>;
    queryTimeMs: number;
  }> {
    const startTime = Date.now();

    try {
      const context = await this.graphService.getCrossSessionContext(
        userId,
        nodeId,
        lookbackDays
      );

      const entities: EntityResult[] = (context.entities || []).map(
        (e: any) => ({
          entityName: e.name,
          entityType: e.type,
          frequency: e.frequency || 0,
          usageCount: e.usage_count || e.usageCount || 0,
          lastSeen: e.last_seen ? new Date(e.last_seen) : new Date(),
          meta: e.meta,
          source: 'graph' as const,
        })
      );

      const concepts: ConceptResult[] = (context.concepts || []).map(
        (c: any) => ({
          conceptName: c.name,
          category: c.category || 'other',
          frequency: c.frequency || 0,
          usageCount: c.usage_count || c.usageCount || 0,
          lastSeen: c.last_seen ? new Date(c.last_seen) : new Date(),
          source: 'graph' as const,
        })
      );

      const relatedSessions: SessionResult[] = (
        context.relatedSessions || []
      ).map((s: any) => ({
        sessionId: s.external_id || s.externalId || s._key,
        workflowClassification:
          s.workflow_classification?.primary ||
          s.workflowClassification?.primary ||
          'unknown',
        startTime: new Date(s.start_time || s.startTime),
        endTime: s.end_time ? new Date(s.end_time) : undefined,
        activityCount: s.activity_count || s.activityCount || 0,
      }));

      const workflowPatterns: WorkflowPatternResult[] = (
        context.workflowPatterns || []
      ).map((p: any) => ({
        transition: p.transition,
        frequency: p.frequency,
        avgTransitionTime: p.avg_transition_time || p.avgTransitionTime,
      }));

      const temporalSequence = (context.temporalSequence || []).map(
        (t: any) => ({
          sessionId: t.session_id || t.sessionId || t._key,
          timestamp: new Date(t.start_time || t.startTime || t.timestamp),
        })
      );

      const queryTime = Date.now() - startTime;

      this.logger.debug('Graph query completed', {
        queryTimeMs: queryTime,
        entityCount: entities.length,
        conceptCount: concepts.length,
      });

      return {
        entities,
        concepts,
        relatedSessions,
        workflowPatterns,
        temporalSequence,
        queryTimeMs: queryTime,
      };
    } catch (error) {
      this.logger.error(
        'Graph query failed',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Query PostgreSQL for vector-based similarity
   */
  private async queryVectors(
    userId: number,
    nodeId: number | string,
    minSimilarity: number,
    maxResults: number,
    entityTypes?: string[],
    conceptCategories?: string[]
  ): Promise<{
    entities: EntityResult[];
    concepts: ConceptResult[];
    queryTimeMs: number;
  }> {
    const startTime = Date.now();

    try {
      // Get current node's context to generate query embeddings
      // For now, we'll query top entities and concepts by frequency
      // In a real implementation, you'd generate embeddings from current node summary

      const entityPromises = entityTypes
        ? entityTypes.map((type) =>
            this.entityRepo.getTopByFrequency(maxResults, 1, type)
          )
        : [this.entityRepo.getTopByFrequency(maxResults, 1)];

      const conceptPromises = conceptCategories
        ? conceptCategories.map((category) =>
            this.conceptRepo.getByCategory(category, maxResults)
          )
        : [this.conceptRepo.getTopByFrequency(maxResults, 1)];

      const [entityResultsArray, conceptResultsArray] = await Promise.all([
        Promise.all(entityPromises),
        Promise.all(conceptPromises),
      ]);

      const allEntities = entityResultsArray.flat();
      const allConcepts = conceptResultsArray.flat();

      const entities: EntityResult[] = allEntities.map((e) => ({
        entityName: e.entityName,
        entityType: e.entityType,
        embedding: e.embedding,
        frequency: e.frequency,
        lastSeen: e.lastSeen,
        meta: e.meta,
        source: 'vector' as const,
      }));

      const concepts: ConceptResult[] = allConcepts.map((c) => ({
        conceptName: c.conceptName,
        category: c.category || 'other',
        embedding: c.embedding,
        frequency: c.frequency,
        lastSeen: c.lastSeen,
        source: 'vector' as const,
      }));

      const queryTime = Date.now() - startTime;

      this.logger.debug('Vector query completed', {
        queryTimeMs: queryTime,
        entityCount: entities.length,
        conceptCount: concepts.length,
      });

      return {
        entities,
        concepts,
        queryTimeMs: queryTime,
      };
    } catch (error) {
      this.logger.error(
        'Vector query failed',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Fuse entity results from graph and vector sources
   */
  private fuseEntityResults(
    graphEntities: EntityResult[],
    vectorEntities: EntityResult[]
  ): EntityResult[] {
    const entityMap = new Map<string, EntityResult>();

    // Add graph entities
    for (const entity of graphEntities) {
      const key = `${entity.entityName}:${entity.entityType}`.toLowerCase();
      entityMap.set(key, { ...entity });
    }

    // Merge vector entities
    for (const entity of vectorEntities) {
      const key = `${entity.entityName}:${entity.entityType}`.toLowerCase();
      const existing = entityMap.get(key);

      if (existing) {
        // Merge: combine data from both sources
        entityMap.set(key, {
          ...existing,
          embedding: entity.embedding,
          similarity: entity.similarity,
          frequency: Math.max(existing.frequency, entity.frequency),
          usageCount: (existing.usageCount || 0) + (entity.usageCount || 0),
          source: 'both' as const,
        });
      } else {
        entityMap.set(key, { ...entity });
      }
    }

    return Array.from(entityMap.values());
  }

  /**
   * Fuse concept results from graph and vector sources
   */
  private fuseConceptResults(
    graphConcepts: ConceptResult[],
    vectorConcepts: ConceptResult[]
  ): ConceptResult[] {
    const conceptMap = new Map<string, ConceptResult>();

    // Add graph concepts
    for (const concept of graphConcepts) {
      const key = concept.conceptName.toLowerCase();
      conceptMap.set(key, { ...concept });
    }

    // Merge vector concepts
    for (const concept of vectorConcepts) {
      const key = concept.conceptName.toLowerCase();
      const existing = conceptMap.get(key);

      if (existing) {
        // Merge: combine data from both sources
        conceptMap.set(key, {
          ...existing,
          embedding: concept.embedding,
          similarity: concept.similarity,
          frequency: Math.max(existing.frequency, concept.frequency),
          usageCount: (existing.usageCount || 0) + (concept.usageCount || 0),
          source: 'both' as const,
        });
      } else {
        conceptMap.set(key, { ...concept });
      }
    }

    return Array.from(conceptMap.values());
  }

  /**
   * Rank entities by combined score
   */
  private rankEntities(
    entities: EntityResult[],
    maxResults: number
  ): EntityResult[] {
    return entities
      .map((entity) => {
        // Calculate combined score
        const frequencyScore = Math.log(entity.frequency + 1) / 10; // Log scale
        const usageScore = Math.log((entity.usageCount || 0) + 1) / 10;
        const similarityScore = entity.similarity || 0;
        const sourceBonus = entity.source === 'both' ? 0.2 : 0;

        const score =
          frequencyScore * 0.3 +
          usageScore * 0.3 +
          similarityScore * 0.3 +
          sourceBonus;

        return { ...entity, score };
      })
      .sort((a, b) => (b as any).score - (a as any).score)
      .slice(0, maxResults)
      .map(({ score, ...entity }) => entity); // Remove score from final result
  }

  /**
   * Rank concepts by combined score
   */
  private rankConcepts(
    concepts: ConceptResult[],
    maxResults: number
  ): ConceptResult[] {
    return concepts
      .map((concept) => {
        // Calculate combined score
        const frequencyScore = Math.log(concept.frequency + 1) / 10;
        const usageScore = Math.log((concept.usageCount || 0) + 1) / 10;
        const similarityScore = concept.similarity || 0;
        const sourceBonus = concept.source === 'both' ? 0.2 : 0;

        const score =
          frequencyScore * 0.3 +
          usageScore * 0.3 +
          similarityScore * 0.3 +
          sourceBonus;

        return { ...concept, score };
      })
      .sort((a, b) => (b as any).score - (a as any).score)
      .slice(0, maxResults)
      .map(({ score, ...concept }) => concept); // Remove score from final result
  }

  /**
   * Execute entity similarity search using embeddings
   */
  async searchSimilarEntities(
    queryText: string,
    options: {
      limit?: number;
      minSimilarity?: number;
      entityType?: string;
    } = {}
  ): Promise<EntityResult[]> {
    const { limit = 10, minSimilarity = 0.5, entityType } = options;

    try {
      // Generate embedding for query
      const queryEmbedding = await this.embeddingService.generateEmbedding(
        queryText
      );

      // Search in entity embeddings
      const results = await this.entityRepo.searchBySimilarity(
        queryEmbedding,
        limit,
        minSimilarity,
        entityType
      );

      return results.map((r) => ({
        entityName: r.entityName,
        entityType: r.entityType,
        embedding: r.embedding,
        frequency: r.frequency,
        similarity: r.similarity,
        lastSeen: r.lastSeen,
        meta: r.meta,
        source: 'vector' as const,
      }));
    } catch (error) {
      this.logger.error(
        `Entity similarity search failed for query: ${queryText}`,
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Execute concept similarity search using embeddings
   */
  async searchSimilarConcepts(
    queryText: string,
    options: {
      limit?: number;
      minSimilarity?: number;
      category?: string;
    } = {}
  ): Promise<ConceptResult[]> {
    const { limit = 10, minSimilarity = 0.5 } = options;

    try {
      // Generate embedding for query
      const queryEmbedding = await this.embeddingService.generateEmbedding(
        queryText
      );

      // Search in concept embeddings
      const results = await this.conceptRepo.searchBySimilarity(
        queryEmbedding,
        limit,
        minSimilarity
      );

      return results.map((r) => ({
        conceptName: r.conceptName,
        category: r.category || 'other',
        embedding: r.embedding,
        frequency: r.frequency,
        similarity: r.similarity,
        lastSeen: r.lastSeen,
        source: 'vector' as const,
      }));
    } catch (error) {
      this.logger.error(
        `Concept similarity search failed for query: ${queryText}`,
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }
}
