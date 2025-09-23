/**
 * GraphRAG Type Definitions
 *
 * Type definitions for the pgvector-based GraphRAG implementation
 * Maintains API compatibility with existing Neo4j implementation
 */

import { TimelineNodeType } from '@journey/schema';

// ============================================================================
// Request/Response Types
// ============================================================================

export interface GraphRAGSearchRequest {
  query: string;
  limit?: number;
  tenantId?: string;
  excludeUserId?: number;
  similarityThreshold?: number;
}

export interface GraphRAGSearchResponse {
  query: string;
  totalResults: number;
  profiles: ProfileResult[];
  timestamp: string;
}

export interface ProfileResult {
  id: string; // User ID
  name: string; // Full name
  email: string; // Email address
  username?: string; // Username for routing
  currentRole?: string; // Current job title
  company?: string; // Current company
  matchScore: string; // Percentage (e.g., "95.0")
  whyMatched: string[]; // 2-3 bullet points
  skills: string[]; // Extracted skills
  matchedNodes: MatchedNode[]; // Relevant timeline nodes with insights
  // Removed insightsSummary - insights are now at the node level
}

export interface MatchedNode {
  id: string;
  type: TimelineNodeType;
  meta: Record<string, any>;
  score: number;
  insights: InsightNode[];
}

export interface InsightNode {
  text: string;
  category: string;
}

// ============================================================================
// Database Types
// ============================================================================

export interface GraphRAGChunk {
  id: string;
  user_id: number;
  node_id?: string;
  chunk_text: string;
  embedding: string | Float32Array;
  node_type?: string;
  meta: Record<string, any>;
  tenant_id?: string;
  created_at?: Date;
  updated_at?: Date;
  // Additional fields for query results
  similarity?: number;
  final_score?: number;
}

export interface GraphRAGEdge {
  id: string;
  src_chunk_id: string;
  dst_chunk_id: string;
  rel_type: 'parent_child' | 'same_user' | 'similar_role' | 'same_company';
  weight: number;
  directed: boolean;
  tenant_id?: string;
  created_at?: Date;
}

export interface GraphExpansionResult {
  chunk_id: string;
  best_seed_sim: number;
  best_path_w: number;
  graph_aware_score: number;
}

// ============================================================================
// Service/Repository Types
// ============================================================================

export interface GraphRAGSearchOptions {
  limit: number;
  tenantId?: string;
  since?: Date;
  excludeUserId?: number;
}

export interface ScoringWeights {
  vectorSimilarity: number;
  graphDistance: number;
  recency: number;
}

export interface CreateChunkData {
  userId: number;
  nodeId?: string;
  chunkText: string;
  embedding: Float32Array;
  nodeType?: string;
  meta?: Record<string, any>;
  tenantId?: string;
}

export interface CreateEdgeData {
  srcChunkId: string;
  dstChunkId: string;
  relType: 'parent_child' | 'same_user' | 'similar_role' | 'same_company';
  weight?: number;
  directed?: boolean;
  tenantId?: string;
}

// ============================================================================
// Embedding Service Types
// ============================================================================

export interface EmbeddingService {
  generateEmbedding(text: string): Promise<Float32Array>;
  generateEmbeddings(texts: string[]): Promise<Float32Array[]>;
}

// ============================================================================
// Repository Interface
// ============================================================================

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

  // Schema management
  createSchema(): Promise<void>;
  dropSchema(): Promise<void>;
}

// ============================================================================
// Service Interface
// ============================================================================

export interface IPgVectorGraphRAGService {
  searchProfiles(
    request: GraphRAGSearchRequest
  ): Promise<GraphRAGSearchResponse>;

  formatProfileResult(
    userId: number,
    matchedNodes: MatchedNode[],
    matchScore: number,
    whyMatched: string[],
    skills: string[],
    query: string
  ): Promise<ProfileResult>;

  generateWhyMatched(matchedNodes: MatchedNode[], query: string): Promise<string[]>;

  extractSkillsFromNodes(nodes: MatchedNode[]): string[];
}

// ============================================================================
// Controller Interface
// ============================================================================

export interface IPgVectorGraphRAGController {
  searchProfiles(req: any, res: any): Promise<void>;
}
