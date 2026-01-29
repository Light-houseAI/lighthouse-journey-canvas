/**
 * Memory Service for Insight Assistant
 *
 * Uses Mem0 open-source library to store and retrieve conversational memories.
 * This enables the assistant to answer follow-up questions by pulling context
 * from previous interactions.
 *
 * Key features:
 * - Stores Q&A pairs after each insight generation
 * - Retrieves relevant memories for follow-up queries
 * - Associates memories with user IDs for personalization
 * - Supports metadata for filtering by session/workflow context
 */

import type { Logger } from '../../core/logger.js';
import type { EmbeddingService } from '../interfaces/index.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Configuration for the Memory Service
 */
export interface MemoryServiceConfig {
  /** OpenAI API key for Mem0 embeddings (required for mem0ai) */
  openAiApiKey?: string;
  /** Whether to enable memory features */
  enabled?: boolean;
  /** Maximum number of memories to retrieve for context */
  maxMemoriesToRetrieve?: number;
  /** Minimum relevance score for memory retrieval (0-1) */
  minRelevanceScore?: number;
}

/**
 * Memory entry stored in Mem0
 */
export interface MemoryEntry {
  id: string;
  memory: string;
  userId: string;
  metadata?: MemoryMetadata;
  createdAt: string;
  updatedAt?: string;
  score?: number; // Relevance score from search
}

/**
 * Metadata for memory entries
 */
export interface MemoryMetadata {
  /** Type of interaction */
  type: 'question_answer' | 'workflow_analysis' | 'optimization_suggestion';
  /** Original user query */
  query?: string;
  /** Session IDs associated with the memory */
  sessionIds?: string[];
  /** Node ID for scoping */
  nodeId?: string;
  /** Timestamp of the interaction */
  timestamp: string;
  /** Key topics/entities mentioned */
  topics?: string[];
  /** Whether this had optimization recommendations */
  hasOptimizations?: boolean;
}

/**
 * Input for adding a memory
 */
export interface AddMemoryInput {
  /** The content to memorize (Q&A pair, summary, etc.) */
  content: string;
  /** User ID for association */
  userId: number;
  /** Optional metadata */
  metadata?: Partial<MemoryMetadata>;
}

/**
 * Input for searching memories
 */
export interface SearchMemoryInput {
  /** Query to search for relevant memories */
  query: string;
  /** User ID to filter memories */
  userId: number;
  /** Maximum number of results */
  limit?: number;
  /** Optional node ID filter */
  nodeId?: string;
}

/**
 * Result from memory search
 */
export interface MemorySearchResult {
  memories: MemoryEntry[];
  totalFound: number;
  searchTimeMs: number;
}

/**
 * Dependencies for MemoryService
 */
export interface MemoryServiceDeps {
  logger: Logger;
  embeddingService: EmbeddingService;
  config: MemoryServiceConfig;
}

// ============================================================================
// MEMORY SERVICE IMPLEMENTATION
// ============================================================================

export class MemoryService {
  private readonly logger: Logger;
  private readonly embeddingService: EmbeddingService;
  private readonly enabled: boolean;
  private readonly maxMemoriesToRetrieve: number;
  private readonly minRelevanceScore: number;
  private readonly openAiApiKey?: string;

  // In-memory storage for local development (when Mem0 cloud is not configured)
  // In production, this would be replaced by actual Mem0 client
  private localMemoryStore: Map<string, MemoryEntry[]> = new Map();
  private mem0Client: any = null;

  constructor(deps: MemoryServiceDeps) {
    this.logger = deps.logger;
    this.embeddingService = deps.embeddingService;
    this.enabled = deps.config.enabled ?? true;
    this.maxMemoriesToRetrieve = deps.config.maxMemoriesToRetrieve ?? 5;
    this.minRelevanceScore = deps.config.minRelevanceScore ?? 0.7;
    this.openAiApiKey = deps.config.openAiApiKey;

    this.initializeMem0Client();
  }

