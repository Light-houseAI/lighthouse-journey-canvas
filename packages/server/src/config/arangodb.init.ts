/**
 * ArangoDB Schema Initialization
 *
 * Creates collections, edges, and indexes for Graph RAG workflow analysis
 */

import type { Database } from 'arangojs';

import type { Logger } from '../core/logger.js';
import { ArangoDBConnection } from './arangodb.connection.js';

// Simple console logger for standalone initialization
const defaultLogger: Logger = {
  debug: (message: string, meta?: Record<string, unknown>) => console.log(`[ArangoDB] ${message}`, meta || ''),
  info: (message: string, meta?: Record<string, unknown>) => console.log(`[ArangoDB] ${message}`, meta || ''),
  warn: (message: string, meta?: Record<string, unknown>) => console.warn(`[ArangoDB] ${message}`, meta || ''),
  error: (message: string, errorOrMeta?: Error | Record<string, unknown>) => console.error(`[ArangoDB] ${message}`, errorOrMeta || ''),
};

/**
 * Initialize ArangoDB schema for workflow analysis Graph RAG
 */
export async function initializeArangoDBSchema(logger: Logger = defaultLogger): Promise<void> {
  const db = await ArangoDBConnection.getConnection();

  try {
    logger.info('Initializing ArangoDB schema for workflow analysis...');

    // Create vertex collections
    const vertexCollections = [
      'users',
      'timeline_nodes',
      'sessions',
      'activities',
      'entities',
      'concepts',
      // Hierarchical Workflow collections (Level 1, 2, 3)
      'workflow_patterns',  // Level 1: Intent-driven sequences
      'blocks',             // Level 2: Tool-level execution units
      'steps',              // Level 3: Fine-grained UI actions
      'tools',              // Tool nodes for generalization
      // Context Stitching collections (Tier 1, 2, 3)
      'workstreams',        // Tier 1: Outcome-based workstream groupings
      'tool_mastery',       // Tier 2: Tool usage pattern groups
      'process_patterns',   // Tier 3: Repetitive cross-tool workflow sequences
    ];

    for (const collectionName of vertexCollections) {
      const exists = await db.collection(collectionName).exists();
      if (!exists) {
        await db.createCollection(collectionName);
        logger.info(`Created vertex collection: ${collectionName}`);
      } else {
        logger.debug(`Vertex collection already exists: ${collectionName}`);
      }
    }

    // Create edge collections
    const edgeCollections = [
      'BELONGS_TO',
      'FOLLOWS',
      'USES',
      'RELATES_TO',
      'CONTAINS',
      'SWITCHES_TO',
      'DEPENDS_ON',
      // Hierarchical Workflow edge collections
      'PATTERN_CONTAINS_BLOCK',   // workflow_patterns -> blocks
      'NEXT_BLOCK',               // blocks -> blocks (sequence)
      'BLOCK_CONTAINS_STEP',      // blocks -> steps
      'NEXT_STEP',                // steps -> steps (temporal)
      'BLOCK_USES_TOOL',          // blocks -> tools
      'BLOCK_RELATES_CONCEPT',    // blocks -> concepts
      'PATTERN_OCCURS_IN_SESSION', // workflow_patterns -> sessions
      'STEP_EVIDENCED_BY',        // steps -> external screenshot ref
      // Context Stitching edge collections
      'SESSION_IN_WORKSTREAM',    // sessions -> workstreams (Tier 1)
      'USES_TOOL_IN_WORKSTREAM',  // workstreams -> tools
      'PATTERN_OBSERVED',         // tool_mastery -> sessions (Tier 2)
      'PATTERN_INSTANCE',         // process_patterns -> sessions (Tier 3)
    ];

    for (const edgeName of edgeCollections) {
      const exists = await db.collection(edgeName).exists();
      if (!exists) {
        await db.createEdgeCollection(edgeName);
        logger.info(`Created edge collection: ${edgeName}`);
      } else {
        logger.debug(`Edge collection already exists: ${edgeName}`);
      }
    }

    // Create named graph
    const graphName = 'workflow_graph';
    const graphExists = await db.graph(graphName).exists();

    if (!graphExists) {
      await db.createGraph(graphName, [
        {
          collection: 'BELONGS_TO',
          from: ['sessions'],
          to: ['timeline_nodes'],
        },
        {
          collection: 'FOLLOWS',
          from: ['sessions'],
          to: ['sessions'],
        },
        {
          collection: 'USES',
          from: ['activities'],
          to: ['entities'],
        },
        {
          collection: 'RELATES_TO',
          from: ['activities'],
          to: ['concepts'],
        },
        {
          collection: 'CONTAINS',
          from: ['timeline_nodes'],
          to: ['sessions'],
        },
        {
          collection: 'SWITCHES_TO',
          from: ['activities'],
          to: ['activities'],
        },
        {
          collection: 'DEPENDS_ON',
          from: ['timeline_nodes'],
          to: ['timeline_nodes'],
        },
        // Hierarchical Workflow edges
        {
          collection: 'PATTERN_CONTAINS_BLOCK',
          from: ['workflow_patterns'],
          to: ['blocks'],
        },
        {
          collection: 'NEXT_BLOCK',
          from: ['blocks'],
          to: ['blocks'],
        },
        {
          collection: 'BLOCK_CONTAINS_STEP',
          from: ['blocks'],
          to: ['steps'],
        },
        {
          collection: 'NEXT_STEP',
          from: ['steps'],
          to: ['steps'],
        },
        {
          collection: 'BLOCK_USES_TOOL',
          from: ['blocks'],
          to: ['tools'],
        },
        {
          collection: 'BLOCK_RELATES_CONCEPT',
          from: ['blocks'],
          to: ['concepts'],
        },
        {
          collection: 'PATTERN_OCCURS_IN_SESSION',
          from: ['workflow_patterns'],
          to: ['sessions'],
        },
        // Context Stitching edges
        {
          collection: 'SESSION_IN_WORKSTREAM',
          from: ['sessions'],
          to: ['workstreams'],
        },
        {
          collection: 'USES_TOOL_IN_WORKSTREAM',
          from: ['workstreams'],
          to: ['tools'],
        },
        {
          collection: 'PATTERN_OBSERVED',
          from: ['tool_mastery'],
          to: ['sessions'],
        },
        {
          collection: 'PATTERN_INSTANCE',
          from: ['process_patterns'],
          to: ['sessions'],
        },
      ]);

      logger.info(`Created graph: ${graphName}`);
    } else {
      logger.debug(`Graph already exists: ${graphName}`);
    }

    // Create indexes for performance
    await createIndexes(db, logger);

    logger.info('ArangoDB schema initialization completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to initialize ArangoDB schema', new Error(errorMessage));
    throw error;
  }
}

