/**
 * ArangoDB Graph Service for Workflow Analysis
 *
 * Manages the knowledge graph for cross-session workflow analysis:
 * - User, Node, Session, Activity nodes
 * - Entity and Concept extraction
 * - Relationship creation and traversal
 * - Cross-session context queries
 */

import { aql, type Database } from 'arangojs';

import type { Logger } from '../core/logger.js';
import { ArangoDBConnection } from '../config/arangodb.connection.js';

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
  metadata?: Record<string, any>;
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
  currentNode: any;
  relatedSessions: any[];
  entities: any[];
  concepts: any[];
  workflowPatterns: any[];
  temporalSequence: any[];
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
  metadata?: Record<string, any>;
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

// ============================================================================
// ARANGODB GRAPH SERVICE
// ============================================================================

export class ArangoDBGraphService {
  private db: Database | null = null;
  private logger: Logger;
  private enabled: boolean;
  private crossSessionEnabled: boolean;

  constructor({ logger }: { logger: Logger }) {
    this.logger = logger;
    this.enabled = process.env.ENABLE_GRAPH_RAG?.toLowerCase() === 'true';
    this.crossSessionEnabled = process.env.ENABLE_CROSS_SESSION_CONTEXT?.toLowerCase() === 'true';
  }

  /**
   * Ensure database connection is initialized
   */
  private async ensureInitialized(): Promise<Database> {
    if (!this.db) {
      this.db = await ArangoDBConnection.getConnection();
    }
    return this.db;
  }