  /**
   * Initialize the Mem0 client
   * Falls back to local storage if Mem0 is not configured
   */
  private async initializeMem0Client(): Promise<void> {
    if (!this.enabled) {
      this.logger.info('MemoryService: Memory features disabled');
      return;
    }

    try {
      // Dynamic import to handle optional dependency
      const { MemoryClient } = await import('mem0ai');

      // Mem0 cloud API requires MEM0_API_KEY
      const mem0ApiKey = process.env.MEM0_API_KEY;
      if (mem0ApiKey) {
        // Initialize with Mem0 cloud API
        this.mem0Client = new MemoryClient({
          apiKey: mem0ApiKey,
        });

        this.logger.info('MemoryService: Initialized with Mem0 cloud client');
      } else {
        this.logger.info('MemoryService: No MEM0_API_KEY, using local embedding-based storage');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`MemoryService: Failed to initialize Mem0, using local fallback: ${errorMessage}`);
    }
  }

  /**
   * Add a memory entry for a user
   */
  async addMemory(input: AddMemoryInput): Promise<MemoryEntry | null> {
    if (!this.enabled) {
      return null;
    }

    const userId = String(input.userId);
    const timestamp = new Date().toISOString();

    this.logger.info('MemoryService: Adding memory', {
      userId,
      contentLength: input.content.length,
      hasMetadata: !!input.metadata,
    });

    try {
      if (this.mem0Client) {
        // Use Mem0 cloud client - requires messages in specific format
        const messages = [
          { role: 'user' as const, content: input.content },
        ];
        const result = await this.mem0Client.add(messages, {
          user_id: userId,
          metadata: {
            ...input.metadata,
            timestamp,
            type: input.metadata?.type || 'question_answer',
          },
        });

        const memoryId = result?.[0]?.id || `mem-${Date.now()}`;
        this.logger.info(`MemoryService: Memory added via Mem0, id=${memoryId}`);

        return {
          id: memoryId,
          memory: input.content,
          userId,
          metadata: {
            ...input.metadata,
            timestamp,
            type: input.metadata?.type || 'question_answer',
          } as MemoryMetadata,
          createdAt: timestamp,
        };
      } else {
        // Fallback to local storage
        return this.addMemoryLocal(input, userId, timestamp);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`MemoryService: Failed to add memory: ${errorMessage}`);
      // Fallback to local storage on error
      return this.addMemoryLocal(input, userId, timestamp);
    }
  }

  /**
   * Add memory to local storage (fallback)
   */
  private addMemoryLocal(
    input: AddMemoryInput,
    userId: string,
    timestamp: string
  ): MemoryEntry {
    const memory: MemoryEntry = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      memory: input.content,
      userId,
      metadata: {
        ...input.metadata,
        timestamp,
        type: input.metadata?.type || 'question_answer',
      } as MemoryMetadata,
      createdAt: timestamp,
    };

    const userMemories = this.localMemoryStore.get(userId) || [];
    userMemories.push(memory);
    this.localMemoryStore.set(userId, userMemories);

    this.logger.info('MemoryService: Memory added to local storage', {
      memoryId: memory.id,
      userTotalMemories: userMemories.length,
    });