/**
 * Create performance indexes on collections
 */
async function createIndexes(db: Database, logger: Logger = defaultLogger): Promise<void> {
  logger.info('Creating ArangoDB indexes...');

  try {
    // Index on users.external_id for fast lookup
    await db.collection('users').ensureIndex({
      type: 'persistent',
      fields: ['external_id'],
      unique: true,
      name: 'idx_users_external_id',
    });

    // Index on timeline_nodes.external_id
    await db.collection('timeline_nodes').ensureIndex({
      type: 'persistent',
      fields: ['external_id'],
      unique: true,
      name: 'idx_nodes_external_id',
    });

    // Index on timeline_nodes for user queries
    await db.collection('timeline_nodes').ensureIndex({
      type: 'persistent',
      fields: ['user_key'],
      name: 'idx_nodes_user_key',
    });

    // Index on sessions for temporal queries
    await db.collection('sessions').ensureIndex({
      type: 'persistent',
      fields: ['user_key', 'start_time'],
      name: 'idx_sessions_user_time',
    });

    await db.collection('sessions').ensureIndex({
      type: 'persistent',
      fields: ['node_key', 'start_time'],
      name: 'idx_sessions_node_time',
    });

    await db.collection('sessions').ensureIndex({
      type: 'persistent',
      fields: ['external_id'],
      unique: true,
      name: 'idx_sessions_external_id',
    });

    // Index on activities for timestamp queries
    await db.collection('activities').ensureIndex({
      type: 'persistent',
      fields: ['session_key', 'timestamp'],
      name: 'idx_activities_session_time',
    });

    await db.collection('activities').ensureIndex({
      type: 'persistent',
      fields: ['screenshot_external_id'],
      unique: true,
      name: 'idx_activities_screenshot_id',
    });

    // Index on activities for workflow tag queries
    await db.collection('activities').ensureIndex({
      type: 'persistent',
      fields: ['workflow_tag'],
      name: 'idx_activities_workflow_tag',
    });

    // Index on entities for name lookup
    await db.collection('entities').ensureIndex({
      type: 'persistent',
      fields: ['name', 'type'],
      name: 'idx_entities_name_type',
    });

    // Full-text index on entity names (using inverted index for modern ArangoDB)
    await db.collection('entities').ensureIndex({
      type: 'inverted',
      fields: ['name'],
      name: 'idx_entities_fulltext',
    });

    // Index on entities for frequency sorting
    await db.collection('entities').ensureIndex({
      type: 'persistent',
      fields: ['frequency'],
      name: 'idx_entities_frequency',
    });

    // Index on concepts for name and category
    await db.collection('concepts').ensureIndex({
      type: 'persistent',
      fields: ['name', 'category'],
      name: 'idx_concepts_name_category',
    });

    // Index on concepts for name uniqueness
    await db.collection('concepts').ensureIndex({
      type: 'persistent',
      fields: ['name'],
      unique: true,
      name: 'idx_concepts_name',
    });

    // ========================================================================
    // Hierarchical Workflow Indexes
    // ========================================================================

    // Index on workflow_patterns for user queries
    await db.collection('workflow_patterns').ensureIndex({
      type: 'persistent',
      fields: ['userId', 'occurrenceCount'],
      name: 'idx_patterns_user_occurrence',
    });

    // Index on workflow_patterns for intent queries
    await db.collection('workflow_patterns').ensureIndex({
      type: 'persistent',
      fields: ['intentCategory'],
      name: 'idx_patterns_intent',
    });

    // Index on workflow_patterns for temporal queries
    await db.collection('workflow_patterns').ensureIndex({
      type: 'persistent',
      fields: ['lastSeenAt'],
      name: 'idx_patterns_last_seen',
    });

    // Index on blocks for canonical slug (deduplication)
    await db.collection('blocks').ensureIndex({
      type: 'persistent',
      fields: ['canonicalSlug'],
      unique: true,
      name: 'idx_blocks_canonical_slug',
    });

    // Index on blocks for user and occurrence queries
    await db.collection('blocks').ensureIndex({
      type: 'persistent',
      fields: ['userId', 'occurrenceCount'],
      name: 'idx_blocks_user_occurrence',
    });

    // Index on blocks for intent queries
    await db.collection('blocks').ensureIndex({
      type: 'persistent',
      fields: ['intentLabel'],
      name: 'idx_blocks_intent',
    });

    // Index on blocks for tool queries
    await db.collection('blocks').ensureIndex({
      type: 'persistent',
      fields: ['primaryTool'],
      name: 'idx_blocks_primary_tool',
    });

    // Index on steps for block queries
    await db.collection('steps').ensureIndex({
      type: 'persistent',
      fields: ['sessionId', 'orderInBlock'],
      name: 'idx_steps_session_order',
    });

    // Index on steps for action type queries
    await db.collection('steps').ensureIndex({
      type: 'persistent',
      fields: ['actionType'],
      name: 'idx_steps_action_type',
    });

    // Index on steps for timestamp queries
    await db.collection('steps').ensureIndex({
      type: 'persistent',
      fields: ['timestamp'],
      name: 'idx_steps_timestamp',
    });

    // Index on tools for canonical name lookup
    await db.collection('tools').ensureIndex({
      type: 'persistent',
      fields: ['canonicalName'],
      unique: true,
      name: 'idx_tools_canonical_name',
    });

    // Index on tools for category queries
    await db.collection('tools').ensureIndex({
      type: 'persistent',
      fields: ['category'],
      name: 'idx_tools_category',
    });

    // Index on NEXT_BLOCK edge for frequency sorting
    await db.collection('NEXT_BLOCK').ensureIndex({
      type: 'persistent',
      fields: ['frequency'],
      name: 'idx_next_block_frequency',
    });

    // Index on NEXT_BLOCK edge for probability queries
    await db.collection('NEXT_BLOCK').ensureIndex({
      type: 'persistent',
      fields: ['probability'],
      name: 'idx_next_block_probability',
    });

    // ========================================================================
    // Context Stitching Indexes (Tier 1, 2, 3)
    // ========================================================================

    // Workstream indexes (Tier 1)
    await db.collection('workstreams').ensureIndex({
      type: 'persistent',
      fields: ['user_id', 'confidence'],
      name: 'idx_workstreams_user_confidence',
    });

    await db.collection('workstreams').ensureIndex({
      type: 'persistent',
      fields: ['first_activity', 'last_activity'],
      name: 'idx_workstreams_temporal',
    });

    // Tool mastery indexes (Tier 2)
    await db.collection('tool_mastery').ensureIndex({
      type: 'persistent',
      fields: ['user_id', 'tool_name'],
      unique: true,
      name: 'idx_tool_mastery_user_tool',
    });

    await db.collection('tool_mastery').ensureIndex({
      type: 'persistent',
      fields: ['total_time_seconds'],
      name: 'idx_tool_mastery_time',
    });

    // Process pattern indexes (Tier 3)
    await db.collection('process_patterns').ensureIndex({
      type: 'persistent',
      fields: ['user_id', 'frequency'],
      name: 'idx_process_patterns_user_frequency',
    });

    await db.collection('process_patterns').ensureIndex({
      type: 'persistent',
      fields: ['pattern_name'],
      name: 'idx_process_patterns_name',
    });

    await db.collection('process_patterns').ensureIndex({
      type: 'persistent',
      fields: ['automation_potential'],
      name: 'idx_process_patterns_automation',
    });

    logger.info('Successfully created all ArangoDB indexes');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.warn('Some indexes may already exist or failed to create', {
      error: errorMessage,
    });
    // Don't throw - indexes may already exist
  }
}

