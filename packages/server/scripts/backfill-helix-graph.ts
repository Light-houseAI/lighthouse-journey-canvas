/**
 * Backfill Helix Graph DB from Existing PostgreSQL Data
 *
 * This script syncs workflow screenshots to Helix graph database.
 *
 * Usage:
 *   npx tsx scripts/backfill-helix-graph.ts
 *   npx tsx scripts/backfill-helix-graph.ts --user-id=31 --node-id=cc450d9c-a1cb-4a8c-9e2e-46308b032f5c
 */

import dotenv from 'dotenv';
import pg from 'pg';

// Load environment variables
dotenv.config();

const { Pool } = pg;

// Configuration
const DATABASE_URL = process.env.DATABASE_URL!;
const HELIX_URL = process.env.HELIX_URL || 'http://localhost:6969';

// Parse command line arguments
const args = process.argv.slice(2);
const USER_ID_ARG = args.find(arg => arg.startsWith('--user-id='));
const USER_ID = USER_ID_ARG ? parseInt(USER_ID_ARG.split('=')[1]) : null;
const NODE_ID_ARG = args.find(arg => arg.startsWith('--node-id='));
const NODE_ID = NODE_ID_ARG ? NODE_ID_ARG.split('=')[1] : null;
const LIMIT_ARG = args.find(arg => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : 100;

// Validate environment
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

interface Screenshot {
  id: number;
  user_id: number;
  node_id: string;
  session_id: string;
  workflow_tag: string;
  summary: string | null;
  timestamp: Date;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let helixClient: any = null;

async function initHelixClient(): Promise<any> {
  if (helixClient) return helixClient;

  const helixModule = await import('helix-ts');
  const HelixDB = helixModule.default || helixModule.HelixDB;
  helixClient = new HelixDB(HELIX_URL);
  return helixClient;
}

async function executeQuery(queryName: string, params: Record<string, unknown>): Promise<any> {
  const client = await initHelixClient();
  return client.query(queryName, params);
}

async function backfillHelixGraph() {
  console.log('========================================');
  console.log('Helix Graph DB Backfill Script');
  console.log('========================================');
  console.log(`Helix URL: ${HELIX_URL}`);
  console.log(`User ID filter: ${USER_ID || 'all'}`);
  console.log(`Node ID filter: ${NODE_ID || 'all'}`);
  console.log(`Limit: ${LIMIT}`);
  console.log('');

  // Connect to PostgreSQL
  console.log('Connecting to PostgreSQL...');
  const pgPool = new Pool({ connectionString: DATABASE_URL });

  try {
    await pgPool.query('SELECT 1');
    console.log('Connected to PostgreSQL');
  } catch (error) {
    console.error('Failed to connect to PostgreSQL:', error);
    process.exit(1);
  }

  // Test Helix connection
  console.log('Testing Helix connection...');
  try {
    await initHelixClient();
    const result = await executeQuery('HealthCheck', {});
    console.log('Helix connected:', result);
  } catch (error) {
    console.error('Failed to connect to Helix:', error);
    console.log('Continuing anyway - will fail on first mutation if Helix is down');
  }

  const stats = {
    usersCreated: 0,
    nodesCreated: 0,
    sessionsCreated: 0,
    activitiesCreated: 0,
    errors: 0,
  };

  try {
    // Fetch screenshots from PostgreSQL
    console.log('\nFetching screenshots from PostgreSQL...');

    let query = `
      SELECT id, user_id, node_id, session_id, workflow_tag, summary, timestamp
      FROM workflow_screenshots
      WHERE 1=1
    `;
    const queryParams: (number | string)[] = [];
    let paramIndex = 1;

    if (USER_ID) {
      query += ` AND user_id = $${paramIndex++}`;
      queryParams.push(USER_ID);
    }

    if (NODE_ID) {
      query += ` AND node_id = $${paramIndex++}`;
      queryParams.push(NODE_ID);
    }

    query += ` ORDER BY timestamp ASC LIMIT $${paramIndex}`;
    queryParams.push(LIMIT);

    const result = await pgPool.query<Screenshot>(query, queryParams);
    const screenshots = result.rows;

    console.log(`Found ${screenshots.length} screenshots to process`);

    if (screenshots.length === 0) {
      console.log('No screenshots to process. Exiting.');
      await pgPool.end();
      process.exit(0);
    }

    // Track unique users, nodes, sessions
    const processedUsers = new Set<number>();
    const processedNodes = new Set<string>();
    const processedSessions = new Set<string>();

    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i];
      const progress = ((i + 1) / screenshots.length * 100).toFixed(1);

      try {
        const userKey = `user_${screenshot.user_id}`;
        const nodeKey = `node_${screenshot.node_id}`;
        const sessionKey = `session_${screenshot.session_id.replace(/[^a-zA-Z0-9]/g, '_')}`;

        // 1. Upsert User
        if (!processedUsers.has(screenshot.user_id)) {
          await executeQuery('UpsertUser', {
            external_id: userKey,
            metadata: '{}',
          });
          processedUsers.add(screenshot.user_id);
          stats.usersCreated++;
        }

        // 2. Upsert Timeline Node
        if (!processedNodes.has(screenshot.node_id)) {
          await executeQuery('UpsertTimelineNode', {
            external_id: nodeKey,
            user_key: userKey,
            node_type: 'workflow_node',
            title: `Node ${screenshot.node_id.slice(0, 8)}`,
            metadata: '{}',
          });
          processedNodes.add(screenshot.node_id);
          stats.nodesCreated++;
        }

        // 3. Upsert Session
        if (!processedSessions.has(screenshot.session_id)) {
          await executeQuery('UpsertSession', {
            external_id: screenshot.session_id,
            user_key: userKey,
            node_key: nodeKey,
            start_time: screenshot.timestamp.toISOString(),
            end_time: screenshot.timestamp.toISOString(),
            duration_seconds: 0,
            screenshot_count: 1,
            workflow_primary: screenshot.workflow_tag,
            workflow_secondary: '',
            workflow_confidence: 0.8,
            metadata: '{}',
          });

          // Link session to node
          await executeQuery('LinkSessionToNode', {
            session_external_id: screenshot.session_id,
            node_external_id: nodeKey,
          });

          processedSessions.add(screenshot.session_id);
          stats.sessionsCreated++;
        }

        // 4. Upsert Activity
        await executeQuery('UpsertActivity', {
          session_key: sessionKey,
          screenshot_external_id: String(screenshot.id),
          workflow_tag: screenshot.workflow_tag,
          timestamp: screenshot.timestamp.toISOString(),
          summary: screenshot.summary || '',
          confidence: 0.8,
          metadata: '{}',
        });

        // 5. Link Activity to Session
        await executeQuery('LinkActivityToSession', {
          screenshot_external_id: String(screenshot.id),
          session_external_id: screenshot.session_id,
        });

        stats.activitiesCreated++;

        if ((i + 1) % 10 === 0 || i === screenshots.length - 1) {
          console.log(`Progress: ${progress}% (${i + 1}/${screenshots.length})`);
        }
      } catch (error) {
        console.error(`Error processing screenshot ${screenshot.id}:`, error);
        stats.errors++;
      }
    }

    // Print final stats
    console.log('\n========================================');
    console.log('Backfill Complete!');
    console.log('========================================');
    console.log(`Users created: ${stats.usersCreated}`);
    console.log(`Nodes created: ${stats.nodesCreated}`);
    console.log(`Sessions created: ${stats.sessionsCreated}`);
    console.log(`Activities created: ${stats.activitiesCreated}`);
    console.log(`Errors: ${stats.errors}`);

  } catch (error) {
    console.error('Backfill failed:', error);
    stats.errors++;
  } finally {
    await pgPool.end();
  }

  process.exit(stats.errors > 0 ? 1 : 0);
}

// Run the backfill
backfillHelixGraph().catch((error) => {
  console.error('Unhandled error during backfill:', error);
  process.exit(1);
});
