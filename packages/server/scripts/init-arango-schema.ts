/**
 * Initialize ArangoDB Schema for Workflow Analysis Graph RAG
 *
 * This script:
 * 1. Connects to ArangoDB
 * 2. Creates the database if it doesn't exist
 * 3. Initializes all collections, edges, and indexes
 *
 * Usage:
 *   pnpm db:init-arango
 */

import dotenv from 'dotenv';
import { Database } from 'arangojs';

import { logger } from '../src/core/logger.js';

// Load environment variables
dotenv.config();

const ARANGO_URL = process.env.ARANGO_URL || 'http://localhost:8529';
const ARANGO_DATABASE = process.env.ARANGO_DATABASE || 'lighthouse_graph';
const ARANGO_USERNAME = process.env.ARANGO_USERNAME || 'root';
const ARANGO_PASSWORD = process.env.ARANGO_PASSWORD!;

if (!ARANGO_PASSWORD) {
  logger.error('ARANGO_PASSWORD environment variable is required');
  process.exit(1);
}

async function initializeArangoSchema() {
  logger.info('Starting ArangoDB schema initialization...');
  logger.info(`Connecting to: ${ARANGO_URL}`);

  // Connect to _system database first to create our database
  const systemDb = new Database({
    url: ARANGO_URL,
    databaseName: '_system',
    auth: {
      username: ARANGO_USERNAME,
      password: ARANGO_PASSWORD,
    },
  });

  try {
    // Test connection
    await systemDb.version();
    logger.info('Connected to ArangoDB successfully');

    // Check if database exists, create if not
    const databases = await systemDb.listDatabases();
    if (!databases.includes(ARANGO_DATABASE)) {
      logger.info(`Database "${ARANGO_DATABASE}" does not exist. Creating...`);
      await systemDb.createDatabase(ARANGO_DATABASE);
      logger.info(`Database "${ARANGO_DATABASE}" created successfully`);
    } else {
      logger.info(`Database "${ARANGO_DATABASE}" already exists`);
    }

    // Connect to our database
    const db = new Database({
      url: ARANGO_URL,
      databaseName: ARANGO_DATABASE,
      auth: {
        username: ARANGO_USERNAME,
        password: ARANGO_PASSWORD,
      },
    });

    // Create vertex collections
    logger.info('Creating vertex collections...');
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
        logger.info(`✓ Created vertex collection: ${collectionName}`);
      } else {
        logger.info(`  Collection already exists: ${collectionName}`);
      }
    }

    // Create edge collections
    logger.info('Creating edge collections...');
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
        logger.info(`✓ Created edge collection: ${edgeName}`);
      } else {
        logger.info(`  Edge collection already exists: ${edgeName}`);
      }
    }

    // Create named graph
    logger.info('Creating named graph...');
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
      logger.info(`✓ Created graph: ${graphName}`);
    } else {
      logger.info(`  Graph already exists: ${graphName}`);
    }

    // Create indexes
    logger.info('Creating indexes...');
    await createIndexes(db);

    logger.info('✅ ArangoDB schema initialization completed successfully!');
    logger.info('');
    logger.info('Next steps:');
    logger.info('  1. Ensure your .env file has the correct ArangoDB credentials');
    logger.info('  2. Run the server: pnpm dev');
    logger.info('  3. Test the Graph RAG workflow analysis feature');

    await db.close();
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to initialize ArangoDB schema', new Error(errorMessage));
    logger.error(error instanceof Error ? error.stack || '' : '');
    process.exit(1);
  }
}

async function createIndexes(db: Database): Promise<void> {
  const indexes = [
    // Users
    {
      collection: 'users',
      config: {
        type: 'persistent' as const,
        fields: ['external_id'],
        unique: true,
        name: 'idx_users_external_id',
      },
    },
    // Timeline nodes
    {
      collection: 'timeline_nodes',
      config: {
        type: 'persistent' as const,
        fields: ['external_id'],
        unique: true,
        name: 'idx_nodes_external_id',
      },
    },
    {
      collection: 'timeline_nodes',
      config: {
        type: 'persistent' as const,
        fields: ['user_key'],
        name: 'idx_nodes_user_key',
      },
    },
    // Sessions
    {
      collection: 'sessions',
      config: {
        type: 'persistent' as const,
        fields: ['user_key', 'start_time'],
        name: 'idx_sessions_user_time',
      },
    },
    {
      collection: 'sessions',
      config: {
        type: 'persistent' as const,
        fields: ['node_key', 'start_time'],
        name: 'idx_sessions_node_time',
      },
    },
    {
      collection: 'sessions',
      config: {
        type: 'persistent' as const,
        fields: ['external_id'],
        unique: true,
        name: 'idx_sessions_external_id',
      },
    },
    // Activities
    {
      collection: 'activities',
      config: {
        type: 'persistent' as const,
        fields: ['session_key', 'timestamp'],
        name: 'idx_activities_session_time',
      },
    },
    {
      collection: 'activities',
      config: {
        type: 'persistent' as const,
        fields: ['screenshot_external_id'],
        unique: true,
        name: 'idx_activities_screenshot_id',
      },
    },
    {
      collection: 'activities',
      config: {
        type: 'persistent' as const,
        fields: ['workflow_tag'],
        name: 'idx_activities_workflow_tag',
      },
    },
    // Entities
    {
      collection: 'entities',
      config: {
        type: 'persistent' as const,
        fields: ['name', 'type'],
        name: 'idx_entities_name_type',
      },
    },
    {
      collection: 'entities',
      config: {
        type: 'fulltext' as const,
        fields: ['name'],
        minLength: 2,
        name: 'idx_entities_fulltext',
      },
    },
    {
      collection: 'entities',
      config: {
        type: 'persistent' as const,
        fields: ['frequency'],
        name: 'idx_entities_frequency',
      },
    },
    // Concepts
    {
      collection: 'concepts',
      config: {
        type: 'persistent' as const,
        fields: ['name', 'category'],
        name: 'idx_concepts_name_category',
      },
    },
    {
      collection: 'concepts',
      config: {
        type: 'persistent' as const,
        fields: ['name'],
        unique: true,
        name: 'idx_concepts_name',
      },
    },
  ];

  for (const { collection, config } of indexes) {
    try {
      await db.collection(collection).ensureIndex(config);
      logger.info(`✓ Created index ${config.name} on ${collection}`);
    } catch (error: any) {
      // Index may already exist
      if (error.message && error.message.includes('duplicate')) {
        logger.info(`  Index ${config.name} already exists on ${collection}`);
      } else {
        logger.warn(`Failed to create index ${config.name} on ${collection}: ${error.message}`);
      }
    }
  }
}

// Run the initialization
initializeArangoSchema().catch((error) => {
  logger.error('Unhandled error during schema initialization', error);
  process.exit(1);
});
