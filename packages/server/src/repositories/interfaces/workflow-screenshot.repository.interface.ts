/**
 * Workflow Screenshot Repository Interface
 *
 * Defines the contract for workflow screenshot data access layer.
 * Supports hybrid search (BM25 + vector similarity) and CRUD operations.
 */

import type { WorkflowScreenshot, WorkflowTagType } from '@journey/schema';

/**
 * Data for creating a new workflow screenshot
 */
export interface CreateWorkflowScreenshotData {
  userId: number;
  nodeId: string;
  sessionId: string;
  screenshotPath: string;
  cloudUrl: string | null;
  timestamp: Date;
  workflowTag: WorkflowTagType;
  summary: string | null;
  analysis: string | null;
  embedding: Float32Array;
  meta: Record<string, any>;
}

/**
 * Data for updating a workflow screenshot
 */
export interface UpdateWorkflowScreenshotData {
  summary?: string;
  analysis?: string;
  workflowTag?: WorkflowTagType;
  cloudUrl?: string;
  embedding?: Float32Array;
  meta?: Record<string, any>;
}

/**
 * Hybrid search parameters
 */
export interface HybridSearchParams {
  userId: number;
  queryText: string;
  queryEmbedding: Float32Array;
  nodeId?: string;
  workflowTags?: WorkflowTagType[];
  limit?: number;
  lexicalWeight?: number; // 0-1, default 0.5 (50% BM25)
  similarityThreshold?: number;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Hybrid search result item
 */
export interface HybridSearchResult {
  screenshot: WorkflowScreenshot;
  score: number; // Combined hybrid score
  lexicalScore?: number; // BM25 rank score
  semanticScore?: number; // Cosine similarity score
  highlightedText?: string; // Text snippet with query matches
}

/**
 * Repository interface for workflow screenshot operations
 */
export interface IWorkflowScreenshotRepository {
  /**
   * Create a new workflow screenshot record
   */
  createScreenshot(
    data: CreateWorkflowScreenshotData
  ): Promise<WorkflowScreenshot>;

  /**
   * Get screenshot by ID
   */
  getScreenshotById(id: number): Promise<WorkflowScreenshot | null>;

  /**
   * Get screenshots by multiple IDs
   * Used for loading screenshots associated with blocks for step extraction
   */
  getScreenshotsByIds(ids: number[]): Promise<WorkflowScreenshot[]>;

  /**
   * Get all screenshots for a specific node
   */
  getScreenshotsByNode(
    userId: number,
    nodeId: string,
    options?: {
      limit?: number;
      offset?: number;
      workflowTags?: WorkflowTagType[];
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<WorkflowScreenshot[]>;

  /**
   * Get all screenshots for a specific session
   */
  getScreenshotsBySession(
    userId: number,
    sessionId: string
  ): Promise<WorkflowScreenshot[]>;

  /**
   * Update a screenshot
   */
  updateScreenshot(
    id: number,
    data: UpdateWorkflowScreenshotData
  ): Promise<WorkflowScreenshot>;

  /**
   * Delete a screenshot
   */
  deleteScreenshot(id: number): Promise<void>;

  /**
   * Hybrid search combining BM25 lexical search and vector similarity
   * Returns results ranked by weighted combination of both scores
   */
  hybridSearch(params: HybridSearchParams): Promise<HybridSearchResult[]>;

  /**
   * Vector-only similarity search
   */
  vectorSearch(
    userId: number,
    queryEmbedding: Float32Array,
    options?: {
      nodeId?: string;
      limit?: number;
      similarityThreshold?: number;
    }
  ): Promise<HybridSearchResult[]>;

  /**
   * Lexical-only full-text search (BM25)
   */
  lexicalSearch(
    userId: number,
    queryText: string,
    options?: {
      nodeId?: string;
      limit?: number;
    }
  ): Promise<HybridSearchResult[]>;

  /**
   * Get workflow distribution for a node
   */
  getWorkflowDistribution(
    userId: number,
    nodeId: string
  ): Promise<
    Array<{
      workflowTag: WorkflowTagType;
      count: number;
    }>
  >;

  /**
   * Batch create screenshots (for efficient ingestion)
   */
  batchCreateScreenshots(
    data: CreateWorkflowScreenshotData[]
  ): Promise<WorkflowScreenshot[]>;

  /**
   * Get workflow sequences (transitions between workflow tags)
   * Used for identifying top/repeated workflow patterns
   */
  getWorkflowSequences(
    userId: number,
    options?: {
      nodeId?: string;
      minOccurrences?: number;
      lookbackDays?: number;
      limit?: number;
    }
  ): Promise<WorkflowSequenceResult[]>;

  /**
   * Get all screenshots for a user with optional filters
   * Used for analyzing patterns across all nodes
   */
  getAllScreenshots(
    userId: number,
    options?: {
      nodeId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<WorkflowScreenshot[]>;
}

/**
 * Workflow sequence result for pattern detection
 */
export interface WorkflowSequenceResult {
  sequence: WorkflowTagType[];
  occurrenceCount: number;
  avgDurationSeconds: number;
  sampleScreenshotIds: number[];
  sessions: string[];
}