  /**
   * Retry wrapper for ArangoDB operations that may encounter lock contention
   * Handles "timeout waiting to lock key" and "write-write conflict" errors
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
          errorMessage.includes('timeout waiting to lock key') ||
          errorMessage.includes('write-write conflict');

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
  async upsertUser(
    userId: number,
    metadata?: Record<string, any>
  ): Promise<string> {
    const db = await this.ensureInitialized();
    const userKey = `user_${userId}`;

    return this.withRetry(async () => {
      try {
        const query = aql`
          UPSERT { _key: ${userKey} }
          INSERT {
            _key: ${userKey},
            external_id: ${userId},
            created_at: DATE_ISO8601(DATE_NOW()),
            metadata: ${metadata || {}}
          }
          UPDATE {
            metadata: ${metadata || {}}
          }
          IN users
          RETURN NEW
        `;

        const cursor = await db.query(query);
        const result = await cursor.next();

        this.logger.debug('Upserted user in ArangoDB', { userId, userKey });
        return result._key;
      } catch (error) {
        this.logger.error('Failed to upsert user in ArangoDB', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }, `upsertUser(${userId})`);
  }

  // ============================================================================
  // TIMELINE NODE OPERATIONS
  // ============================================================================

  /**
   * Upsert timeline node
   */
  async upsertTimelineNode(
    nodeId: number | string,
    userId: number,
    nodeData: { type: string; title: string; metadata?: Record<string, any> }
  ): Promise<string> {
    const db = await this.ensureInitialized();
    // Normalize nodeId to string, remove hyphens for ArangoDB key
    const nodeKeyId = typeof nodeId === 'string' ? nodeId.replace(/-/g, '_') : nodeId.toString();
    const nodeKey = `node_${nodeKeyId}`;
    const userKey = `user_${userId}`;

    return this.withRetry(async () => {
      try {
        const query = aql`
          UPSERT { _key: ${nodeKey} }
          INSERT {
            _key: ${nodeKey},
            external_id: ${nodeId},
            user_key: ${userKey},
            type: ${nodeData.type},
            title: ${nodeData.title},
            created_at: DATE_ISO8601(DATE_NOW()),
            metadata: ${nodeData.metadata || {}}
          }
          UPDATE {
            type: ${nodeData.type},
            title: ${nodeData.title},
            metadata: ${nodeData.metadata || {}}
          }
          IN timeline_nodes
          RETURN NEW
        `;

        const cursor = await db.query(query);
        const result = await cursor.next();

        this.logger.debug('Upserted timeline node', { nodeId, userKey });
        return result._key;
      } catch (error) {
        this.logger.error('Failed to upsert timeline node', {
          nodeId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }, `upsertTimelineNode(${nodeId})`);
  }

  // ============================================================================
  // SESSION OPERATIONS
  // ============================================================================

  /**
   * Upsert session and create relationships
   */
  async upsertSession(sessionData: SessionData): Promise<string> {
    const db = await this.ensureInitialized();
    const sessionKey = `session_${sessionData.externalId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const userKey = `user_${sessionData.userId}`;
    // Normalize nodeId - replace hyphens with underscores to match timeline_nodes key format
    const nodeKeyId = typeof sessionData.nodeId === 'string'
      ? sessionData.nodeId.replace(/-/g, '_')
      : sessionData.nodeId.toString();
    const nodeKey = `node_${nodeKeyId}`;

    return this.withRetry(async () => {
      try {
        // Upsert session
        const query = aql`
          UPSERT { _key: ${sessionKey} }
          INSERT {
            _key: ${sessionKey},
            external_id: ${sessionData.externalId},
            user_key: ${userKey},
            node_key: ${nodeKey},
            start_time: ${sessionData.startTime.toISOString()},
            end_time: ${sessionData.endTime?.toISOString() || null},
            duration_seconds: ${sessionData.durationSeconds || 0},
            screenshot_count: ${sessionData.screenshotCount || 0},
            workflow_classification: ${sessionData.workflowClassification || {}},
            metadata: ${sessionData.metadata || {}}
          }
          UPDATE {
            end_time: ${sessionData.endTime?.toISOString() || null},
            duration_seconds: ${sessionData.durationSeconds || 0},
            screenshot_count: ${sessionData.screenshotCount || 0},
            workflow_classification: ${sessionData.workflowClassification || {}},
            metadata: ${sessionData.metadata || {}}
          }
          IN sessions
          RETURN NEW
        `;

        const cursor = await db.query(query);
        const result = await cursor.next();

        // Create BELONGS_TO edge (session -> node)
        await this.createEdge('BELONGS_TO', sessionKey, nodeKey, {
          created_at: new Date().toISOString(),
        });

        // Create CONTAINS edge (node -> session)
        await this.createEdge('CONTAINS', nodeKey, sessionKey, {
          created_at: new Date().toISOString(),
        });

        this.logger.debug('Upserted session', { sessionKey, nodeKey });
        return result._key;
      } catch (error) {
        this.logger.error('Failed to upsert session', {
          sessionData,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }, `upsertSession(${sessionData.externalId})`);
  }

  /**
   * Get all sessions for a user from ArangoDB
   */
  async getSessionsByUser(userId: number): Promise<Array<{ externalId: string; _key: string }>> {
    const db = await this.ensureInitialized();
    const userKey = `user_${userId}`;

    try {
      const query = aql`
        FOR s IN sessions
          FILTER s.user_key == ${userKey}
          RETURN { externalId: s.external_id, _key: s._key }
      `;

      const cursor = await db.query(query);
      const results = await cursor.all();

      this.logger.debug('Retrieved sessions for user', {
        userId,
        count: results.length,
      });

      return results;
    } catch (error) {
      this.logger.error('Failed to get sessions for user', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update session sequence (create FOLLOWS edges)
   */
  async updateSessionSequence(sessionId: string): Promise<void> {
    const db = await this.ensureInitialized();
    const sessionKey = `session_${sessionId.replace(/[^a-zA-Z0-9]/g, '_')}`;

    try {
      // Find the previous session for the same user and create FOLLOWS edge
      const query = aql`
        LET current_session = DOCUMENT(sessions, ${sessionKey})

        LET previous_session = FIRST(
          FOR s IN sessions
            FILTER s.user_key == current_session.user_key
            FILTER s.start_time < current_session.start_time
            SORT s.start_time DESC
            LIMIT 1
            RETURN s
        )

        FILTER previous_session != null

        LET time_gap = DATE_DIFF(
          previous_session.end_time || previous_session.start_time,
          current_session.start_time,
          's'
        )

        INSERT {
          _from: CONCAT('sessions/', previous_session._key),
          _to: CONCAT('sessions/', current_session._key),
          time_gap_seconds: time_gap,
          context_preserved: time_gap < 3600,
          workflow_transition: CONCAT(
            previous_session.workflow_classification.primary || 'unknown',
            ' → ',
            current_session.workflow_classification.primary || 'unknown'
          )
        } INTO FOLLOWS
        OPTIONS { overwriteMode: "ignore" }

        RETURN NEW
      `;

      await db.query(query);
      this.logger.debug('Updated session sequence', { sessionKey });
    } catch (error) {
      this.logger.warn('Failed to update session sequence (non-critical)', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - this is a non-critical operation
    }
  }

  // ============================================================================
  // ACTIVITY OPERATIONS
  // ============================================================================

  /**
   * Upsert activity node
   */
  async upsertActivity(activityData: ActivityNode): Promise<string> {
    const db = await this.ensureInitialized();
    const activityKey = `activity_${activityData.screenshotExternalId}`;

    return this.withRetry(async () => {
      try {
        const query = aql`
          UPSERT { _key: ${activityKey} }
          INSERT {
            _key: ${activityKey},
            session_key: ${activityData.sessionKey},
            screenshot_external_id: ${activityData.screenshotExternalId},
            timestamp: ${activityData.timestamp.toISOString()},
            workflow_tag: ${activityData.workflowTag},
            summary: ${activityData.summary},
            confidence: ${activityData.confidence},
            metadata: ${activityData.metadata || {}}
          }
          UPDATE {
            workflow_tag: ${activityData.workflowTag},
            summary: ${activityData.summary},
            confidence: ${activityData.confidence},
            metadata: ${activityData.metadata || {}}
          }
          IN activities
          RETURN NEW
        `;

        const cursor = await db.query(query);
        const result = await cursor.next();

        this.logger.debug('Upserted activity', { activityKey });
        return result._key;
      } catch (error) {
        this.logger.error('Failed to upsert activity', {
          activityData,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }, `upsertActivity(${activityData.screenshotExternalId})`);
  }

  /**
   * Link activity to session (no-op for ArangoDB - uses session_key property instead)
   * This method exists for compatibility with HelixGraphService
   */
  async linkActivityToSession(_screenshotExternalId: number | string, _sessionExternalId: string): Promise<void> {
    // ArangoDB uses session_key property on activity document, not a separate edge
    // This is a no-op for ArangoDB compatibility
    return;
  }

  // ============================================================================
  // ENTITY OPERATIONS
  // ============================================================================

  /**
   * Create entity relationship
   */
  async createEntityRelationship(
    relationshipData: EntityRelationship
  ): Promise<void> {
    try {
      // Upsert entity
      const entityKey = await this.upsertEntity(
        relationshipData.entityName,
        relationshipData.entityType
      );

      // Create USES edge
      await this.createEdge('USES', relationshipData.activityKey, entityKey, {
        confidence: relationshipData.confidence,
        context: relationshipData.context,
      });

      this.logger.debug('Created entity relationship', {
        activity: relationshipData.activityKey,
        entity: entityKey,
      });
    } catch (error) {
      this.logger.error('Failed to create entity relationship', {
        relationshipData,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Upsert entity node
   */
  async upsertEntity(name: string, type: string, metadata?: Record<string, unknown>): Promise<string> {
    const db = await this.ensureInitialized();
    const entityKey = `entity_${name.replace(/[^a-zA-Z0-9]/g, '_')}_${type}`;

    return this.withRetry(async () => {
      const query = aql`
        UPSERT { _key: ${entityKey} }
        INSERT {
          _key: ${entityKey},
          type: ${type},
          name: ${name},
          category: ${type},
          first_seen: DATE_ISO8601(DATE_NOW()),
          last_seen: DATE_ISO8601(DATE_NOW()),
          frequency: 1,
          metadata: ${metadata || {}}
        }
        UPDATE {
          last_seen: DATE_ISO8601(DATE_NOW()),
          frequency: OLD.frequency + 1,
          metadata: ${metadata || {}}
        }
        IN entities
        RETURN NEW
      `;

      const cursor = await db.query(query);
      const result = await cursor.next();
      return result._key;
    }, `upsertEntity(${name})`);
  }

  // ============================================================================
  // CONCEPT OPERATIONS
  // ============================================================================

  /**
   * Create concept relationship
   */
  async createConceptRelationship(
    relationshipData: ConceptRelationship
  ): Promise<void> {
    try {
      const conceptKey = await this.upsertConcept(
        relationshipData.conceptName,
        relationshipData.category
      );

      await this.createEdge(
        'RELATES_TO',
        relationshipData.activityKey,
        conceptKey,
        {
          relevance_score: relationshipData.relevanceScore,
          extracted_from: 'summary',
        }
      );

      this.logger.debug('Created concept relationship', {
        activity: relationshipData.activityKey,
        concept: conceptKey,
      });
    } catch (error) {
      this.logger.error('Failed to create concept relationship', {
        relationshipData,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Upsert concept node
   */
  async upsertConcept(
    name: string,
    category?: string
  ): Promise<string> {
    const db = await this.ensureInitialized();
    const conceptKey = `concept_${name.replace(/[^a-zA-Z0-9]/g, '_')}`;

    return this.withRetry(async () => {
      const query = aql`
        UPSERT { _key: ${conceptKey} }
        INSERT {
          _key: ${conceptKey},
          type: 'concept',
          name: ${name},
          category: ${category || 'general'},
          first_seen: DATE_ISO8601(DATE_NOW()),
          metadata: {}
        }
        UPDATE {
          metadata: OLD.metadata
        }
        IN concepts
        RETURN NEW
      `;

      const cursor = await db.query(query);
      const result = await cursor.next();
      return result._key;
    }, `upsertConcept(${name})`);
  }

  // ============================================================================
  // EDGE OPERATIONS
  // ============================================================================

  /**
   * Create edge between two nodes
   */
  private async createEdge(
    collection: string,
    from: string,
    to: string,
    properties: Record<string, any> = {}
  ): Promise<void> {
    const db = await this.ensureInitialized();

    // Ensure from/to have collection prefix
    const fromId = from.includes('/')
      ? from
      : `${this.guessCollection(from)}/${from}`;
    const toId = to.includes('/') ? to : `${this.guessCollection(to)}/${to}`;

    // Build edge document with _from, _to and additional properties
    const edgeDoc = {
      _from: fromId,
      _to: toId,
      ...properties,
    };

    const edgeCollection = db.collection(collection);

    await this.withRetry(async () => {
      try {
        // Use collection.save() instead of AQL INSERT for simpler edge creation
        await edgeCollection.save(edgeDoc, { overwriteMode: 'ignore' });
      } catch (error: any) {
        // Ignore duplicate edge errors but rethrow lock/conflict errors for retry
        if (error.message?.includes('timeout waiting to lock key') ||
            (error.message?.includes('write-write conflict') && !error.message?.includes('unique constraint'))) {
          throw error;
        }
        // Ignore duplicate edge errors
        if (!error.message?.includes('unique constraint') && !error.message?.includes('conflict')) {
          this.logger.error('Failed to create edge', {
            collection,
            from: fromId,
            to: toId,
            error: error.message,
          });
          throw error;
        }
      }
    }, `createEdge(${collection}, ${from}, ${to})`);
  }

  /**
   * Guess collection name from key prefix
   */
  private guessCollection(key: string): string {
    if (key.startsWith('user_')) return 'users';
    if (key.startsWith('node_')) return 'timeline_nodes';
    if (key.startsWith('session_')) return 'sessions';
    if (key.startsWith('activity_')) return 'activities';
    if (key.startsWith('entity_')) return 'entities';
    if (key.startsWith('concept_')) return 'concepts';
    throw new Error(`Cannot guess collection for key: ${key}`);
  }

  // ============================================================================
  // CROSS-SESSION CONTEXT QUERIES
  // ============================================================================

  /**
   * Get cross-session context for workflow analysis
   */
  async getCrossSessionContext(
    userId: number,
    nodeId: number | string,
    lookbackDays: number = 30
  ): Promise<CrossSessionContext> {
    const db = await this.ensureInitialized();
    // Normalize nodeId to string, remove hyphens for ArangoDB key (same as upsertTimelineNode)
    const nodeKeyId = typeof nodeId === 'string' ? nodeId.replace(/-/g, '_') : nodeId.toString();
    const nodeKey = `node_${nodeKeyId}`;
    const userKey = `user_${userId}`;

    try {
      const query = aql`
        LET current_node = DOCUMENT(timeline_nodes, ${nodeKey})

        // Get all sessions for this node (CONTAINS edge: timeline_node -> session)
        LET node_sessions = (
          FOR session IN 1..1 OUTBOUND current_node CONTAINS
            SORT session.start_time DESC
            RETURN session
        )

        // Get previous sessions from other nodes (last N days)
        LET related_sessions = (
          FOR session IN sessions
            FILTER session.user_key == ${userKey}
            FILTER session.node_key != ${nodeKey}
            FILTER DATE_DIFF(session.start_time, DATE_NOW(), 'd') >= ${-lookbackDays}
            SORT session.start_time DESC
            LIMIT 20
            RETURN session
        )

        // Get entities used across all sessions (limit to top 50 by usage)
        LET entities = (
          FOR session IN APPEND(node_sessions, related_sessions)
            FOR activity IN activities
              FILTER activity.session_key == session._key
              FOR entity IN 1..1 OUTBOUND activity USES
                COLLECT e = entity
                AGGREGATE count = COUNT(1)
                SORT count DESC
                LIMIT 50
                RETURN MERGE(e, { usage_count: count })
        )

        // Get concepts (limit to top 50 by mention count)
        LET concepts = (
          FOR session IN APPEND(node_sessions, related_sessions)
            FOR activity IN activities
              FILTER activity.session_key == session._key
              FOR concept IN 1..1 OUTBOUND activity RELATES_TO
                COLLECT c = concept
                AGGREGATE count = COUNT(1)
                SORT count DESC
                LIMIT 50
                RETURN MERGE(c, { mention_count: count })
        )

        // Get workflow patterns
        LET workflow_patterns = (
          FOR session IN node_sessions
            FOR next IN 1..1 OUTBOUND session FOLLOWS
              COLLECT transition = CONCAT(
                session.workflow_classification.primary,
                ' → ',
                next.workflow_classification.primary
              )
              AGGREGATE count = COUNT(1)
              RETURN {
                transition: transition,
                frequency: count
              }
        )

        // Get temporal sequence
        LET temporal_sequence = (
          FOR session IN node_sessions
            SORT session.start_time ASC
            RETURN {
              session_key: session._key,
              start_time: session.start_time,
              workflow: session.workflow_classification.primary
            }
        )

        RETURN {
          currentNode: current_node,
          relatedSessions: related_sessions,
          entities: entities,
          concepts: concepts,
          workflowPatterns: workflow_patterns,
          temporalSequence: temporal_sequence
        }
      `;

      const cursor = await db.query(query);
      const result = await cursor.next();

      this.logger.info('Retrieved cross-session context', {
        userId,
        nodeId,
        entitiesCount: result.entities.length,
        conceptsCount: result.concepts.length,
      });

      return result as CrossSessionContext;
    } catch (error) {
      this.logger.error('Failed to get cross-session context', {
        userId,
        nodeId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get workflow patterns for a user
   */
  async getWorkflowPatterns(
    userId: number,
    timeRangeStart?: Date,
    minFrequency: number = 3
  ): Promise<any[]> {
    const db = await this.ensureInitialized();
    const userKey = `user_${userId}`;

    try {
      const query = aql`
        FOR session IN sessions
          FILTER session.user_key == ${userKey}
          ${timeRangeStart ? aql`FILTER session.start_time >= ${timeRangeStart.toISOString()}` : aql``}

          FOR next IN 1..1 OUTBOUND session FOLLOWS
            COLLECT transition = CONCAT(
              session.workflow_classification.primary,
              ' → ',
              next.workflow_classification.primary
            )
            AGGREGATE
              count = COUNT(1),
              avg_gap = AVG(DATE_DIFF(session.end_time, next.start_time, 's'))

            FILTER count >= ${minFrequency}

            SORT count DESC
            RETURN {
              transition: transition,
              frequency: count,
              average_gap_minutes: avg_gap / 60
            }
      `;

      const cursor = await db.query(query);
      const results = await cursor.all();

      this.logger.debug('Retrieved workflow patterns', {
        userId,
        patternsCount: results.length,
      });

      return results;
    } catch (error) {
      this.logger.error('Failed to get workflow patterns', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get frequently used entities for a user
   */
  async getFrequentEntities(
    userId: number,
    limit: number = 20,
    minFrequency: number = 2
  ): Promise<any[]> {
    const db = await this.ensureInitialized();
    const userKey = `user_${userId}`;

    try {
      const query = aql`
        FOR session IN sessions
          FILTER session.user_key == ${userKey}
          FOR activity IN activities
            FILTER activity.session_key == session._key
            FOR entity IN 1..1 OUTBOUND activity USES
              FILTER entity.frequency >= ${minFrequency}
              SORT entity.frequency DESC
              LIMIT ${limit}
              RETURN {
                name: entity.name,
                type: entity.type,
                frequency: entity.frequency,
                last_seen: entity.last_seen
              }
      `;

      const cursor = await db.query(query);
      const results = await cursor.all();

      return results;
    } catch (error) {
      this.logger.error('Failed to get frequent entities', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // ============================================================================
  // MIGRATION UTILITIES
  // ============================================================================

  /**
   * Fix activities with incorrect session_key format
   *
   * This migration fixes activities that were created with raw sessionId
   * instead of the proper ArangoDB _key format (session_xxx_xxx)
   */
  async migrateActivitySessionKeys(): Promise<{
    updated: number;
    failed: number;
    errors: string[];
  }> {
    const db = await this.ensureInitialized();

    try {
      // Find all activities that have session_key without "session_" prefix
      // and update them to use the correct format
      const query = aql`
        FOR activity IN activities
          // Only fix activities that don't have the session_ prefix
          FILTER !STARTS_WITH(activity.session_key, "session_")

          // Build the correct session_key by:
          // 1. Replacing non-alphanumeric chars with underscores
          // 2. Prefixing with "session_"
          LET correctedKey = CONCAT(
            "session_",
            SUBSTITUTE(activity.session_key, ["-", "."], ["_", "_"])
          )

          UPDATE activity WITH {
            session_key: correctedKey,
            _migrated_session_key: true,
            _original_session_key: activity.session_key
          } IN activities

          RETURN {
            activityKey: activity._key,
            oldSessionKey: activity.session_key,
            newSessionKey: correctedKey
          }
      `;

      const cursor = await db.query(query);
      const results = await cursor.all();

      this.logger.info('Activity session_key migration complete', {
        updated: results.length,
        sample: results.slice(0, 3),
      });

      return {
        updated: results.length,
        failed: 0,
        errors: [],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        'Failed to migrate activity session_keys',
        error instanceof Error ? error : new Error(errorMsg)
      );

      return {
        updated: 0,
        failed: 1,
        errors: [errorMsg],
      };
    }
  }

  // ============================================================================
  // NATURAL LANGUAGE QUERY SEARCH
  // ============================================================================

  /**
   * Search the graph using natural language query text
   * Performs AQL-based text matching on entities, concepts, sessions, and activities
   * This enables semantic search directly in ArangoDB using LIKE and text patterns
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
    const db = await this.ensureInitialized();
    const userKey = `user_${userId}`;
    const lookbackDays = options.lookbackDays ?? 30;
    const maxResults = options.maxResults ?? 10;

    // Extract search terms from query for pattern matching
    const searchTerms = query
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2)
      .slice(0, 10); // Limit to 10 terms

    // Create LIKE patterns for AQL
    const likePatterns = searchTerms.map(term => `%${term}%`);

    this.logger.debug('Searching graph with natural language query', {
      userId,
      query,
      searchTerms,
      lookbackDays,
      maxResults,
    });

    try {
      const aqlQuery = aql`
        LET search_patterns = ${likePatterns}
        LET user_key = ${userKey}
        LET lookback_date = DATE_SUBTRACT(DATE_NOW(), ${lookbackDays}, 'd')

        // Get user's session keys for filtering entities/concepts
        LET user_session_keys = (
          FOR session IN sessions
            FILTER session.user_key == user_key
            RETURN session._key
        )

        // Get user's activity keys (activities belonging to user's sessions)
        LET user_activity_keys = (
          FOR session IN sessions
            FILTER session.user_key == user_key
            FOR activity IN activities
              FILTER activity.session_key == session._key
              RETURN activity._key
        )

        // Search entities by name and type - filtered by user's activities via USES edges
        LET matched_entities = (
          FOR entity IN entities
            // Filter to entities used by user's activities
            LET user_uses = (
              FOR edge IN USES
                FILTER edge._to == CONCAT('entities/', entity._key)
                FILTER SPLIT(edge._from, '/')[1] IN user_activity_keys
                RETURN 1
            )
            FILTER LENGTH(user_uses) > 0
            LET name_lower = LOWER(entity.name)
            LET type_lower = LOWER(entity.type || '')
            LET match_count = (
              FOR pattern IN search_patterns
                LET term = SUBSTITUTE(pattern, '%', '')
                FILTER CONTAINS(name_lower, term) OR CONTAINS(type_lower, term)
                RETURN 1
            )
            FILTER LENGTH(match_count) > 0
            LET match_score = LENGTH(match_count) / LENGTH(search_patterns)
            SORT match_score DESC, entity.frequency DESC
            LIMIT ${maxResults}
            RETURN {
              name: entity.name,
              type: entity.type,
              frequency: entity.frequency || 0,
              matchScore: match_score,
              matchedOn: 'name/type'
            }
        )

        // Search concepts by name and category - filtered by user's activities via RELATES_TO edges
        LET matched_concepts = (
          FOR concept IN concepts
            // Filter to concepts related to user's activities
            LET user_relates = (
              FOR edge IN RELATES_TO
                FILTER edge._to == CONCAT('concepts/', concept._key)
                FILTER SPLIT(edge._from, '/')[1] IN user_activity_keys
                RETURN 1
            )
            FILTER LENGTH(user_relates) > 0
            LET name_lower = LOWER(concept.name)
            LET category_lower = LOWER(concept.category || '')
            LET match_count = (
              FOR pattern IN search_patterns
                LET term = SUBSTITUTE(pattern, '%', '')
                FILTER CONTAINS(name_lower, term) OR CONTAINS(category_lower, term)
                RETURN 1
            )
            FILTER LENGTH(match_count) > 0
            LET match_score = LENGTH(match_count) / LENGTH(search_patterns)
            SORT match_score DESC, concept.frequency DESC
            LIMIT ${maxResults}
            RETURN {
              name: concept.name,
              category: concept.category,
              frequency: concept.frequency || 0,
              matchScore: match_score,
              matchedOn: 'name/category'
            }
        )

        // Search sessions by summary and workflow classification
        LET matched_sessions = (
          FOR session IN sessions
            FILTER session.user_key == user_key
            FILTER session.start_time >= lookback_date
            LET summary_lower = LOWER(session.summary || '')
            LET workflow_lower = LOWER(session.workflow_classification.primary || '')
            LET match_count = (
              FOR pattern IN search_patterns
                LET term = SUBSTITUTE(pattern, '%', '')
                FILTER CONTAINS(summary_lower, term) OR CONTAINS(workflow_lower, term)
                RETURN 1
            )
            FILTER LENGTH(match_count) > 0
            LET match_score = LENGTH(match_count) / LENGTH(search_patterns)
            SORT match_score DESC, session.start_time DESC
            LIMIT ${maxResults}
            RETURN {
              sessionKey: session._key,
              externalId: session.external_id,
              summary: session.summary,
              workflowClassification: session.workflow_classification.primary,
              startTime: session.start_time,
              matchScore: match_score,
              matchedOn: 'summary/workflow'
            }
        )

        // Search activities by summary and workflow tag
        LET matched_activities = (
          FOR activity IN activities
            LET session = DOCUMENT(sessions, activity.session_key)
            FILTER session != null AND session.user_key == user_key
            FILTER activity.timestamp >= lookback_date
            LET summary_lower = LOWER(activity.summary || '')
            LET tag_lower = LOWER(activity.workflow_tag || '')
            LET match_count = (
              FOR pattern IN search_patterns
                LET term = SUBSTITUTE(pattern, '%', '')
                FILTER CONTAINS(summary_lower, term) OR CONTAINS(tag_lower, term)
                RETURN 1
            )
            FILTER LENGTH(match_count) > 0
            LET match_score = LENGTH(match_count) / LENGTH(search_patterns)
            SORT match_score DESC, activity.timestamp DESC
            LIMIT ${maxResults}
            RETURN {
              activityKey: activity._key,
              summary: activity.summary,
              workflowTag: activity.workflow_tag,
              timestamp: activity.timestamp,
              matchScore: match_score,
              matchedOn: 'summary/tag'
            }
        )

        RETURN {
          entities: matched_entities,
          concepts: matched_concepts,
          sessions: matched_sessions,
          activities: matched_activities
        }
      `;

      const cursor = await db.query(aqlQuery);
      const result = await cursor.next();

      this.logger.info('Graph search by natural language query completed', {
        userId,
        entitiesFound: result?.entities?.length || 0,
        conceptsFound: result?.concepts?.length || 0,
        sessionsFound: result?.sessions?.length || 0,
        activitiesFound: result?.activities?.length || 0,
      });

      return {
        entities: result?.entities || [],
        concepts: result?.concepts || [],
        sessions: result?.sessions || [],
        activities: result?.activities || [],
      };
    } catch (error) {
      this.logger.error('Failed to search graph by natural language query', {
        userId,
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      // Return empty results on error rather than throwing
      return {
        entities: [],
        concepts: [],
        sessions: [],
        activities: [],
      };
    }
  }

  // ============================================================================
  // CROSS-USER PEER RETRIEVAL (For A3 Comparator)
  // ============================================================================

  /**
   * Get peer workflow patterns from other users (anonymized).
   *
   * Uses the graph to find similar workflows across ALL users based on:
   * - Workflow classification (primary type)
   * - Shared entities (tools, files, concepts)
   * - Similar workflow transitions
   *
   * Returns anonymized data suitable for A3 Comparator peer comparison.
   *
   * @param excludeUserId - Current user to exclude from results
   * @param workflowType - Optional workflow type to filter by
   * @param entities - Optional entities to match (from user's session)
   * @param options - Search options
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
    const db = await this.ensureInitialized();
    const excludeUserKey = `user_${excludeUserId}`;
    const { workflowType, entities = [], minOccurrences = 3, limit = 10 } = options;

    this.logger.info('Retrieving peer workflow patterns from graph', {
      excludeUserId,
      workflowType,
      entityCount: entities.length,
      minOccurrences,
      limit,
    });

    try {
      const query = aql`
        // Get all sessions from OTHER users (peer sessions)
        LET peer_sessions = (
          FOR session IN sessions
            FILTER session.user_key != ${excludeUserKey}
            ${workflowType ? aql`FILTER session.workflow_classification.primary == ${workflowType}` : aql``}
            RETURN session
        )

        // Group by workflow type and aggregate metrics (anonymized)
        LET workflow_patterns = (
          FOR session IN peer_sessions
            COLLECT wf_type = session.workflow_classification.primary
            AGGREGATE
              occurrence_count = COUNT(1),
              avg_duration = AVG(session.duration_seconds || 0),
              unique_users = COLLECT_SET(session.user_key)

            // Only include patterns seen by multiple users (privacy)
            FILTER LENGTH(unique_users) >= 2
            FILTER occurrence_count >= ${minOccurrences}

            SORT occurrence_count DESC
            LIMIT ${limit}

            RETURN {
              workflowType: wf_type,
              avgDurationSeconds: ROUND(avg_duration),
              occurrenceCount: occurrence_count,
              uniqueUserCount: LENGTH(unique_users)
            }
        )

        // Get common entities for each workflow type (anonymized)
        LET patterns_with_entities = (
          FOR pattern IN workflow_patterns
            LET common_entities = (
              FOR session IN peer_sessions
                FILTER session.workflow_classification.primary == pattern.workflowType
                FOR activity IN activities
                  FILTER activity.session_key == session._key
                  FOR entity IN 1..1 OUTBOUND activity USES
                    COLLECT entity_name = entity.name
                    AGGREGATE freq = COUNT(1)
                    FILTER freq >= 2  // At least 2 occurrences
                    SORT freq DESC
                    LIMIT 5
                    RETURN entity_name
            )

            // Get common workflow transitions
            LET common_transitions = (
              FOR session IN peer_sessions
                FILTER session.workflow_classification.primary == pattern.workflowType
                FOR next IN 1..1 OUTBOUND session FOLLOWS
                  COLLECT
                    from_wf = session.workflow_classification.primary,
                    to_wf = next.workflow_classification.primary
                  AGGREGATE freq = COUNT(1)
                  FILTER freq >= 2
                  SORT freq DESC
                  LIMIT 3
                  RETURN { from: from_wf, to: to_wf, frequency: freq }
            )

            RETURN MERGE(pattern, {
              commonEntities: common_entities,
              commonTransitions: common_transitions
            })
        )

        RETURN patterns_with_entities
      `;

      const cursor = await db.query(query);
      const result = await cursor.next();
      const patterns = result || [];

      this.logger.info('Retrieved peer workflow patterns from graph', {
        patternCount: patterns.length,
        topPattern: patterns[0]?.workflowType,
      });

      return patterns;
    } catch (error) {
      this.logger.error('Failed to get peer workflow patterns from graph', {
        excludeUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Find peer sessions similar to a given session based on shared entities.
   *
   * Uses graph traversal to find sessions from other users that share
   * the same entities (tools, files, concepts) - a graph-based similarity approach.
   *
   * @param excludeUserId - Current user to exclude
   * @param entityNames - Entity names from user's session to match
   * @param options - Search options
   */
  async findPeerSessionsByEntities(
    excludeUserId: number,
    entityNames: string[],
    options: {
      minSharedEntities?: number;
      limit?: number;
      lookbackDays?: number;
      sharingUserIds?: number[];
    } = {}
  ): Promise<Array<{
    sessionId: string;
    workflowType: string;
    durationSeconds: number;
    sharedEntityCount: number;
    sharedEntities: string[];
  }>> {
    const db = await this.ensureInitialized();
    const excludeUserKey = `user_${excludeUserId}`;
    const { minSharedEntities = 2, limit = 10, lookbackDays = 60, sharingUserIds } = options;
    const sharingUserKeys = sharingUserIds
      ? sharingUserIds.map(id => `user_${id}`)
      : null;

    if (entityNames.length === 0) {
      return [];
    }

    this.logger.info('Finding peer sessions by shared entities', {
      excludeUserId,
      entityCount: entityNames.length,
      minSharedEntities,
    });

    try {
      // Normalize entity names for matching
      const normalizedEntityNames = entityNames.map(e =>
        `entity_${e.replace(/[^a-zA-Z0-9]/g, '_')}`
      );

      const query = aql`
        LET lookback_date = DATE_SUBTRACT(DATE_NOW(), ${lookbackDays}, 'd')
        LET target_entity_keys = ${normalizedEntityNames}

        // Find sessions from OTHER users that use the same entities
        LET peer_sessions = (
          FOR entity_key IN target_entity_keys
            // Find activities that use this entity
            FOR edge IN USES
              FILTER edge._to == CONCAT('entities/', entity_key)
              LET activity_key = SPLIT(edge._from, '/')[1]

              // Get the activity and session
              FOR activity IN activities
                FILTER activity._key == activity_key
                FOR session IN sessions
                  FILTER session._key == activity.session_key
                  FILTER session.user_key != ${excludeUserKey}
                  FILTER !${sharingUserKeys} || session.user_key IN ${sharingUserKeys || []}
                  FILTER session.start_time >= lookback_date

                  COLLECT session_id = session._key INTO shared_entities = entity_key

                  LET session_doc = DOCUMENT(sessions, session_id)
                  LET shared_count = LENGTH(shared_entities)

                  FILTER shared_count >= ${minSharedEntities}

                  SORT shared_count DESC
                  LIMIT ${limit}

                  RETURN {
                    sessionId: session_doc.external_id,
                    workflowType: session_doc.workflow_classification.primary,
                    durationSeconds: session_doc.duration_seconds || 0,
                    sharedEntityCount: shared_count,
                    sharedEntities: shared_entities
                  }
        )

        RETURN peer_sessions
      `;

      const cursor = await db.query(query);
      const result = await cursor.next();
      const sessions = result || [];

      this.logger.info('Found peer sessions by shared entities', {
        sessionCount: sessions.length,
        topMatch: sessions[0]?.sharedEntityCount,
      });

      return sessions;
    } catch (error) {
      this.logger.error('Failed to find peer sessions by entities', {
        excludeUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  // ============================================================================
  // REPETITIVE WORKFLOW PATTERN DETECTION (For Insight Generation)
  // ============================================================================

  /**
   * Detect repetitive workflow patterns for a specific user.
   *
   * Analyzes a user's workflow history to find recurring sequences like:
   * - "research → summarize → email" happening 10+ times
   * - Same tool combinations used repeatedly
   * - Repeated entity access patterns (same files, same tools)
   *
   * These patterns represent optimization opportunities.
   *
   * @param userId - The user to analyze
   * @param options - Detection options
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
    const db = await this.ensureInitialized();
    const userKey = `user_${userId}`;
    const {
      lookbackDays = 30,
      minOccurrences = 3,
      minSequenceLength = 2,
      maxSequenceLength = 5,
    } = options;

    this.logger.info('Detecting repetitive workflow patterns', {
      userId,
      lookbackDays,
      minOccurrences,
    });

    try {
      // Query 1: Find repetitive workflow type sequences
      const workflowSequenceQuery = aql`
        LET lookback_date = DATE_SUBTRACT(DATE_NOW(), ${lookbackDays}, 'd')
        LET user_key = ${userKey}

        // Get all user's sessions in chronological order
        LET user_sessions = (
          FOR session IN sessions
            FILTER session.user_key == user_key
            FILTER session.start_time >= lookback_date
            FILTER session.workflow_classification != null
            SORT session.start_time ASC
            RETURN {
              id: session.external_id,
              type: session.workflow_classification.primary,
              duration: session.duration_seconds || 0,
              start_time: session.start_time
            }
        )

        // Build sliding window sequences
        LET sequences = (
          FOR i IN 0..(LENGTH(user_sessions) - ${minSequenceLength})
            FOR seq_len IN ${minSequenceLength}..${maxSequenceLength}
              FILTER i + seq_len <= LENGTH(user_sessions)
              LET window = SLICE(user_sessions, i, seq_len)
              LET seq_types = (FOR s IN window RETURN s.type)
              LET seq_key = CONCAT_SEPARATOR(" → ", seq_types)
              LET total_duration = SUM(FOR s IN window RETURN s.duration)
              LET session_ids = (FOR s IN window RETURN s.id)
              LET first_time = FIRST(window).start_time
              LET last_time = LAST(window).start_time
              RETURN {
                sequence_key: seq_key,
                sequence: seq_types,
                duration: total_duration,
                sessions: session_ids,
                first_seen: first_time,
                last_seen: last_time
              }
        )

        // Group by sequence pattern and count occurrences
        LET grouped = (
          FOR seq IN sequences
            COLLECT
              pattern = seq.sequence_key,
              sequence_arr = seq.sequence
            INTO occurrences = {
              duration: seq.duration,
              sessions: seq.sessions,
              first_seen: seq.first_seen,
              last_seen: seq.last_seen
            }
            LET occ_count = LENGTH(occurrences)
            FILTER occ_count >= ${minOccurrences}

            LET all_sessions = UNIQUE(FLATTEN(FOR o IN occurrences RETURN o.sessions))
            LET total_time = SUM(FOR o IN occurrences RETURN o.duration)
            LET avg_time = total_time / occ_count
            LET first = MIN(FOR o IN occurrences RETURN o.first_seen)
            LET last = MAX(FOR o IN occurrences RETURN o.last_seen)

            SORT occ_count DESC
            LIMIT 10

            RETURN {
              patternType: "workflow_sequence",
              sequence: sequence_arr,
              occurrenceCount: occ_count,
              avgDurationSeconds: ROUND(avg_time),
              totalTimeSpentSeconds: ROUND(total_time),
              firstSeen: first,
              lastSeen: last,
              sessions: all_sessions
            }
        )

        RETURN grouped
      `;

      // Query 2: Find repetitive tool combinations
      const toolCombinationQuery = aql`
        LET lookback_date = DATE_SUBTRACT(DATE_NOW(), ${lookbackDays}, 'd')
        LET user_key = ${userKey}

        // Get sessions with their tool usage
        LET session_tools = (
          FOR session IN sessions
            FILTER session.user_key == user_key
            FILTER session.start_time >= lookback_date

            LET tools_used = (
              FOR activity IN activities
                FILTER activity.session_key == session._key
                FOR entity IN 1..1 OUTBOUND activity USES
                  FILTER entity.type == "tool" OR entity.type == "application"
                  COLLECT tool = entity.name
                  SORT tool
                  RETURN tool
            )

            FILTER LENGTH(tools_used) >= 2

            RETURN {
              session_id: session.external_id,
              tools: tools_used,
              tool_key: CONCAT_SEPARATOR(" + ", tools_used),
              duration: session.duration_seconds || 0,
              start_time: session.start_time
            }
        )

        // Group by tool combination
        LET grouped = (
          FOR st IN session_tools
            COLLECT
              tool_combo = st.tool_key,
              tools_arr = st.tools
            INTO sessions = {
              id: st.session_id,
              duration: st.duration,
              time: st.start_time
            }
            LET occ_count = LENGTH(sessions)
            FILTER occ_count >= ${minOccurrences}

            LET total_time = SUM(FOR s IN sessions RETURN s.duration)
            LET first = MIN(FOR s IN sessions RETURN s.time)
            LET last = MAX(FOR s IN sessions RETURN s.time)

            SORT occ_count DESC
            LIMIT 10

            RETURN {
              patternType: "tool_combination",
              sequence: tools_arr,
              occurrenceCount: occ_count,
              avgDurationSeconds: ROUND(total_time / occ_count),
              totalTimeSpentSeconds: ROUND(total_time),
              firstSeen: first,
              lastSeen: last,
              sessions: (FOR s IN sessions RETURN s.id)
            }
        )

        RETURN grouped
      `;

      // Execute both queries
      const [workflowCursor, toolCursor] = await Promise.all([
        db.query(workflowSequenceQuery),
        db.query(toolCombinationQuery),
      ]);

      const workflowPatterns = (await workflowCursor.next()) || [];
      const toolPatterns = (await toolCursor.next()) || [];

      // Combine and add optimization suggestions
      const allPatterns = [
        ...workflowPatterns.map((p: any) => ({
          ...p,
          optimizationOpportunity: this.generateOptimizationSuggestion(p, 'workflow_sequence'),
        })),
        ...toolPatterns.map((p: any) => ({
          ...p,
          optimizationOpportunity: this.generateOptimizationSuggestion(p, 'tool_combination'),
        })),
      ];

      // Sort by occurrence count
      allPatterns.sort((a, b) => b.occurrenceCount - a.occurrenceCount);

      this.logger.info('Detected repetitive workflow patterns', {
        userId,
        workflowSequenceCount: workflowPatterns.length,
        toolCombinationCount: toolPatterns.length,
        totalPatterns: allPatterns.length,
      });

      return allPatterns;
    } catch (error) {
      this.logger.error('Failed to detect repetitive workflow patterns', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Generate an optimization suggestion for a detected pattern.
   */
  private generateOptimizationSuggestion(
    pattern: { sequence: string[]; occurrenceCount: number; totalTimeSpentSeconds: number },
    type: 'workflow_sequence' | 'tool_combination' | 'entity_access'
  ): string {
    const hours = Math.round(pattern.totalTimeSpentSeconds / 3600);
    const sequenceStr = pattern.sequence.join(' → ');

    if (type === 'workflow_sequence') {
      if (pattern.sequence.includes('research') && pattern.sequence.includes('documentation')) {
        return `You've done "${sequenceStr}" ${pattern.occurrenceCount} times (${hours}h total). Consider creating a template or using AI summarization to speed up this workflow.`;
      }
      if (pattern.sequence.includes('email') || pattern.sequence.includes('communication')) {
        return `The pattern "${sequenceStr}" occurs ${pattern.occurrenceCount} times. Consider batching communications or using email templates.`;
      }
      return `Repetitive workflow "${sequenceStr}" detected ${pattern.occurrenceCount} times (${hours}h total). Consider automating parts of this sequence.`;
    }

    if (type === 'tool_combination') {
      return `You frequently use ${sequenceStr} together (${pattern.occurrenceCount} times). Consider integrating these tools or creating shortcuts.`;
    }

    return `Pattern detected ${pattern.occurrenceCount} times. Look for automation opportunities.`;
  }

  /**
   * Get migration status - check how many activities need migration
   */
  async getMigrationStatus(): Promise<{
    totalActivities: number;
    needsMigration: number;
    alreadyCorrect: number;
  }> {
    const db = await this.ensureInitialized();

    try {
      const query = aql`
        LET total = LENGTH(FOR a IN activities RETURN 1)
        LET needsMigration = LENGTH(
          FOR a IN activities
            FILTER !STARTS_WITH(a.session_key, "session_")
            RETURN 1
        )
        RETURN {
          totalActivities: total,
          needsMigration: needsMigration,
          alreadyCorrect: total - needsMigration
        }
      `;

      const cursor = await db.query(query);
      const result = await cursor.next();

      this.logger.info('Migration status check', result);
      return result;
    } catch (error) {
      this.logger.error(
        'Failed to get migration status',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  // ============================================================================
  // HEALTH CHECK AND STATUS
  // ============================================================================

  /**
   * Check ArangoDB connection health
   */
  async healthCheck(): Promise<boolean> {
    if (!this.enabled) {
      return true; // Return true if disabled, as it's not an error state
    }

    try {
      const db = await this.ensureInitialized();
      // Simple query to check connection
      await db.query(aql`RETURN 1`);
      return true;
    } catch (error) {
      this.logger.warn('ArangoDB health check failed', {
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
  // USER RETRIEVAL
  // ============================================================================

  /**
   * Get user by external ID
   */
  async getUser(userId: number): Promise<unknown | null> {
    if (!this.enabled) {
      return null;
    }

    const db = await this.ensureInitialized();
    const userKey = `user_${userId}`;

    try {
      const query = aql`
        FOR user IN users
          FILTER user._key == ${userKey}
          RETURN user
      `;

      const cursor = await db.query(query);
      const result = await cursor.next();
      return result || null;
    } catch (error) {
      this.logger.error('Failed to get user', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  // ============================================================================
  // TIMELINE NODE RETRIEVAL
  // ============================================================================

  /**
   * Get timeline nodes by user
   */
  async getTimelineNodesByUser(userId: number): Promise<unknown[]> {
    if (!this.enabled) {
      return [];
    }

    const db = await this.ensureInitialized();
    const userKey = `user_${userId}`;

    try {
      const query = aql`
        FOR node IN timeline_nodes
          FILTER node.user_key == ${userKey}
          SORT node.created_at DESC
          RETURN node
      `;

      const cursor = await db.query(query);
      return await cursor.all();
    } catch (error) {
      this.logger.error('Failed to get timeline nodes by user', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  // ============================================================================
  // SESSION RETRIEVAL
  // ============================================================================

  /**
   * Get related sessions via shared timeline node
   */
  async getRelatedSessions(sessionExternalId: string): Promise<unknown[]> {
    if (!this.enabled) {
      return [];
    }

    const db = await this.ensureInitialized();
    const sessionKey = `session_${sessionExternalId.replace(/[^a-zA-Z0-9]/g, '_')}`;

    try {
      const query = aql`
        LET current_session = DOCUMENT(sessions, ${sessionKey})
        FILTER current_session != null

        FOR related IN sessions
          FILTER related.node_key == current_session.node_key
          FILTER related._key != current_session._key
          SORT related.start_time DESC
          LIMIT 20
          RETURN related
      `;

      const cursor = await db.query(query);
      return await cursor.all();
    } catch (error) {
      this.logger.error('Failed to get related sessions', {
        sessionExternalId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Link session to timeline node (creates BELONGS_TO edge)
   */
  async linkSessionToNode(sessionExternalId: string, nodeExternalId: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const sessionKey = `session_${sessionExternalId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const nodeKeyId = nodeExternalId.replace(/-/g, '_');
    const nodeKey = `node_${nodeKeyId}`;

    try {
      await this.createEdge('BELONGS_TO', sessionKey, nodeKey, {
        created_at: new Date().toISOString(),
      });
      this.logger.debug('Linked session to node', { sessionKey, nodeKey });
    } catch (error) {
      this.logger.error('Failed to link session to node', {
        sessionExternalId,
        nodeExternalId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ============================================================================
  // ACTIVITY RETRIEVAL
  // ============================================================================

  /**
   * Get activities by session
   */
  async getActivitiesBySession(sessionKey: string): Promise<unknown[]> {
    if (!this.enabled) {
      return [];
    }

    const db = await this.ensureInitialized();
    // Normalize session key if needed
    const normalizedKey = sessionKey.startsWith('session_')
      ? sessionKey
      : `session_${sessionKey.replace(/[^a-zA-Z0-9]/g, '_')}`;

    try {
      const query = aql`
        FOR activity IN activities
          FILTER activity.session_key == ${normalizedKey}
          SORT activity.timestamp ASC
          RETURN activity
      `;

      const cursor = await db.query(query);
      return await cursor.all();
    } catch (error) {
      this.logger.error('Failed to get activities by session', {
        sessionKey,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  // ============================================================================
  // ENTITY LINKING
  // ============================================================================

  /**
   * Link activity to entity
   */
  async linkActivityToEntity(
    screenshotExternalId: number | string,
    entityName: string,
    context?: string
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const activityKey = `activity_${screenshotExternalId}`;
    const entityKey = `entity_${entityName.replace(/[^a-zA-Z0-9]/g, '_')}_unknown`;

    try {
      await this.createEdge('USES', activityKey, entityKey, {
        context: context || '',
        created_at: new Date().toISOString(),
      });
      this.logger.debug('Linked activity to entity', { activityKey, entityName });
    } catch (error) {
      this.logger.error('Failed to link activity to entity', {
        screenshotExternalId,
        entityName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get entity occurrences across sessions
   */
  async getEntityOccurrences(entityName: string): Promise<unknown[]> {
    if (!this.enabled) {
      return [];
    }

    const db = await this.ensureInitialized();

    try {
      const query = aql`
        FOR entity IN entities
          FILTER LOWER(entity.name) == LOWER(${entityName})

          LET occurrences = (
            FOR edge IN USES
              FILTER edge._to == CONCAT('entities/', entity._key)
              LET activity = DOCUMENT(SPLIT(edge._from, '/')[0], SPLIT(edge._from, '/')[1])
              FILTER activity != null
              LET session = DOCUMENT(sessions, activity.session_key)
              RETURN {
                activityKey: activity._key,
                sessionKey: activity.session_key,
                timestamp: activity.timestamp,
                workflowTag: activity.workflow_tag,
                sessionWorkflow: session.workflow_classification.primary
              }
          )

          RETURN {
            entity: entity,
            occurrences: occurrences,
            totalOccurrences: LENGTH(occurrences)
          }
      `;

      const cursor = await db.query(query);
      return await cursor.all();
    } catch (error) {
      this.logger.error('Failed to get entity occurrences', {
        entityName,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  // ============================================================================
  // CONCEPT LINKING
  // ============================================================================

  /**
   * Link activity to concept
   */
  async linkActivityToConcept(
    screenshotExternalId: number | string,
    conceptName: string,
    relevance: number = 1.0
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const activityKey = `activity_${screenshotExternalId}`;
    const conceptKey = `concept_${conceptName.replace(/[^a-zA-Z0-9]/g, '_')}`;

    try {
      await this.createEdge('RELATES_TO', activityKey, conceptKey, {
        relevance_score: relevance,
        created_at: new Date().toISOString(),
      });
      this.logger.debug('Linked activity to concept', { activityKey, conceptName });
    } catch (error) {
      this.logger.error('Failed to link activity to concept', {
        screenshotExternalId,
        conceptName,
        error: error instanceof Error ? error.message : String(error),
      });
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

    const db = await this.ensureInitialized();
    const patternKey = `pattern_${pattern.userId}_${pattern.intentCategory.replace(/[^a-zA-Z0-9]/g, '_')}`;

    return this.withRetry(async () => {
      try {
        const query = aql`
          UPSERT { _key: ${patternKey} }
          INSERT {
            _key: ${patternKey},
            user_id: ${pattern.userId},
            intent_category: ${pattern.intentCategory},
            occurrence_count: ${pattern.occurrenceCount},
            created_at: DATE_ISO8601(DATE_NOW()),
            last_seen_at: DATE_ISO8601(DATE_NOW()),
            metadata: ${pattern.metadata || {}}
          }
          UPDATE {
            occurrence_count: OLD.occurrence_count + ${pattern.occurrenceCount},
            last_seen_at: DATE_ISO8601(DATE_NOW()),
            metadata: ${pattern.metadata || OLD.metadata}
          }
          IN workflow_patterns
          RETURN NEW
        `;

        const cursor = await db.query(query);
        const result = await cursor.next();

        this.logger.debug('Upserted workflow pattern', { patternKey });
        return result;
      } catch (error) {
        this.logger.error('Failed to upsert workflow pattern', {
          pattern,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }, `upsertWorkflowPattern(${patternKey})`);
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

    const db = await this.ensureInitialized();
    const blockKey = `block_${block.canonicalSlug.replace(/[^a-zA-Z0-9]/g, '_')}`;

    return this.withRetry(async () => {
      try {
        const query = aql`
          UPSERT { _key: ${blockKey} }
          INSERT {
            _key: ${blockKey},
            user_id: ${block.userId},
            canonical_slug: ${block.canonicalSlug},
            intent_label: ${block.intentLabel},
            primary_tool: ${block.primaryTool},
            occurrence_count: ${block.occurrenceCount},
            created_at: DATE_ISO8601(DATE_NOW()),
            last_seen_at: DATE_ISO8601(DATE_NOW()),
            metadata: ${block.metadata || {}}
          }
          UPDATE {
            occurrence_count: OLD.occurrence_count + ${block.occurrenceCount},
            last_seen_at: DATE_ISO8601(DATE_NOW()),
            metadata: ${block.metadata || OLD.metadata}
          }
          IN blocks
          RETURN NEW
        `;

        const cursor = await db.query(query);
        const result = await cursor.next();

        this.logger.debug('Upserted block', { blockKey });
        return result;
      } catch (error) {
        this.logger.error('Failed to upsert block', {
          block,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }, `upsertBlock(${blockKey})`);
  }

  /**
   * Get blocks by user
   */
  async getBlocksByUser(userId: string): Promise<unknown[]> {
    if (!this.enabled) {
      return [];
    }

    const db = await this.ensureInitialized();

    try {
      const query = aql`
        FOR block IN blocks
          FILTER block.user_id == ${userId}
          SORT block.occurrence_count DESC
          RETURN block
      `;

      const cursor = await db.query(query);
      return await cursor.all();
    } catch (error) {
      this.logger.error('Failed to get blocks by user', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  // ============================================================================
  // TOOL OPERATIONS
  // ============================================================================

  /**
   * Upsert tool
   */
  async upsertTool(
    canonicalName: string,
    category: string,
    metadata?: Record<string, unknown>
  ): Promise<unknown> {
    if (!this.enabled) {
      return null;
    }

    const db = await this.ensureInitialized();
    const toolKey = `tool_${canonicalName.replace(/[^a-zA-Z0-9]/g, '_')}`;

    return this.withRetry(async () => {
      try {
        const query = aql`
          UPSERT { _key: ${toolKey} }
          INSERT {
            _key: ${toolKey},
            canonical_name: ${canonicalName},
            category: ${category},
            created_at: DATE_ISO8601(DATE_NOW()),
            metadata: ${metadata || {}}
          }
          UPDATE {
            category: ${category},
            metadata: ${metadata || OLD.metadata}
          }
          IN tools
          RETURN NEW
        `;

        const cursor = await db.query(query);
        const result = await cursor.next();

        this.logger.debug('Upserted tool', { canonicalName, category });
        return result;
      } catch (error) {
        this.logger.error('Failed to upsert tool', {
          canonicalName,
          category,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }, `upsertTool(${toolKey})`);
  }

  // ============================================================================
  // VECTOR SEARCH (Delegates to pgvector - stubs for interface compatibility)
  // ============================================================================

  /**
   * Search similar activities by embedding
   * Note: ArangoDB doesn't have native vector search - use pgvector instead
   */
  async searchSimilarActivities(_queryEmbedding: number[], _limit: number = 10): Promise<unknown[]> {
    // Vector search is handled by pgvector in PostgreSQL
    // This is a compatibility stub
    this.logger.debug('searchSimilarActivities called - use pgvector for vector search');
    return [];
  }

  /**
   * Search similar concepts by embedding
   * Note: ArangoDB doesn't have native vector search - use pgvector instead
   */
  async searchSimilarConcepts(_queryEmbedding: number[], _limit: number = 10): Promise<unknown[]> {
    // Vector search is handled by pgvector in PostgreSQL
    // This is a compatibility stub
    this.logger.debug('searchSimilarConcepts called - use pgvector for vector search');
    return [];
  }
}