    return memory;
  }

  /**
   * Search for relevant memories based on a query
   */
  async searchMemories(input: SearchMemoryInput): Promise<MemorySearchResult> {
    if (!this.enabled) {
      return { memories: [], totalFound: 0, searchTimeMs: 0 };
    }

    const startTime = Date.now();
    const userId = String(input.userId);
    const limit = input.limit || this.maxMemoriesToRetrieve;

    this.logger.info('MemoryService: Searching memories', {
      userId,
      query: input.query.substring(0, 100),
      limit,
    });

    try {
      if (this.mem0Client) {
        // Use Mem0 cloud client for search
        const results = await this.mem0Client.search(input.query, {
          user_id: userId,
          limit,
        });

        const memories: MemoryEntry[] = (results || [])
          .filter((r: any) => (r.score || 0) >= this.minRelevanceScore)
          .map((r: any) => ({
            id: r.id,
            memory: r.data?.memory || r.memory || '',
            userId,
            metadata: r.metadata,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            score: r.score,
          }));

        const searchTimeMs = Date.now() - startTime;

        this.logger.info(`MemoryService: Memories found via Mem0, count=${memories.length}, time=${searchTimeMs}ms`);

        return {
          memories,
          totalFound: memories.length,
          searchTimeMs,
        };
      } else {
        // Fallback to local search
        return this.searchMemoriesLocal(input, userId, limit, startTime);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`MemoryService: Search failed: ${errorMessage}`);
      // Fallback to local search on error
      return this.searchMemoriesLocal(input, userId, limit, startTime);
    }
  }

  /**
   * Search memories in local storage (fallback)
   * Uses simple text matching and embedding similarity when available
   */
  private async searchMemoriesLocal(
    input: SearchMemoryInput,
    userId: string,
    limit: number,
    startTime: number
  ): Promise<MemorySearchResult> {
    const userMemories = this.localMemoryStore.get(userId) || [];

    if (userMemories.length === 0) {
      return { memories: [], totalFound: 0, searchTimeMs: Date.now() - startTime };
    }

    // Try embedding-based search
    try {
      const queryEmbeddingResult = await this.embeddingService.generateEmbedding(input.query);
      // Convert Float32Array to number[] if needed
      const queryEmbedding = Array.from(queryEmbeddingResult);

      // Calculate similarity scores for each memory
      const memoriesWithScores = await Promise.all(
        userMemories.map(async (memory) => {
          const memoryEmbeddingResult = await this.embeddingService.generateEmbedding(memory.memory);
          const memoryEmbedding = Array.from(memoryEmbeddingResult);
          const score = this.cosineSimilarity(queryEmbedding, memoryEmbedding);
          return { ...memory, score };
        })
      );

      // Sort by score and filter by minimum relevance
      const rankedMemories = memoriesWithScores
        .filter((m) => m.score >= this.minRelevanceScore)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, limit);

      const searchTimeMs = Date.now() - startTime;

      this.logger.info('MemoryService: Local embedding search completed', {
        totalMemories: userMemories.length,
        matchedMemories: rankedMemories.length,
        searchTimeMs,
      });

      return {
        memories: rankedMemories,
        totalFound: rankedMemories.length,
        searchTimeMs,
      };
    } catch (embeddingError) {
      // Fallback to simple text matching if embedding fails
      this.logger.warn('MemoryService: Embedding search failed, using text match', {
        error: embeddingError instanceof Error ? embeddingError.message : String(embeddingError),
      });

      return this.textMatchSearch(input, userMemories, limit, startTime);
    }
  }

  /**
   * Simple text matching fallback for memory search
   */
  private textMatchSearch(
    input: SearchMemoryInput,
    userMemories: MemoryEntry[],
    limit: number,
    startTime: number
  ): MemorySearchResult {
    const queryWords = input.query.toLowerCase().split(/\s+/);

    const scoredMemories = userMemories.map((memory) => {
      const memoryText = memory.memory.toLowerCase();
      const matchCount = queryWords.filter((word) => memoryText.includes(word)).length;
      const score = matchCount / queryWords.length;
      return { ...memory, score };
    });

    const rankedMemories = scoredMemories
      .filter((m) => m.score >= 0.3) // Lower threshold for text matching
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, limit);

    const searchTimeMs = Date.now() - startTime;

    return {
      memories: rankedMemories,
      totalFound: rankedMemories.length,
      searchTimeMs,
    };
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * Delete all memories for a user
   */
  async deleteUserMemories(userId: number): Promise<boolean> {
    if (!this.enabled) {
      return true;
    }

    const userIdStr = String(userId);

    try {
      if (this.mem0Client) {
        await this.mem0Client.deleteAll({ user_id: userIdStr });
      }

      // Also clear local storage
      this.localMemoryStore.delete(userIdStr);

      this.logger.info(`MemoryService: User memories deleted, userId=${userId}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`MemoryService: Failed to delete user memories: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Get all memories for a user (for debugging/admin purposes)
   */
  async getUserMemories(userId: number): Promise<MemoryEntry[]> {
    if (!this.enabled) {
      return [];
    }

    const userIdStr = String(userId);

    try {
      if (this.mem0Client) {
        const results = await this.mem0Client.getAll(userIdStr);
        return (results || []).map((r: any) => ({
          id: r.id,
          memory: r.memory,
          userId: userIdStr,
          metadata: r.metadata,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
      }

      // Fallback to local storage
      return this.localMemoryStore.get(userIdStr) || [];
    } catch (error) {
      this.logger.warn('MemoryService: Failed to get user memories', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.localMemoryStore.get(userIdStr) || [];
    }
  }

  /**
   * Format memories as context for LLM consumption
   */
  formatMemoriesForContext(memories: MemoryEntry[]): string {
    if (memories.length === 0) {
      return '';
    }

    const formattedMemories = memories
      .map((m, index) => {
        const date = m.metadata?.timestamp
          ? new Date(m.metadata.timestamp).toLocaleDateString()
          : 'Unknown date';
        const relevance = m.score ? ` (relevance: ${Math.round(m.score * 100)}%)` : '';
        return `${index + 1}. [${date}]${relevance}: ${m.memory}`;
      })
      .join('\n');

    return `PREVIOUS CONVERSATION CONTEXT:\n${formattedMemories}`;
  }

  /**
   * Create a memory entry from a Q&A interaction
   */
  createQAMemoryContent(
    query: string,
    answer: string,
    summary?: string
  ): string {
    // Create a concise but informative memory entry
    const truncatedAnswer = answer.length > 500
      ? answer.substring(0, 500) + '...'
      : answer;

    if (summary) {
      return `User asked: "${query}"\nSummary: ${summary}\nKey points: ${truncatedAnswer}`;
    }

    return `User asked: "${query}"\nAssistant answered: ${truncatedAnswer}`;
  }

  /**
   * Extract key topics from a query and answer for metadata
   */
  extractTopics(query: string, answer: string): string[] {
    const combinedText = `${query} ${answer}`.toLowerCase();

    // Common workflow/productivity topics to extract
    const topicPatterns = [
      { pattern: /automation|automate/i, topic: 'automation' },
      { pattern: /efficiency|optimize|optimization/i, topic: 'efficiency' },
      { pattern: /workflow|process/i, topic: 'workflow' },
      { pattern: /claude\s*code|claude/i, topic: 'claude_code' },
      { pattern: /research|searching|google/i, topic: 'research' },
      { pattern: /coding|development|code/i, topic: 'coding' },
      { pattern: /browser|chrome|firefox/i, topic: 'browser' },
      { pattern: /vscode|ide|editor/i, topic: 'ide' },
      { pattern: /slack|communication|chat/i, topic: 'communication' },
      { pattern: /meeting|call|zoom/i, topic: 'meetings' },
      { pattern: /time\s*sav|save\s*time/i, topic: 'time_saving' },
      { pattern: /shortcut|keyboard/i, topic: 'shortcuts' },
    ];

    const topics: string[] = [];
    for (const { pattern, topic } of topicPatterns) {
      if (pattern.test(combinedText) && !topics.includes(topic)) {
        topics.push(topic);
      }
    }

    return topics.slice(0, 5); // Limit to 5 topics
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a MemoryService instance
 */
export function createMemoryService(deps: MemoryServiceDeps): MemoryService {
  return new MemoryService(deps);
}