/**
 * Drop all workflow analysis collections (for testing/reset)
 * WARNING: This will delete all data!
 */
export async function dropWorkflowAnalysisSchema(logger: Logger = defaultLogger): Promise<void> {
  const db = await ArangoDBConnection.getConnection();

  logger.warn('Dropping workflow analysis schema - ALL DATA WILL BE LOST');

  try {
    // Drop graph first
    const graphName = 'workflow_graph';
    const graphExists = await db.graph(graphName).exists();
    if (graphExists) {
      await db.graph(graphName).drop(true); // true = dropCollections
      logger.info(`Dropped graph: ${graphName}`);
    }

    // Drop remaining collections
    const allCollections = [
      'users',
      'timeline_nodes',
      'sessions',
      'activities',
      'entities',
      'concepts',
      'BELONGS_TO',
      'FOLLOWS',
      'USES',
      'RELATES_TO',
      'CONTAINS',
      'SWITCHES_TO',
      'DEPENDS_ON',
      // Hierarchical Workflow collections
      'workflow_patterns',
      'blocks',
      'steps',
      'tools',
      'PATTERN_CONTAINS_BLOCK',
      'NEXT_BLOCK',
      'BLOCK_CONTAINS_STEP',
      'NEXT_STEP',
      'BLOCK_USES_TOOL',
      'BLOCK_RELATES_CONCEPT',
      'PATTERN_OCCURS_IN_SESSION',
      'STEP_EVIDENCED_BY',
      // Context Stitching collections
      'workstreams',
      'tool_mastery',
      'process_patterns',
      'SESSION_IN_WORKSTREAM',
      'USES_TOOL_IN_WORKSTREAM',
      'PATTERN_OBSERVED',
      'PATTERN_INSTANCE',
    ];

    for (const collectionName of allCollections) {
      const exists = await db.collection(collectionName).exists();
      if (exists) {
        await db.collection(collectionName).drop();
        logger.info(`Dropped collection: ${collectionName}`);
      }
    }

    logger.info('Workflow analysis schema dropped successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to drop workflow analysis schema', new Error(errorMessage));
    throw error;
  }
}
