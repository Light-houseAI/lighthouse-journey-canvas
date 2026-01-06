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

// ============================================================================
// ARANGODB GRAPH SERVICE
// ============================================================================

export class ArangoDBGraphService {
  private db: Database | null = null;
  private logger: Logger;

  constructor({ logger }: { logger: Logger }) {
    this.logger = logger;
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
  private async upsertEntity(name: string, type: string): Promise<string> {
    const db = await this.ensureInitialized();
    const entityKey = `entity_${name.replace(/[^a-zA-Z0-9]/g, '_')}_${type}`;

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
        metadata: {}
      }
      UPDATE {
        last_seen: DATE_ISO8601(DATE_NOW()),
        frequency: OLD.frequency + 1
      }
      IN entities
      RETURN NEW
    `;

    const cursor = await db.query(query);
    const result = await cursor.next();
    return result._key;
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
  private async upsertConcept(
    name: string,
    category?: string
  ): Promise<string> {
    const db = await this.ensureInitialized();
    const conceptKey = `concept_${name.replace(/[^a-zA-Z0-9]/g, '_')}`;

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

    try {
      // Use collection.save() instead of AQL INSERT for simpler edge creation
      await edgeCollection.save(edgeDoc, { overwriteMode: 'ignore' });
    } catch (error: any) {
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

        // Get entities used across all sessions
        LET entities = (
          FOR session IN APPEND(node_sessions, related_sessions)
            FOR activity IN activities
              FILTER activity.session_key == session._key
              FOR entity IN 1..1 OUTBOUND activity USES
                COLLECT e = entity
                AGGREGATE count = COUNT(1)
                RETURN MERGE(e, { usage_count: count })
        )

        // Get concepts
        LET concepts = (
          FOR session IN APPEND(node_sessions, related_sessions)
            FOR activity IN activities
              FILTER activity.session_key == session._key
              FOR concept IN 1..1 OUTBOUND activity RELATES_TO
                COLLECT c = concept
                AGGREGATE count = COUNT(1)
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

        // Search entities by name and type
        LET matched_entities = (
          FOR entity IN entities
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

        // Search concepts by name and category
        LET matched_concepts = (
          FOR concept IN concepts
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
}
