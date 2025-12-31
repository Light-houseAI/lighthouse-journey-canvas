/**
 * ArangoDB Schema Initialization
 *
 * Creates collections, edges, and indexes for Graph RAG workflow analysis
 */

import type { Database } from 'arangojs';

import { logger } from '../core/logger.js';
import { ArangoDBConnection } from './arangodb.connection.js';

/**
 * Initialize ArangoDB schema for workflow analysis Graph RAG
 */
export async function initializeArangoDBSchema(): Promise<void> {
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
      ]);

      logger.info(`Created graph: ${graphName}`);
    } else {
      logger.debug(`Graph already exists: ${graphName}`);
    }

    // Create indexes for performance
    await createIndexes(db);

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
async function createIndexes(db: Database): Promise<void> {
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

    // Full-text index on entity names
    await db.collection('entities').ensureIndex({
      type: 'fulltext',
      fields: ['name'],
      minLength: 2,
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
export async function dropWorkflowAnalysisSchema(): Promise<void> {
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
