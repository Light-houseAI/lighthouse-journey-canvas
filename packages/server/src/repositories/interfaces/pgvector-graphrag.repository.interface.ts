/**
 * PgVector GraphRAG Repository Interface
 */

import type {
  CreateChunkData,
  CreateEdgeData,
  GraphExpansionResult,
  GraphRAGChunk,
  GraphRAGEdge,
  GraphRAGSearchOptions,
  ScoringWeights,
} from '@journey/schema';

export interface IPgVectorGraphRAGRepository {
  // Vector search
  vectorSearch(
    embedding: Float32Array,
    options: GraphRAGSearchOptions
  ): Promise<GraphRAGChunk[]>;

  // Graph expansion
  graphExpansion(
    seedChunkIds: string[],
    seedSimilarities: number[],
    options: { maxDepth: number; tenantId?: string }
  ): Promise<GraphExpansionResult[]>;

  // Combined scoring
  combinedScoring(
    candidateIds: string[],
    vectorScores: Map<string, number>,
    graphScores: Map<string, number>,
    weights?: ScoringWeights
  ): Promise<GraphRAGChunk[]>;

  // CRUD operations
  createChunk(data: CreateChunkData): Promise<GraphRAGChunk>;
  createEdge(data: CreateEdgeData): Promise<GraphRAGEdge>;
  getChunksByNodeId(nodeId: string): Promise<GraphRAGChunk[]>;
  getChunksByUserId(userId: number): Promise<GraphRAGChunk[]>;
  removeChunksByNodeId(nodeId: string): Promise<void>;
}
