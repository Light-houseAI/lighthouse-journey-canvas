/**
 * Insight Generation Cache Utilities
 *
 * Implements caching layer for repeat patterns to reduce:
 * - Redundant embedding generation for identical queries
 * - Repeated peer workflow fetches (data changes infrequently)
 * - Duplicate LLM calls for very similar questions
 *
 * Uses LRU eviction with TTL-based expiration.
 */

import type { EvidenceBundle } from '../types.js';

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

interface CacheConfig {
  /** Maximum entries in the cache */
  maxSize: number;
  /** Time-to-live in milliseconds */
  ttlMs: number;
}

const DEFAULT_CONFIGS: Record<string, CacheConfig> = {
  queryEmbedding: {
    maxSize: 500,
    ttlMs: 60 * 60 * 1000, // 1 hour - embeddings are deterministic
  },
  peerWorkflows: {
    maxSize: 100,
    ttlMs: 5 * 60 * 1000, // 5 minutes - peer data changes occasionally
  },
  similarQueryResults: {
    maxSize: 200,
    ttlMs: 2 * 60 * 1000, // 2 minutes - results may need refreshing
  },
};

// ============================================================================
// CACHE ENTRY
// ============================================================================

interface CacheEntry<T> {
  value: T;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
}

// ============================================================================
// LRU CACHE WITH TTL
// ============================================================================

export class InsightCache<T> {
  private readonly cache = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(config: CacheConfig) {
    this.maxSize = config.maxSize;
    this.ttlMs = config.ttlMs;
  }

  /**
   * Get a cached value if it exists and hasn't expired
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check TTL expiration
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Update access metadata for LRU
    entry.lastAccessedAt = Date.now();
    entry.accessCount++;

    return entry.value;
  }

  /**
   * Set a value in the cache
   */
  set(key: string, value: T): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 1,
    });
  }

  /**
   * Check if a key exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Remove a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; ttlMs: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
    };
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clean up expired entries (call periodically)
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.createdAt > this.ttlMs) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

// ============================================================================
// SPECIALIZED CACHES
// ============================================================================

/**
 * Cache for query embeddings
 * Key: normalized query string
 * Value: Float32Array embedding
 */
export class QueryEmbeddingCache extends InsightCache<Float32Array> {
  constructor() {
    super(DEFAULT_CONFIGS.queryEmbedding);
  }

  /**
   * Generate a cache key from a query
   */
  static makeKey(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }
}

/**
 * Cache for peer workflow patterns
 * Key: user context hash (to avoid cross-contamination)
 * Value: EvidenceBundle with peer workflows
 */
export class PeerWorkflowCache extends InsightCache<EvidenceBundle> {
  constructor() {
    super(DEFAULT_CONFIGS.peerWorkflows);
  }

  /**
   * Generate a cache key from query embedding + context
   * We use a hash of the embedding to avoid storing large arrays as keys
   */
  static makeKey(userId: number, queryEmbeddingHash: string): string {
    return `peer:${userId}:${queryEmbeddingHash}`;
  }

  /**
   * Hash an embedding for use in cache keys
   */
  static hashEmbedding(embedding: Float32Array): string {
    // Simple hash: take first 8 dimensions, convert to hex
    const sample = Array.from(embedding.slice(0, 8));
    return sample.map(n => Math.floor(n * 1000).toString(16)).join('');
  }
}

/**
 * Cache for similar query results
 * Stores recent insight generation results for quick retrieval
 * when a user asks a nearly identical question
 */
export interface CachedQueryResult {
  result: unknown; // InsightGenerationResult
  query: string;
  embedding: Float32Array;
}

export class SimilarQueryCache extends InsightCache<CachedQueryResult> {
  constructor() {
    super(DEFAULT_CONFIGS.similarQueryResults);
  }

  /**
   * Find a cached result that's similar enough to the given query
   * Returns null if no sufficiently similar result exists
   */
  findSimilar(
    userId: number,
    nodeId: string | null,
    embedding: Float32Array,
    similarityThreshold: number = 0.95
  ): CachedQueryResult | null {
    const keyPrefix = this.makeKeyPrefix(userId, nodeId);

    for (const [key, entry] of this.getCacheEntries()) {
      if (!key.startsWith(keyPrefix)) continue;

      const result = this.get(key);
      if (!result) continue;

      const similarity = this.cosineSimilarity(embedding, result.embedding);
      if (similarity >= similarityThreshold) {
        return result;
      }
    }

    return null;
  }

  /**
   * Store a query result for future similar query matching
   */
  storeResult(
    userId: number,
    nodeId: string | null,
    query: string,
    embedding: Float32Array,
    result: unknown
  ): void {
    const key = this.makeKey(userId, nodeId, query);
    this.set(key, { result, query, embedding });
  }

  private makeKeyPrefix(userId: number, nodeId: string | null): string {
    return `similar:${userId}:${nodeId || 'global'}:`;
  }

  private makeKey(userId: number, nodeId: string | null, query: string): string {
    const prefix = this.makeKeyPrefix(userId, nodeId);
    // Use first 50 chars of normalized query as part of key
    const queryPart = query.toLowerCase().trim().slice(0, 50).replace(/[^a-z0-9]/g, '_');
    return `${prefix}${queryPart}`;
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private getCacheEntries(): IterableIterator<[string, CacheEntry<CachedQueryResult>]> {
    // Access the internal cache Map via prototype
    return (this as unknown as { cache: Map<string, CacheEntry<CachedQueryResult>> }).cache.entries();
  }
}

// ============================================================================
// GLOBAL CACHE MANAGER
// ============================================================================

/**
 * Central manager for all insight generation caches
 * Handles lifecycle and provides unified access
 */
export class InsightCacheManager {
  readonly queryEmbeddings: QueryEmbeddingCache;
  readonly peerWorkflows: PeerWorkflowCache;
  readonly similarQueries: SimilarQueryCache;

  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.queryEmbeddings = new QueryEmbeddingCache();
    this.peerWorkflows = new PeerWorkflowCache();
    this.similarQueries = new SimilarQueryCache();
  }

  /**
   * Start periodic cleanup of expired entries
   */
  startCleanup(intervalMs: number = 60000): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.queryEmbeddings.cleanup();
      this.peerWorkflows.cleanup();
      this.similarQueries.cleanup();
    }, intervalMs);
  }

  /**
   * Stop periodic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.queryEmbeddings.clear();
    this.peerWorkflows.clear();
    this.similarQueries.clear();
  }

  /**
   * Get statistics for all caches
   */
  getStats(): Record<string, { size: number; maxSize: number; ttlMs: number }> {
    return {
      queryEmbeddings: this.queryEmbeddings.getStats(),
      peerWorkflows: this.peerWorkflows.getStats(),
      similarQueries: this.similarQueries.getStats(),
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let globalCacheManager: InsightCacheManager | null = null;

/**
 * Get the global cache manager instance
 */
export function getInsightCacheManager(): InsightCacheManager {
  if (!globalCacheManager) {
    globalCacheManager = new InsightCacheManager();
    globalCacheManager.startCleanup();
  }
  return globalCacheManager;
}

/**
 * Reset the global cache manager (useful for testing)
 */
export function resetInsightCacheManager(): void {
  if (globalCacheManager) {
    globalCacheManager.stopCleanup();
    globalCacheManager.clearAll();
  }
  globalCacheManager = null;
}
