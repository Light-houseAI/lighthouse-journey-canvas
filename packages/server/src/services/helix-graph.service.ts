/**
 * Helix DB Graph Service for Workflow Analysis
 *
 * Manages the knowledge graph for cross-session workflow analysis:
 * - User, Node, Session, Activity nodes
 * - Entity and Concept extraction
 * - Relationship creation and traversal
 * - Cross-session context queries
 * - Vector similarity search
 *
 * Replaces ArangoDB with Helix DB
 * Uses PostgreSQL pgvector for semantic search (hybrid approach)
 */

import type { Logger } from '../core/logger.js';
import type { Pool } from 'pg';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { EmbeddingService } from './interfaces/embedding.service.interface.js';

// ============================================================================
// HELIX CLIENT TYPE (from helix-ts SDK)
// ============================================================================

interface HelixClient {
  url: string;
  apiKey: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query<T = any>(endpoint: string, data?: Record<string, unknown>): Promise<T>;
}

// Dynamic import for helix-ts SDK - using any for flexibility with dynamic import
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let HelixDBClass: any;

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface ActivityNode {
  sessionKey: string;
  screenshotExternalId: number;
  timestamp: Date;
  workflowTag: string;
  summary: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface EntityRelationship {
  activityKey: string;
  entityName: string;
  entityType: string;
  confidence: number;
  context?: string;
}

export interface ConceptRelationship {
  activityKey: string;
  conceptName: string;
  relevanceScore: number;
  category?: string;
}

export interface CrossSessionContext {
  currentNode: unknown;
  relatedSessions: unknown[];
  entities: unknown[];
  concepts: unknown[];
  workflowPatterns: unknown[];
  temporalSequence: unknown[];
}

export interface SessionData {
  externalId: string;
  userId: number;
  nodeId: number | string;
  startTime: Date;
  endTime?: Date;
  durationSeconds?: number;
  screenshotCount?: number;
  workflowClassification?: {
    primary: string;
    secondary?: string;
    confidence: number;
  };
  metadata?: Record<string, unknown>;
}

export interface WorkflowPatternData {
  userId: string;
  intentCategory: string;
  occurrenceCount: number;
  metadata?: Record<string, unknown>;
}

export interface BlockData {
  userId: string;
  canonicalSlug: string;
  intentLabel: string;
  primaryTool: string;
  occurrenceCount: number;
  metadata?: Record<string, unknown>;
}

export interface StepData {
  sessionId: string;
  actionType: string;
  orderInBlock: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// HELIX GRAPH SERVICE
// ============================================================================

export class HelixGraphService {
  private client: HelixClient | null = null;
  private logger: Logger;
  private enabled: boolean;
  private crossSessionEnabled: boolean;
  private lookbackDays: number;
  private helixUrl: string;
  private initPromise: Promise<void> | null = null;
  private pool: Pool | null = null;
  private embeddingService: EmbeddingService | null = null;

  constructor({ logger, pool, embeddingService }: { logger: Logger; pool?: Pool; db?: NodePgDatabase<any>; embeddingService?: EmbeddingService }) {
    this.logger = logger;
    this.helixUrl = process.env.HELIX_URL || 'http://localhost:6969';
    this.enabled = process.env.ENABLE_GRAPH_RAG?.toLowerCase() === 'true';
    this.crossSessionEnabled = process.env.ENABLE_CROSS_SESSION_CONTEXT?.toLowerCase() === 'true';
    this.lookbackDays = parseInt(process.env.GRAPH_RAG_LOOKBACK_DAYS || '90', 10);
    this.pool = pool || null;
    this.embeddingService = embeddingService || null;
  }

  /**
   * Ensure Helix client is initialized
   */
  private async ensureInitialized(): Promise<HelixClient> {
    if (!this.enabled) {
      throw new Error('Helix Graph RAG is not enabled');
    }

    if (this.client) {
      return this.client;
    }

    // Avoid multiple concurrent initializations
    if (!this.initPromise) {
      this.initPromise = this.initialize();
    }

    await this.initPromise;
    return this.client!;
  }

  /**
   * Initialize Helix client
   */
  private async initialize(): Promise<void> {
    try {
      // Dynamic import of helix-ts
      const helixModule = await import('helix-ts');
      HelixDBClass = helixModule.default || helixModule.HelixDB;

      this.client = new HelixDBClass(this.helixUrl);
      this.logger.info('Helix DB client initialized', { url: this.helixUrl });
    } catch (error) {
      this.logger.error('Failed to initialize Helix DB client', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Execute Helix query with logging (similar to ArangoDB AQL logging)
   * Logs the query name and parameters for debugging graph retrieval
   */
  private async queryWithLogging<T>(
    client: HelixClient,
    queryName: string,
    params: Record<string, unknown>
  ): Promise<T> {
    const startTime = Date.now();

    // Log the HQL query being executed (similar to ArangoDB AQL logging)
    this.logger.info('[HELIX_QUERY] Executing HelixQL query', {
      query: queryName,
      params: params,
    });

    try {
      const result = await client.query<T>(queryName, params);
      const duration = Date.now() - startTime;

      // Log the result summary
      const resultSummary = Array.isArray(result)
        ? { type: 'array', count: result.length }
        : { type: typeof result, isNull: result === null };

      this.logger.info('[HELIX_QUERY] Query completed', {
        query: queryName,
        duration: `${duration}ms`,
        result: resultSummary,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('[HELIX_QUERY] Query failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          query: queryName,
          params: params,
          duration: `${duration}ms`,
        }
      );
      throw error;
    }
  }

  /**
   * Retry wrapper for Helix operations with exponential backoff
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 5,
    baseDelayMs: number = 100
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isRetryable =
          errorMessage.includes('connection') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('ECONNREFUSED');

        if (!isRetryable || attempt === maxRetries) {
          throw error;
        }

        lastError = error instanceof Error ? error : new Error(String(error));

        // Exponential backoff with jitter
        const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 50;
        this.logger.warn(`${operationName} attempt ${attempt} failed, retrying in ${Math.round(delay)}ms`, {
          attempt,
          maxRetries,
          error: errorMessage,
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  // ============================================================================
  // USER OPERATIONS
  // ============================================================================

  /**
   * Upsert user node in graph
   */
  async upsertUser(userId: number, metadata?: Record<string, unknown>): Promise<string> {
    if (!this.enabled) {
      return `user_${userId}`;
    }

    const client = await this.ensureInitialized();
    const userKey = `user_${userId}`;

    return this.withRetry(async () => {
      try {
        await client.query('UpsertUser', {
          external_id: userKey,
          metadata: JSON.stringify(metadata || {}),
        });

        this.logger.debug('Upserted user in Helix DB', { userId, userKey });
        return userKey;
      } catch (error) {
        this.logger.error('Failed to upsert user in Helix DB',
          error instanceof Error ? error : new Error(String(error)),
          { userId }
        );
        throw error;
      }
    }, 'upsertUser');
  }

  /**
   * Get user by external ID
   */
  async getUser(userId: number): Promise<unknown | null> {
    if (!this.enabled) {
      return null;
    }

    const client = await this.ensureInitialized();
    const userKey = `user_${userId}`;

    try {
      const result = await client.query('GetUserByExternalId', {
        external_id: userKey,
      });
      return result;
    } catch (error) {
      this.logger.debug('User not found in Helix DB', { userId });
      return null;
    }
  }

  // ============================================================================
  // TIMELINE NODE OPERATIONS
  // ============================================================================

  /**
   * Upsert timeline node in graph
   */
  async upsertTimelineNode(
    nodeId: number | string,
    userId: number,
    nodeData: { type: string; title: string; metadata?: Record<string, any> }
  ): Promise<string> {
    if (!this.enabled) {
      return `node_${nodeId}`;
    }

    const client = await this.ensureInitialized();
    const nodeKey = `node_${nodeId}`;
    const userKey = `user_${userId}`;

    return this.withRetry(async () => {
      try {
        await client.query('UpsertTimelineNode', {
          external_id: nodeKey,
          user_key: userKey,
          node_type: nodeData.type,
          title: nodeData.title,
          metadata: JSON.stringify(nodeData.metadata || {}),
        });

        this.logger.debug('Upserted timeline node in Helix DB', { nodeId, nodeKey });
        return nodeKey;
      } catch (error) {
        this.logger.error('Failed to upsert timeline node in Helix DB',
          error instanceof Error ? error : new Error(String(error)),
          { nodeId }
        );
        throw error;
      }
    }, 'upsertTimelineNode');
  }

  /**
   * Get timeline nodes by user
   */
  async getTimelineNodesByUser(userId: number): Promise<unknown[]> {
    if (!this.enabled) {
      return [];
    }

    const client = await this.ensureInitialized();
    const userKey = `user_${userId}`;

    try {
      const result = await client.query<unknown[]>('GetTimelineNodesByUser', {
        user_key: userKey,
      });
      return result || [];
    } catch (error) {
      this.logger.error('Failed to get timeline nodes',
        error instanceof Error ? error : new Error(String(error)),
        { userId }
      );
      return [];
    }
  }

  // ============================================================================
  // SESSION OPERATIONS
  // ============================================================================

  /**
   * Upsert session in graph
   */
  async upsertSession(sessionData: SessionData): Promise<string> {
    if (!this.enabled) {
      return sessionData.externalId;
    }

    const client = await this.ensureInitialized();
    const wf = sessionData.workflowClassification;

    return this.withRetry(async () => {
      try {
        await client.query('UpsertSession', {
          external_id: sessionData.externalId,
          user_key: `user_${sessionData.userId}`,
          node_key: `node_${sessionData.nodeId}`,
          start_time: sessionData.startTime.toISOString(),
          end_time: sessionData.endTime?.toISOString() || '',
          duration_seconds: sessionData.durationSeconds || 0,
          screenshot_count: sessionData.screenshotCount || 0,
          workflow_primary: wf?.primary || '',
          workflow_secondary: wf?.secondary || '',
          workflow_confidence: wf?.confidence || 0,
          metadata: JSON.stringify(sessionData.metadata || {}),
        });

        this.logger.debug('Upserted session in Helix DB', { sessionId: sessionData.externalId });
        return sessionData.externalId;
      } catch (error) {
        this.logger.error('Failed to upsert session in Helix DB',
          error instanceof Error ? error : new Error(String(error)),
          { sessionData }
        );
        throw error;
      }
    }, 'upsertSession');
  }

  /**
   * Link session to timeline node
   */
  async linkSessionToNode(sessionExternalId: string, nodeExternalId: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const client = await this.ensureInitialized();

    return this.withRetry(async () => {
      try {
        await client.query('LinkSessionToNode', {
          session_external_id: sessionExternalId,
          node_external_id: nodeExternalId,
        });
        this.logger.debug('Linked session to node', { sessionExternalId, nodeExternalId });
      } catch (error) {
        this.logger.error('Failed to link session to node',
          error instanceof Error ? error : new Error(String(error)),
          { sessionExternalId, nodeExternalId }
        );
        throw error;
      }
    }, 'linkSessionToNode');
  }

  /**
   * Get sessions by user
   */
  async getSessionsByUser(userId: number, limit: number = 50): Promise<unknown[]> {
    if (!this.enabled) {
      return [];
    }

    const client = await this.ensureInitialized();
    const userKey = `user_${userId}`;

    try {
      const result = await client.query<unknown[]>('GetSessionsByUser', {
        user_key: userKey,
        limit: limit,
      });
      return result || [];
    } catch (error) {
      this.logger.error('Failed to get sessions by user',
        error instanceof Error ? error : new Error(String(error)),
        { userId }
      );
      return [];
    }
  }

  /**
   * Get related sessions via shared timeline node
   */
  async getRelatedSessions(sessionExternalId: string): Promise<unknown[]> {
    if (!this.enabled) {
      return [];
    }

    const client = await this.ensureInitialized();

    try {
      const result = await client.query<unknown[]>('GetRelatedSessions', {
        session_external_id: sessionExternalId,
      });
      return result || [];
    } catch (error) {
      this.logger.error('Failed to get related sessions',
        error instanceof Error ? error : new Error(String(error)),
        { sessionExternalId }
      );
      return [];
    }
  }

  // ============================================================================
  // ACTIVITY OPERATIONS
  // ============================================================================

  /**
   * Upsert activity in graph
   */
  async upsertActivity(activity: ActivityNode): Promise<string> {
    if (!this.enabled) {
      return `activity_${activity.screenshotExternalId}`;
    }

    const client = await this.ensureInitialized();

    return this.withRetry(async () => {
      try {
        await client.query('UpsertActivity', {
          session_key: activity.sessionKey,
          screenshot_external_id: String(activity.screenshotExternalId),
          workflow_tag: activity.workflowTag,
          timestamp: activity.timestamp.toISOString(),
          summary: activity.summary,
          confidence: activity.confidence,
          metadata: JSON.stringify(activity.metadata || {}),
        });

        this.logger.debug('Upserted activity in Helix DB', { screenshotId: activity.screenshotExternalId });
        return `activity_${activity.screenshotExternalId}`;
      } catch (error) {
        this.logger.error('Failed to upsert activity in Helix DB',
          error instanceof Error ? error : new Error(String(error)),
          { activity }
        );
        throw error;
      }
    }, 'upsertActivity');
  }

  /**
   * Get activities by session
   */
  async getActivitiesBySession(sessionKey: string): Promise<unknown[]> {
    if (!this.enabled) {
      return [];
    }

    const client = await this.ensureInitialized();

    try {
      const result = await client.query<unknown[]>('GetActivitiesBySession', {
        session_key: sessionKey,
      });
      return result || [];
    } catch (error) {
      this.logger.error('Failed to get activities by session',
        error instanceof Error ? error : new Error(String(error)),
        { sessionKey }
      );
      return [];
    }
  }

  /**
   * Link activity to session (creates ActivityInSession edge for graph traversals)
   * This edge is required for cross-session context queries to work
   */
  async linkActivityToSession(screenshotExternalId: number | string, sessionExternalId: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const client = await this.ensureInitialized();

    return this.withRetry(async () => {
      try {
        await client.query('LinkActivityToSession', {
          screenshot_external_id: String(screenshotExternalId),
          session_external_id: sessionExternalId,
        });
        this.logger.debug('Linked activity to session', { screenshotExternalId, sessionExternalId });
      } catch (error) {
        this.logger.error('Failed to link activity to session',
          error instanceof Error ? error : new Error(String(error)),
          { screenshotExternalId, sessionExternalId }
        );
        throw error;
      }
    }, 'linkActivityToSession');
  }

  /**
   * Backfill ActivityInSession edges for all existing activities
   * This is needed because the edge wasn't being created before the fix
   */
  async backfillActivitySessionEdges(): Promise<{ processed: number; linked: number; errors: number }> {
    if (!this.enabled) {
      return { processed: 0, linked: 0, errors: 0 };
    }

    const client = await this.ensureInitialized();
    const stats = { processed: 0, linked: 0, errors: 0 };
    const batchSize = 100;

    try {
      // First get total activity count (with logging)
      const countResult = await this.queryWithLogging<{ count?: number }>(client, 'GetActivityCount', {});
      const totalCount = (countResult as any)?.count || 0;
      this.logger.info('Starting ActivityInSession edge backfill', { totalCount });

      // Get all sessions to build a lookup map (with logging)
      const sessionsResult = await this.queryWithLogging<unknown[]>(client, 'GetAllSessionsForBackfill', {
        start: 0,
        end_range: 10000,
      });
      const sessions = Array.isArray(sessionsResult) ? sessionsResult : [];

      // Build session_key -> external_id map
      const sessionKeyToExternalId = new Map<string, string>();
      for (const session of sessions) {
        const s = session as any;
        if (s.external_id) {
          // session_key format is "session_{external_id}"
          sessionKeyToExternalId.set(`session_${s.external_id}`, s.external_id);
          // Also map the raw external_id
          sessionKeyToExternalId.set(s.external_id, s.external_id);
        }
      }
      this.logger.info('Built session lookup map', { sessionCount: sessionKeyToExternalId.size });

      // Process activities in batches
      for (let offset = 0; offset < totalCount; offset += batchSize) {
        const activitiesResult = await this.queryWithLogging<unknown[]>(client, 'GetAllActivitiesForBackfill', {
          start: offset,
          end_range: offset + batchSize,
        });
        const activities = Array.isArray(activitiesResult) ? activitiesResult : [];

        for (const activity of activities) {
          stats.processed++;
          const a = activity as any;

          if (!a.screenshot_external_id || !a.session_key) {
            this.logger.warn('Activity missing required fields', { activity: a });
            continue;
          }

          // Find the session external_id from session_key
          let sessionExternalId = sessionKeyToExternalId.get(a.session_key);
          if (!sessionExternalId) {
            // Try extracting from session_key format "session_{id}"
            const match = a.session_key.match(/^session_(.+)$/);
            if (match) {
              sessionExternalId = match[1];
            }
          }

          if (!sessionExternalId) {
            this.logger.warn('Could not find session for activity', {
              screenshotId: a.screenshot_external_id,
              sessionKey: a.session_key
            });
            continue;
          }

          try {
            await client.query('LinkActivityToSession', {
              screenshot_external_id: String(a.screenshot_external_id),
              session_external_id: sessionExternalId,
            });
            stats.linked++;
          } catch (error) {
            // Edge might already exist, which is fine
            const errorMsg = error instanceof Error ? error.message : String(error);
            if (!errorMsg.includes('already exists') && !errorMsg.includes('duplicate')) {
              stats.errors++;
              this.logger.warn('Failed to link activity to session', {
                screenshotId: a.screenshot_external_id,
                sessionExternalId,
                error: errorMsg,
              });
            } else {
              stats.linked++; // Count as success if edge already exists
            }
          }
        }

        this.logger.info('Backfill progress', {
          processed: stats.processed,
          linked: stats.linked,
          errors: stats.errors,
          total: totalCount
        });
      }

      this.logger.info('ActivityInSession edge backfill complete', stats);
      return stats;
    } catch (error) {
      this.logger.error('Backfill failed',
        error instanceof Error ? error : new Error(String(error)),
        stats
      );
      throw error;
    }
  }

  // ============================================================================
  // ENTITY OPERATIONS
  // ============================================================================

  /**
   * Upsert entity in graph
   */
  async upsertEntity(name: string, entityType: string, metadata?: Record<string, unknown>): Promise<string> {
    if (!this.enabled) {
      return name;
    }

    const client = await this.ensureInitialized();

    return this.withRetry(async () => {
      try {
        await client.query('UpsertEntity', {
          name: name,
          entity_type: entityType,
          metadata: JSON.stringify(metadata || {}),
        });

        this.logger.debug('Upserted entity in Helix DB', { name, entityType });
        return name;
      } catch (error) {
        this.logger.error('Failed to upsert entity in Helix DB',
          error instanceof Error ? error : new Error(String(error)),
          { name, entityType }
        );
        throw error;
      }
    }, 'upsertEntity');
  }

  /**
   * Link activity to entity
   */
  async linkActivityToEntity(
    screenshotExternalId: number,
    entityName: string,
    context?: string
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const client = await this.ensureInitialized();

    return this.withRetry(async () => {
      try {
        await client.query('LinkActivityToEntity', {
          screenshot_external_id: String(screenshotExternalId),
          entity_name: entityName,
          context: context || '',
        });
        this.logger.debug('Linked activity to entity', { screenshotExternalId, entityName });
      } catch (error) {
        this.logger.error('Failed to link activity to entity',
          error instanceof Error ? error : new Error(String(error)),
          { screenshotExternalId, entityName }
        );
        throw error;
      }
    }, 'linkActivityToEntity');
  }

  /**
   * Create entity relationship (batch upsert and link)
   */
  async createEntityRelationship(relationship: EntityRelationship): Promise<void> {
    if (!this.enabled) {
      return;
    }

    // First upsert the entity
    await this.upsertEntity(relationship.entityName, relationship.entityType);

    // Then link activity to entity
    await this.linkActivityToEntity(
      parseInt(relationship.activityKey.replace('activity_', '')),
      relationship.entityName,
      relationship.context
    );
  }

  /**
   * Get entity occurrences across sessions
   */
  async getEntityOccurrences(entityName: string): Promise<unknown[]> {
    if (!this.enabled) {
      return [];
    }

    const client = await this.ensureInitialized();

    try {
      const result = await client.query<unknown[]>('GetEntityOccurrences', {
        entity_name: entityName,
      });
      return result || [];
    } catch (error) {
      this.logger.error('Failed to get entity occurrences',
        error instanceof Error ? error : new Error(String(error)),
        { entityName }
      );
      return [];
    }
  }

  // ============================================================================
  // CONCEPT OPERATIONS
  // ============================================================================

  /**
   * Upsert concept in graph
   */
  async upsertConcept(name: string, category: string, relevanceScore: number = 1.0): Promise<string> {
    if (!this.enabled) {
      return name;
    }

    const client = await this.ensureInitialized();

    return this.withRetry(async () => {
      try {
        await client.query('UpsertConcept', {
          name: name,
          category: category,
          relevance_score: relevanceScore,
        });

        this.logger.debug('Upserted concept in Helix DB', { name, category });
        return name;
      } catch (error) {
        this.logger.error('Failed to upsert concept in Helix DB',
          error instanceof Error ? error : new Error(String(error)),
          { name, category }
        );
        throw error;
      }
    }, 'upsertConcept');
  }

  /**
   * Link activity to concept
   */
  async linkActivityToConcept(
    screenshotExternalId: number,
    conceptName: string,
    relevance: number = 1.0
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const client = await this.ensureInitialized();

    return this.withRetry(async () => {
      try {
        await client.query('LinkActivityToConcept', {
          screenshot_external_id: String(screenshotExternalId),
          concept_name: conceptName,
          relevance: relevance,
        });
        this.logger.debug('Linked activity to concept', { screenshotExternalId, conceptName });
      } catch (error) {
        this.logger.error('Failed to link activity to concept',
          error instanceof Error ? error : new Error(String(error)),
          { screenshotExternalId, conceptName }
        );
        throw error;
      }
    }, 'linkActivityToConcept');
  }

  /**
   * Create concept relationship (batch upsert and link)
   */
  async createConceptRelationship(relationship: ConceptRelationship): Promise<void> {
    if (!this.enabled) {
      return;
    }

    // First upsert the concept
    await this.upsertConcept(relationship.conceptName, relationship.category || 'general', relationship.relevanceScore);

    // Then link activity to concept
    await this.linkActivityToConcept(
      parseInt(relationship.activityKey.replace('activity_', '')),
      relationship.conceptName,
      relationship.relevanceScore
    );
  }

  // ============================================================================
  // CROSS-SESSION CONTEXT
  // ============================================================================

  /**
   * Get cross-session context for a user
   * @param userId - The user ID
   * @param nodeId - Optional timeline node ID for context
   * @param lookbackDays - Number of days to look back (default: 30)
   */
  async getCrossSessionContext(
    userId: number,
    nodeId?: number | string,
    lookbackDays: number = 30
  ): Promise<CrossSessionContext> {
    const emptyContext: CrossSessionContext = {
      currentNode: null,
      relatedSessions: [],
      entities: [],
      concepts: [],
      workflowPatterns: [],
      temporalSequence: [],
    };

    if (!this.enabled || !this.crossSessionEnabled) {
      return emptyContext;
    }

    const client = await this.ensureInitialized();
    const userKey = `user_${userId}`;

    // Helper to safely extract array from Helix response wrapper
    // Helix returns {"entities": [...]} or {"patterns": [...]} format
    const extractArray = (response: unknown, key: string): unknown[] => {
      if (!response) return [];
      if (Array.isArray(response)) return response;
      if (typeof response === 'object' && response !== null) {
        const obj = response as Record<string, unknown>;
        if (key in obj && Array.isArray(obj[key])) {
          return obj[key] as unknown[];
        }
        // Try common keys if specific key not found
        for (const k of ['entities', 'patterns', 'sessions', 'data', 'results']) {
          if (k in obj && Array.isArray(obj[k])) {
            return obj[k] as unknown[];
          }
        }
      }
      return [];
    };

    try {
      // Construct external_id format for Helix queries
      const nodeExternalId = nodeId
        ? (typeof nodeId === 'string' && nodeId.startsWith('node_') ? nodeId : `node_${nodeId}`)
        : null;

      // Execute all Helix queries in parallel (no PostgreSQL fallbacks)
      const [
        entitiesResponse,
        patternsResponse,
        currentNodeResult,
        relatedSessionsResponse,
        conceptsResponse,
      ] = await Promise.all([
        // Query entities via Helix cross-session context (USES edge traversal)
        this.queryWithLogging<unknown>(client, 'GetCrossSessionContext', {
          user_key: userKey,
        }).catch(err => {
          this.logger.warn('GetCrossSessionContext query failed', { error: err });
          return null;
        }),

        // Query workflow patterns via Helix
        this.queryWithLogging<unknown>(client, 'GetWorkflowPatterns', {
          user_id: userKey,
        }).catch(err => {
          this.logger.warn('GetWorkflowPatterns query failed', { error: err });
          return null;
        }),

        // Query currentNode from Helix using GetTimelineNodeByExternalId
        nodeExternalId
          ? this.queryWithLogging<unknown>(client, 'GetTimelineNodeByExternalId', {
              external_id: nodeExternalId,
            }).catch(err => {
              this.logger.warn('GetTimelineNodeByExternalId query failed', { error: err });
              return null;
            })
          : Promise.resolve(null),

        // Query relatedSessions from Helix using GetSessionsByNode or GetSessionsByUser
        nodeExternalId
          ? this.queryWithLogging<unknown>(client, 'GetSessionsByNode', {
              node_key: nodeExternalId,
            }).catch(err => {
              this.logger.warn('GetSessionsByNode query failed', { error: err });
              return null;
            })
          : this.queryWithLogging<unknown>(client, 'GetSessionsByUser', {
              user_key: userKey,
              start: 0,
              end_range: 50,
            }).catch(err => {
              this.logger.warn('GetSessionsByUser query failed', { error: err });
              return null;
            }),

        // Query concepts via Helix GetConceptsByCategory (get all categories)
        this.queryWithLogging<unknown>(client, 'GetConceptsByCategory', {
          category: '',
        }).catch(err => {
          this.logger.warn('GetConceptsByCategory query failed', { error: err });
          return null;
        }),
      ]);

      // Extract arrays from wrapped Helix responses
      const helixEntities = extractArray(entitiesResponse, 'entities');
      const patterns = extractArray(patternsResponse, 'patterns');
      const helixSessions = extractArray(relatedSessionsResponse, 'sessions');
      const helixConcepts = extractArray(conceptsResponse, 'concepts');

      // Transform Helix sessions to expected format
      const relatedSessionsResult: Array<{
        sessionId: string;
        workflowClassification: string;
        startTime: string;
        endTime: string | null;
        durationSeconds: number;
        activityCount: number;
      }> = helixSessions.map((session: any) => ({
        sessionId: session.external_id || session.sessionId || '',
        workflowClassification: session.workflow_primary || session.workflowClassification || 'unknown',
        startTime: session.start_time || session.startTime || '',
        endTime: session.end_time || session.endTime || null,
        durationSeconds: session.duration_seconds || session.durationSeconds || 0,
        activityCount: session.screenshot_count || session.activityCount || 0,
      }));

      // Transform Helix concepts to expected format
      const conceptsResult = helixConcepts.map((concept: any) => ({
        name: concept.name || '',
        category: concept.category || 'general',
        frequency: concept.relevance_score || 1,
        lastSeen: new Date().toISOString(),
      }));

      // Transform Helix entities to expected format
      const entities = helixEntities.map((entity: any) => ({
        name: entity.name || '',
        type: entity.entity_type || entity.type || 'unknown',
        frequency: entity.frequency || 1,
        usage_count: entity.frequency || 1,
        last_seen: entity.metadata || new Date().toISOString(),
        source: 'helix',
      }));

      // Build temporal sequence from sessions
      const temporalSequence = relatedSessionsResult.map((session) => ({
        sessionId: session.sessionId,
        timestamp: session.startTime,
        workflow: session.workflowClassification,
      })).sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      this.logger.info('Retrieved cross-session context from Helix', {
        userId,
        nodeId,
        lookbackDays,
        entitiesCount: entities.length,
        patternsCount: patterns.length,
        currentNodeFound: !!currentNodeResult,
        relatedSessionsCount: relatedSessionsResult.length,
        conceptsCount: conceptsResult.length,
        temporalSequenceCount: temporalSequence.length,
      });

      return {
        currentNode: currentNodeResult,
        relatedSessions: relatedSessionsResult,
        entities: entities,
        concepts: conceptsResult,
        workflowPatterns: patterns,
        temporalSequence: temporalSequence,
      };
    } catch (error) {
      this.logger.error('Failed to get cross-session context from Helix',
        error instanceof Error ? error : new Error(String(error)),
        { userId, nodeId, lookbackDays }
      );
      return emptyContext;
    }
  }

  /**
   * Search by natural language query
   * Hybrid approach: Uses PostgreSQL pgvector for semantic search + Helix for graph structure
   * Performs cosine similarity search across entity, concept, session, and activity embeddings
   */
  async searchByNaturalLanguageQuery(
    userId: number,
    query: string,
    options: {
      lookbackDays?: number;
      maxResults?: number;
      includeActivities?: boolean;
      includeSessions?: boolean;
      includeEntities?: boolean;
      includeConcepts?: boolean;
    } = {}
  ): Promise<{
    entities: Array<{
      name: string;
      type: string;
      frequency: number;
      matchScore: number;
      matchedOn: string;
    }>;
    concepts: Array<{
      name: string;
      category: string;
      frequency: number;
      matchScore: number;
      matchedOn: string;
    }>;
    sessions: Array<{
      sessionKey: string;
      externalId: string;
      summary: string;
      workflowClassification: string;
      startTime: string;
      matchScore: number;
      matchedOn: string;
    }>;
    activities: Array<{
      activityKey: string;
      summary: string;
      workflowTag: string;
      timestamp: string;
      matchScore: number;
      matchedOn: string;
    }>;
  }> {
    // Return empty results if not enabled, no pool, or no embedding service
    if (!this.enabled || !this.pool || !this.embeddingService) {
      this.logger.debug('Natural language search disabled or dependencies not available', {
        enabled: this.enabled,
        hasPool: !!this.pool,
        hasEmbeddingService: !!this.embeddingService,
      });
      return {
        entities: [],
        concepts: [],
        sessions: [],
        activities: [],
      };
    }

    this.logger.info('Helix searchByNaturalLanguageQuery (pgvector semantic search)', {
      userId,
      query,
      options,
    });

    const maxResults = options.maxResults || 20;
    const lookbackDays = options.lookbackDays || this.lookbackDays;
    const cutoffDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    const results = {
      entities: [] as Array<{
        name: string;
        type: string;
        frequency: number;
        matchScore: number;
        matchedOn: string;
      }>,
      concepts: [] as Array<{
        name: string;
        category: string;
        frequency: number;
        matchScore: number;
        matchedOn: string;
      }>,
      sessions: [] as Array<{
        sessionKey: string;
        externalId: string;
        summary: string;
        workflowClassification: string;
        startTime: string;
        matchScore: number;
        matchedOn: string;
      }>,
      activities: [] as Array<{
        activityKey: string;
        summary: string;
        workflowTag: string;
        timestamp: string;
        matchScore: number;
        matchedOn: string;
      }>,
    };

    try {
      // Generate embedding for the query
      this.logger.debug('Generating embedding for query', { query });
      const queryEmbedding = await this.embeddingService!.generateEmbedding(query);
      const embeddingArray = Array.from(queryEmbedding);
      this.logger.debug('Query embedding generated', { dimensions: embeddingArray.length });

      // Search entities using pgvector cosine similarity
      if (options.includeEntities !== false) {
        results.entities = await this.searchEntitiesInPostgres(embeddingArray, maxResults);
      }

      // Search concepts using pgvector cosine similarity
      if (options.includeConcepts !== false) {
        results.concepts = await this.searchConceptsInPostgres(embeddingArray, maxResults);
      }

      // Search sessions using pgvector cosine similarity
      if (options.includeSessions !== false) {
        results.sessions = await this.searchSessionsInPostgres(userId, embeddingArray, cutoffDate, maxResults);
      }

      // Search activities (screenshots) using pgvector cosine similarity
      if (options.includeActivities !== false) {
        results.activities = await this.searchActivitiesInPostgres(userId, embeddingArray, cutoffDate, maxResults);
      }

      this.logger.info('Natural language search completed', {
        userId,
        entitiesFound: results.entities.length,
        conceptsFound: results.concepts.length,
        sessionsFound: results.sessions.length,
        activitiesFound: results.activities.length,
      });

      return results;
    } catch (error) {
      this.logger.error('Failed to execute natural language search',
        error instanceof Error ? error : new Error(String(error)),
        { userId, query }
      );
      return results;
    }
  }

  /**
   * Search entities in PostgreSQL using pgvector cosine similarity
   */
  private async searchEntitiesInPostgres(
    queryEmbedding: number[],
    maxResults: number
  ): Promise<Array<{
    name: string;
    type: string;
    frequency: number;
    matchScore: number;
    matchedOn: string;
  }>> {
    if (!this.pool) return [];

    try {
      const embeddingString = `[${queryEmbedding.join(',')}]`;

      const result = await this.pool.query(
        `
        SELECT
          entity_name as "name",
          entity_type as "type",
          frequency,
          1 - (embedding <=> $1::vector) as "matchScore",
          'cosine_similarity' as "matchedOn"
        FROM entity_embeddings
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT $2
        `,
        [embeddingString, maxResults]
      );

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to search entities in PostgreSQL',
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }

  /**
   * Search concepts in PostgreSQL using pgvector cosine similarity
   */
  private async searchConceptsInPostgres(
    queryEmbedding: number[],
    maxResults: number
  ): Promise<Array<{
    name: string;
    category: string;
    frequency: number;
    matchScore: number;
    matchedOn: string;
  }>> {
    if (!this.pool) return [];

    try {
      const embeddingString = `[${queryEmbedding.join(',')}]`;

      const result = await this.pool.query(
        `
        SELECT
          concept_name as "name",
          category,
          frequency,
          1 - (embedding <=> $1::vector) as "matchScore",
          'cosine_similarity' as "matchedOn"
        FROM concept_embeddings
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT $2
        `,
        [embeddingString, maxResults]
      );

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to search concepts in PostgreSQL',
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }

  /**
   * Search sessions in PostgreSQL using pgvector cosine similarity
   */
  private async searchSessionsInPostgres(
    userId: number,
    queryEmbedding: number[],
    cutoffDate: Date,
    maxResults: number
  ): Promise<Array<{
    sessionKey: string;
    externalId: string;
    summary: string;
    workflowClassification: string;
    startTime: string;
    matchScore: number;
    matchedOn: string;
  }>> {
    if (!this.pool) return [];

    try {
      const embeddingString = `[${queryEmbedding.join(',')}]`;

      const result = await this.pool.query(
        `
        SELECT
          desktop_session_id as "externalId",
          desktop_session_id as "sessionKey",
          COALESCE(high_level_summary, workflow_name, '') as "summary",
          category::text as "workflowClassification",
          started_at::text as "startTime",
          1 - (summary_embedding <=> $2::vector) as "matchScore",
          'cosine_similarity' as "matchedOn"
        FROM session_mappings
        WHERE
          user_id = $1
          AND started_at >= $3
          AND summary_embedding IS NOT NULL
        ORDER BY summary_embedding <=> $2::vector
        LIMIT $4
        `,
        [userId, embeddingString, cutoffDate.toISOString(), maxResults]
      );

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to search sessions in PostgreSQL',
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }

  /**
   * Search activities (workflow screenshots) in PostgreSQL using pgvector cosine similarity
   */
  private async searchActivitiesInPostgres(
    userId: number,
    queryEmbedding: number[],
    cutoffDate: Date,
    maxResults: number
  ): Promise<Array<{
    activityKey: string;
    summary: string;
    workflowTag: string;
    timestamp: string;
    matchScore: number;
    matchedOn: string;
  }>> {
    if (!this.pool) return [];

    try {
      const embeddingString = `[${queryEmbedding.join(',')}]`;

      const result = await this.pool.query(
        `
        SELECT
          'activity_' || id::text as "activityKey",
          COALESCE(summary, '') as "summary",
          workflow_tag as "workflowTag",
          timestamp::text,
          1 - (embedding <=> $2::vector) as "matchScore",
          'cosine_similarity' as "matchedOn"
        FROM workflow_screenshots
        WHERE
          user_id = $1
          AND timestamp >= $3
          AND embedding IS NOT NULL
        ORDER BY embedding <=> $2::vector
        LIMIT $4
        `,
        [userId, embeddingString, cutoffDate.toISOString(), maxResults]
      );

      return result.rows;
    } catch (error) {
      this.logger.error('Failed to search activities in PostgreSQL',
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }


  // ============================================================================
  // WORKFLOW PATTERN OPERATIONS
  // ============================================================================

  /**
   * Upsert workflow pattern
   */
  async upsertWorkflowPattern(pattern: WorkflowPatternData): Promise<unknown> {
    if (!this.enabled) {
      return null;
    }

    const client = await this.ensureInitialized();

    return this.withRetry(async () => {
      try {
        const result = await client.query('UpsertWorkflowPattern', {
          user_id: pattern.userId,
          intent_category: pattern.intentCategory,
          occurrence_count: pattern.occurrenceCount,
          metadata: JSON.stringify(pattern.metadata || {}),
        });

        this.logger.debug('Upserted workflow pattern', { pattern });
        return result;
      } catch (error) {
        this.logger.error('Failed to upsert workflow pattern',
          error instanceof Error ? error : new Error(String(error))
        );
        throw error;
      }
    }, 'upsertWorkflowPattern');
  }

  /**
   * Get workflow patterns for user
   */
  async getWorkflowPatterns(userId: string): Promise<unknown[]> {
    if (!this.enabled) {
      return [];
    }

    const client = await this.ensureInitialized();

    try {
      const result = await client.query<unknown[]>('GetWorkflowPatterns', {
        user_id: userId,
      });
      return result || [];
    } catch (error) {
      this.logger.error('Failed to get workflow patterns',
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }

  // ============================================================================
  // BLOCK OPERATIONS
  // ============================================================================

  /**
   * Upsert block
   */
  async upsertBlock(block: BlockData): Promise<unknown> {
    if (!this.enabled) {
      return null;
    }

    const client = await this.ensureInitialized();

    return this.withRetry(async () => {
      try {
        const result = await client.query('UpsertBlock', {
          user_id: block.userId,
          canonical_slug: block.canonicalSlug,
          intent_label: block.intentLabel,
          primary_tool: block.primaryTool,
          occurrence_count: block.occurrenceCount,
          metadata: JSON.stringify(block.metadata || {}),
        });

        this.logger.debug('Upserted block', { block });
        return result;
      } catch (error) {
        this.logger.error('Failed to upsert block',
          error instanceof Error ? error : new Error(String(error))
        );
        throw error;
      }
    }, 'upsertBlock');
  }

  /**
   * Get blocks by user
   */
  async getBlocksByUser(userId: string): Promise<unknown[]> {
    if (!this.enabled) {
      return [];
    }

    const client = await this.ensureInitialized();

    try {
      const result = await client.query<unknown[]>('GetBlocksByUser', {
        user_id: userId,
      });
      return result || [];
    } catch (error) {
      this.logger.error('Failed to get blocks by user',
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }

  // ============================================================================
  // TOOL OPERATIONS
  // ============================================================================

  /**
   * Upsert tool
   */
  async upsertTool(canonicalName: string, category: string, metadata?: Record<string, unknown>): Promise<unknown> {
    if (!this.enabled) {
      return null;
    }

    const client = await this.ensureInitialized();

    return this.withRetry(async () => {
      try {
        const result = await client.query('UpsertTool', {
          canonical_name: canonicalName,
          category: category,
          metadata: JSON.stringify(metadata || {}),
        });

        this.logger.debug('Upserted tool', { canonicalName, category });
        return result;
      } catch (error) {
        this.logger.error('Failed to upsert tool',
          error instanceof Error ? error : new Error(String(error))
        );
        throw error;
      }
    }, 'upsertTool');
  }

  // ============================================================================
  // VECTOR SEARCH OPERATIONS
  // ============================================================================

  /**
   * Search similar activities by embedding
   */
  async searchSimilarActivities(queryEmbedding: number[], limit: number = 10): Promise<unknown[]> {
    if (!this.enabled) {
      return [];
    }

    const client = await this.ensureInitialized();

    try {
      const result = await client.query<unknown[]>('SearchSimilarActivities', {
        query_embedding: queryEmbedding,
        limit: limit,
      });
      return result || [];
    } catch (error) {
      this.logger.error('Failed to search similar activities',
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }

  /**
   * Search similar concepts by embedding
   */
  async searchSimilarConcepts(queryEmbedding: number[], limit: number = 10): Promise<unknown[]> {
    if (!this.enabled) {
      return [];
    }

    const client = await this.ensureInitialized();

    try {
      const result = await client.query<unknown[]>('SearchSimilarConcepts', {
        query_embedding: queryEmbedding,
        limit: limit,
      });
      return result || [];
    } catch (error) {
      this.logger.error('Failed to search similar concepts',
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }

  // ============================================================================
  // MIGRATION METHODS (Stubs - not needed for Helix as it has no legacy data)
  // ============================================================================

  /**
   * Get migration status - returns no migration needed for Helix
   * This is a compatibility method for ArangoDB migration endpoints
   */
  async getMigrationStatus(): Promise<{
    totalActivities: number;
    needsMigration: number;
    alreadyCorrect: number;
  }> {
    if (!this.enabled) {
      return { totalActivities: 0, needsMigration: 0, alreadyCorrect: 0 };
    }

    // For Helix, we don't have legacy data migration needs
    // All new data is stored correctly from the start
    // No need to query - just return that everything is correct
    this.logger.info('Migration status check (Helix DB - no migration needed)');
    return {
      totalActivities: 0, // Not tracked for Helix as all data is correct from start
      needsMigration: 0,
      alreadyCorrect: 0,
    };
  }

  /**
   * Migrate activity session keys - no-op for Helix
   * This is a compatibility method for ArangoDB migration endpoints
   */
  async migrateActivitySessionKeys(): Promise<{
    updated: number;
    failed: number;
    errors: string[];
  }> {
    // For Helix, no migration is needed
    // All data is stored correctly from the start
    this.logger.info('Migration not needed for Helix DB - all data is already in correct format');
    return {
      updated: 0,
      failed: 0,
      errors: [],
    };
  }

  // ============================================================================
  // HEALTH CHECK
  // ============================================================================

  /**
   * Check Helix DB connection health
   */
  async healthCheck(): Promise<boolean> {
    if (!this.enabled) {
      return true; // Return true if disabled, as it's not an error state
    }

    try {
      const client = await this.ensureInitialized();
      await client.query('HealthCheck', {});
      return true;
    } catch (error) {
      this.logger.warn('Helix DB health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Check if service is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Check if cross-session context is enabled
   */
  isCrossSessionEnabled(): boolean {
    return this.crossSessionEnabled;
  }

  // ============================================================================
  // PEER AND PATTERN DETECTION (Helix-based)
  // ============================================================================

  /**
   * Get peer workflow patterns from other users (anonymized).
   * Uses Helix to find similar workflows across ALL users based on workflow classification.
   * Returns anonymized data suitable for A3 Comparator peer comparison.
   */
  async getPeerWorkflowPatterns(
    excludeUserId: number,
    options: {
      workflowType?: string;
      entities?: string[];
      minOccurrences?: number;
      limit?: number;
    } = {}
  ): Promise<Array<{
    workflowType: string;
    avgDurationSeconds: number;
    occurrenceCount: number;
    uniqueUserCount: number;
    commonEntities: string[];
    commonTransitions: Array<{ from: string; to: string; frequency: number }>;
  }>> {
    if (!this.enabled) {
      this.logger.debug('getPeerWorkflowPatterns: Helix not enabled');
      return [];
    }

    const { workflowType, minOccurrences = 3, limit = 10 } = options;
    const excludeUserKey = `user_${excludeUserId}`;

    this.logger.info('Retrieving peer workflow patterns from Helix sessions', {
      excludeUserId,
      workflowType,
      minOccurrences,
      limit,
    });

    try {
      const client = await this.ensureInitialized();

      // Query sessions from all users except the excluded one
      const sessionsResponse = await this.queryWithLogging<unknown>(client, 'GetAllSessionsExcludingUser', {
        exclude_user_key: excludeUserKey,
        start: 0,
        end_range: 500, // Get a reasonable sample of peer sessions
      });

      // Extract sessions array
      const extractArray = (response: unknown, key: string): unknown[] => {
        if (!response) return [];
        if (Array.isArray(response)) return response;
        if (typeof response === 'object' && response !== null) {
          const obj = response as Record<string, unknown>;
          if (key in obj && Array.isArray(obj[key])) {
            return obj[key] as unknown[];
          }
          for (const k of ['sessions', 'data', 'results']) {
            if (k in obj && Array.isArray(obj[k])) {
              return obj[k] as unknown[];
            }
          }
        }
        return [];
      };

      const allSessions = extractArray(sessionsResponse, 'sessions');

      // Aggregate sessions by workflow_primary
      const patternMap = new Map<string, {
        workflowType: string;
        totalDuration: number;
        occurrenceCount: number;
        userIds: Set<string>;
      }>();

      for (const session of allSessions) {
        const s = session as {
          user_key?: string;
          workflow_primary?: string;
          duration_seconds?: number;
        };

        const workflow = s.workflow_primary || 'unknown';

        // Filter by workflowType if specified
        if (workflowType && workflow !== workflowType) continue;

        const existing = patternMap.get(workflow);

        if (existing) {
          existing.occurrenceCount += 1;
          existing.totalDuration += s.duration_seconds || 0;
          if (s.user_key) existing.userIds.add(s.user_key);
        } else {
          patternMap.set(workflow, {
            workflowType: workflow,
            totalDuration: s.duration_seconds || 0,
            occurrenceCount: 1,
            userIds: new Set(s.user_key ? [s.user_key] : []),
          });
        }
      }

      // Convert to result format and filter by minOccurrences
      const patterns = Array.from(patternMap.values())
        .filter(p => p.occurrenceCount >= minOccurrences && p.userIds.size >= 2)
        .map(p => ({
          workflowType: p.workflowType,
          avgDurationSeconds: p.occurrenceCount > 0 ? Math.round(p.totalDuration / p.occurrenceCount) : 0,
          occurrenceCount: p.occurrenceCount,
          uniqueUserCount: p.userIds.size,
          commonEntities: [],
          commonTransitions: [],
        }))
        .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
        .slice(0, limit);

      this.logger.info('Retrieved peer workflow patterns from Helix', {
        patternCount: patterns.length,
        totalSessionsAnalyzed: allSessions.length,
        topPattern: patterns[0]?.workflowType,
      });

      return patterns;
    } catch (error) {
      this.logger.error('Failed to get peer workflow patterns from Helix',
        error instanceof Error ? error : new Error(String(error)),
        { excludeUserId }
      );
      return [];
    }
  }

  /**
   * Detect repetitive workflow patterns for a specific user.
   * Uses Helix native AGGREGATE_BY to analyze user's workflow history for recurring sequences.
   */
  async detectRepetitiveWorkflowPatterns(
    userId: number,
    options: {
      lookbackDays?: number;
      minOccurrences?: number;
      minSequenceLength?: number;
      maxSequenceLength?: number;
    } = {}
  ): Promise<Array<{
    patternType: 'workflow_sequence' | 'tool_combination' | 'entity_access';
    sequence: string[];
    occurrenceCount: number;
    avgDurationSeconds: number;
    totalTimeSpentSeconds: number;
    firstSeen: string;
    lastSeen: string;
    sessions: string[];
    optimizationOpportunity: string;
  }>> {
    if (!this.enabled) {
      this.logger.debug('detectRepetitiveWorkflowPatterns: Helix not enabled');
      return [];
    }

    const { minOccurrences = 3 } = options;
    const userKey = `user_${userId}`;

    this.logger.info('Detecting repetitive workflow patterns from Helix using AGGREGATE_BY', {
      userId,
      minOccurrences,
    });

    try {
      const client = await this.ensureInitialized();

      // Use Helix native AGGREGATE_BY to group sessions by workflow_primary
      const aggregateResponse = await this.queryWithLogging<unknown>(client, 'AggregateSessionsByWorkflow', {
        user_key: userKey,
      });

      // Extract aggregated groups from response
      // AGGREGATE_BY returns: [{ count: N, data: [...sessions with workflow_primary] }, ...]
      const extractAggregates = (response: unknown): Array<{
        workflowType: string;
        count: number;
        sessions: unknown[];
      }> => {
        if (!response || !Array.isArray(response)) return [];

        return response.map((group: { count?: number; data?: Array<{ workflow_primary?: string }> }) => ({
          workflowType: group.data?.[0]?.workflow_primary || 'unknown',
          count: group.count || 0,
          sessions: group.data || [],
        }));
      };

      // Debug: Log raw response to understand format
      this.logger.info('AggregateSessionsByWorkflow raw response debug', {
        isArray: Array.isArray(aggregateResponse),
        responseType: typeof aggregateResponse,
        responseKeys: aggregateResponse && typeof aggregateResponse === 'object' && !Array.isArray(aggregateResponse)
          ? Object.keys(aggregateResponse as Record<string, unknown>)
          : null,
        rawResponsePreview: JSON.stringify(aggregateResponse).slice(0, 1000),
      });

      const aggregates = extractAggregates(aggregateResponse);

      this.logger.info('Extracted aggregates before minOccurrences filter', {
        aggregateCount: aggregates.length,
        aggregates: aggregates.map(a => ({ workflowType: a.workflowType, count: a.count })),
        minOccurrences,
      });

      // Convert to result format and filter by minOccurrences
      const patterns = aggregates
        .filter(agg => agg.count >= minOccurrences)
        .map(agg => {
          // Calculate duration stats from sessions
          let totalDuration = 0;
          let firstSeen = new Date();
          let lastSeen = new Date(0);
          const sessionIds: string[] = [];

          for (const session of agg.sessions) {
            const s = session as {
              external_id?: string;
              duration_seconds?: number;
              start_time?: string;
              end_time?: string;
            };
            totalDuration += s.duration_seconds || 0;
            if (s.external_id) sessionIds.push(s.external_id);
            const startTime = s.start_time ? new Date(s.start_time) : new Date();
            const endTime = s.end_time ? new Date(s.end_time) : startTime;
            if (startTime < firstSeen) firstSeen = startTime;
            if (endTime > lastSeen) lastSeen = endTime;
          }

          return {
            patternType: 'workflow_sequence' as const,
            sequence: [agg.workflowType],
            occurrenceCount: agg.count,
            avgDurationSeconds: agg.count > 0 ? Math.round(totalDuration / agg.count) : 0,
            totalTimeSpentSeconds: totalDuration,
            firstSeen: firstSeen.toISOString(),
            lastSeen: lastSeen.toISOString(),
            sessions: sessionIds,
            optimizationOpportunity: agg.count >= 5
              ? `High-frequency pattern: "${agg.workflowType}" repeated ${agg.count} times. Consider automation or templating.`
              : `Moderate frequency pattern: "${agg.workflowType}" found ${agg.count} times.`,
          };
        })
        .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
        .slice(0, 10);

      this.logger.info('Detected repetitive workflow patterns from Helix', {
        patternCount: patterns.length,
        topPattern: patterns[0]?.sequence.join(' → '),
      });

      return patterns;
    } catch (error) {
      this.logger.error('Failed to detect repetitive workflow patterns from Helix',
        error instanceof Error ? error : new Error(String(error)),
        { userId }
      );
      return [];
    }
  }
}
