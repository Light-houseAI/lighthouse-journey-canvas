/**
 * Backfill ArangoDB Graph from Existing Screenshots
 *
 * This script:
 * 1. Fetches all workflow screenshots from PostgreSQL
 * 2. Extracts entities and concepts using LLM
 * 3. Creates activities, entities, concepts, and relationships in ArangoDB
 *
 * Usage:
 *   pnpm backfill:arango-graph
 *
 * Options:
 *   --dry-run     Preview what would be created without making changes
 *   --node-id     Process only screenshots for a specific node
 *   --batch-size  Number of screenshots to process at once (default: 10)
 */

import dotenv from 'dotenv';
import { Database, aql } from 'arangojs';
import pg from 'pg';

// Load environment variables
dotenv.config();

const { Pool } = pg;

// Configuration
const ARANGO_URL = process.env.ARANGO_URL || 'http://localhost:8529';
const ARANGO_DATABASE = process.env.ARANGO_DATABASE || 'lighthouse_graph';
const ARANGO_USERNAME = process.env.ARANGO_USERNAME || 'root';
const ARANGO_PASSWORD = process.env.ARANGO_PASSWORD!;

const DATABASE_URL = process.env.DATABASE_URL!;

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const NODE_ID_ARG = args.find(arg => arg.startsWith('--node-id='));
const SPECIFIC_NODE_ID = NODE_ID_ARG ? NODE_ID_ARG.split('=')[1] : null;
const BATCH_SIZE_ARG = args.find(arg => arg.startsWith('--batch-size='));
const BATCH_SIZE = BATCH_SIZE_ARG ? parseInt(BATCH_SIZE_ARG.split('=')[1]) : 10;

// Validate environment
if (!ARANGO_PASSWORD) {
  console.error('ARANGO_PASSWORD environment variable is required');
  process.exit(1);
}

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
  meta: Record<string, any>;
}

interface Stats {
  screenshotsProcessed: number;
  activitiesCreated: number;
  entitiesCreated: number;
  conceptsCreated: number;
  usesEdgesCreated: number;
  relatesToEdgesCreated: number;
  errors: number;
}

async function backfillArangoGraph() {
  console.log('========================================');
  console.log('ArangoDB Graph Backfill Script');
  console.log('========================================');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  if (SPECIFIC_NODE_ID) {
    console.log(`Filtering by node: ${SPECIFIC_NODE_ID}`);
  }
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

  // Connect to ArangoDB
  console.log('Connecting to ArangoDB...');
  const arangoDB = new Database({
    url: ARANGO_URL,
    databaseName: ARANGO_DATABASE,
    auth: {
      username: ARANGO_USERNAME,
      password: ARANGO_PASSWORD,
    },
  });

  try {
    await arangoDB.version();
    console.log('Connected to ArangoDB');
  } catch (error) {
    console.error('Failed to connect to ArangoDB:', error);
    process.exit(1);
  }

  // Stats tracking
  const stats: Stats = {
    screenshotsProcessed: 0,
    activitiesCreated: 0,
    entitiesCreated: 0,
    conceptsCreated: 0,
    usesEdgesCreated: 0,
    relatesToEdgesCreated: 0,
    errors: 0,
  };

  try {
    // Fetch screenshots from PostgreSQL
    console.log('\nFetching screenshots from PostgreSQL...');

    let query = `
      SELECT id, user_id, node_id, session_id, workflow_tag, summary, timestamp, meta
      FROM workflow_screenshots
    `;
    const queryParams: any[] = [];

    if (SPECIFIC_NODE_ID) {
      query += ' WHERE node_id = $1';
      queryParams.push(SPECIFIC_NODE_ID);
    }

    query += ' ORDER BY timestamp ASC';

    const result = await pgPool.query<Screenshot>(query, queryParams);
    const screenshots = result.rows;

    console.log(`Found ${screenshots.length} screenshots to process`);

    if (screenshots.length === 0) {
      console.log('No screenshots to process. Exiting.');
      await pgPool.end();
      await arangoDB.close();
      process.exit(0);
    }

    // Get existing activities to avoid duplicates
    console.log('\nChecking for existing activities in ArangoDB...');
    const existingActivitiesQuery = aql`
      FOR a IN activities
        RETURN a.screenshot_external_id
    `;
    const existingCursor = await arangoDB.query(existingActivitiesQuery);
    const existingActivityIds = new Set(await existingCursor.all());
    console.log(`Found ${existingActivityIds.size} existing activities`);

    // Filter out already processed screenshots
    const screenshotsToProcess = screenshots.filter(s => !existingActivityIds.has(s.id));
    console.log(`${screenshotsToProcess.length} new screenshots to process`);

    if (screenshotsToProcess.length === 0) {
      console.log('All screenshots already processed. Exiting.');
      await pgPool.end();
      await arangoDB.close();
      process.exit(0);
    }

    // Process in batches
    const totalBatches = Math.ceil(screenshotsToProcess.length / BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, screenshotsToProcess.length);
      const batch = screenshotsToProcess.slice(start, end);

      console.log(`\nProcessing batch ${batchIndex + 1}/${totalBatches} (screenshots ${start + 1}-${end})...`);

      for (const screenshot of batch) {
        try {
          await processScreenshot(arangoDB, screenshot, stats, DRY_RUN);
          stats.screenshotsProcessed++;
        } catch (error) {
          console.error(`  Error processing screenshot ${screenshot.id}:`, error);
          stats.errors++;
        }
      }

      // Progress update
      const progress = ((end / screenshotsToProcess.length) * 100).toFixed(1);
      console.log(`  Progress: ${progress}% (${stats.screenshotsProcessed} processed, ${stats.errors} errors)`);
    }

    // Print final stats
    console.log('\n========================================');
    console.log('Backfill Complete!');
    console.log('========================================');
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log(`Screenshots processed: ${stats.screenshotsProcessed}`);
    console.log(`Activities created: ${stats.activitiesCreated}`);
    console.log(`Entities created: ${stats.entitiesCreated}`);
    console.log(`Concepts created: ${stats.conceptsCreated}`);
    console.log(`USES edges created: ${stats.usesEdgesCreated}`);
    console.log(`RELATES_TO edges created: ${stats.relatesToEdgesCreated}`);
    console.log(`Errors: ${stats.errors}`);

  } catch (error) {
    console.error('Backfill failed:', error);
    stats.errors++;
  } finally {
    await pgPool.end();
    await arangoDB.close();
  }

  process.exit(stats.errors > 0 ? 1 : 0);
}

async function processScreenshot(
  db: Database,
  screenshot: Screenshot,
  stats: Stats,
  dryRun: boolean
): Promise<void> {
  const {
    id: screenshotId,
    user_id: userId,
    node_id: nodeId,
    session_id: sessionId,
    workflow_tag: workflowTag,
    summary,
    timestamp,
    meta,
  } = screenshot;

  // Normalize keys (replace hyphens with underscores)
  const userKey = `user_${userId}`;
  const nodeKeyId = nodeId.replace(/-/g, '_');
  const nodeKey = `node_${nodeKeyId}`;
  const sessionKey = `session_${sessionId.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const activityKey = `activity_${screenshotId}`;

  if (dryRun) {
    console.log(`  [DRY RUN] Would create activity ${activityKey} for screenshot ${screenshotId}`);
    stats.activitiesCreated++;
    return;
  }

  // 1. Ensure user exists
  await upsertUser(db, userId);

  // 2. Ensure timeline node exists
  await upsertTimelineNode(db, nodeId, userId);

  // 3. Ensure session exists with correct node_key
  await upsertSession(db, sessionId, userId, nodeId, workflowTag, timestamp);

  // 4. Create activity
  const activityQuery = aql`
    UPSERT { _key: ${activityKey} }
    INSERT {
      _key: ${activityKey},
      session_key: ${sessionKey},
      screenshot_external_id: ${screenshotId},
      timestamp: ${timestamp.toISOString()},
      workflow_tag: ${workflowTag},
      summary: ${summary || ''},
      confidence: 0.8,
      metadata: ${meta || {}}
    }
    UPDATE {
      workflow_tag: ${workflowTag},
      summary: ${summary || ''},
      metadata: ${meta || {}}
    }
    IN activities
    RETURN { isNew: OLD ? false : true }
  `;

  const activityResult = await db.query(activityQuery);
  const activityInfo = await activityResult.next();
  if (activityInfo?.isNew) {
    stats.activitiesCreated++;
  }

  // 5. Extract entities and concepts from summary
  if (summary) {
    const { entities, concepts } = extractEntitiesAndConcepts(summary, workflowTag);

    // Create entities and USES edges
    for (const entity of entities) {
      const entityKey = `entity_${entity.name.replace(/[^a-zA-Z0-9]/g, '_')}_${entity.type}`;

      // Upsert entity
      const entityQuery = aql`
        UPSERT { _key: ${entityKey} }
        INSERT {
          _key: ${entityKey},
          type: ${entity.type},
          name: ${entity.name},
          category: ${entity.type},
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
        RETURN { isNew: OLD ? false : true }
      `;

      const entityResult = await db.query(entityQuery);
      const entityInfo = await entityResult.next();
      if (entityInfo?.isNew) {
        stats.entitiesCreated++;
      }

      // Create USES edge
      const usesQuery = aql`
        INSERT {
          _from: ${'activities/' + activityKey},
          _to: ${'entities/' + entityKey},
          confidence: ${entity.confidence},
          context: ${entity.context || null}
        } INTO USES
        OPTIONS { overwriteMode: "ignore" }
        RETURN { created: true }
      `;

      try {
        const usesResult = await db.query(usesQuery);
        const usesInfo = await usesResult.next();
        if (usesInfo?.created) {
          stats.usesEdgesCreated++;
        }
      } catch (error: any) {
        // Ignore duplicate edge errors
        if (!error.message?.includes('unique constraint')) {
          throw error;
        }
      }
    }

    // Create concepts and RELATES_TO edges
    for (const concept of concepts) {
      const conceptKey = `concept_${concept.name.replace(/[^a-zA-Z0-9]/g, '_')}`;

      // Upsert concept
      const conceptQuery = aql`
        UPSERT { _key: ${conceptKey} }
        INSERT {
          _key: ${conceptKey},
          type: 'concept',
          name: ${concept.name},
          category: ${concept.category},
          first_seen: DATE_ISO8601(DATE_NOW()),
          metadata: {}
        }
        UPDATE {
          metadata: OLD.metadata
        }
        IN concepts
        RETURN { isNew: OLD ? false : true }
      `;

      const conceptResult = await db.query(conceptQuery);
      const conceptInfo = await conceptResult.next();
      if (conceptInfo?.isNew) {
        stats.conceptsCreated++;
      }

      // Create RELATES_TO edge
      const relatesToQuery = aql`
        INSERT {
          _from: ${'activities/' + activityKey},
          _to: ${'concepts/' + conceptKey},
          relevance_score: ${concept.relevanceScore},
          extracted_from: 'summary'
        } INTO RELATES_TO
        OPTIONS { overwriteMode: "ignore" }
        RETURN { created: true }
      `;

      try {
        const relatesToResult = await db.query(relatesToQuery);
        const relatesToInfo = await relatesToResult.next();
        if (relatesToInfo?.created) {
          stats.relatesToEdgesCreated++;
        }
      } catch (error: any) {
        // Ignore duplicate edge errors
        if (!error.message?.includes('unique constraint')) {
          throw error;
        }
      }
    }
  }
}

async function upsertUser(db: Database, userId: number): Promise<void> {
  const userKey = `user_${userId}`;
  const query = aql`
    UPSERT { _key: ${userKey} }
    INSERT {
      _key: ${userKey},
      external_id: ${userId},
      created_at: DATE_ISO8601(DATE_NOW()),
      metadata: {}
    }
    UPDATE {}
    IN users
  `;
  await db.query(query);
}

async function upsertTimelineNode(db: Database, nodeId: string, userId: number): Promise<void> {
  const nodeKeyId = nodeId.replace(/-/g, '_');
  const nodeKey = `node_${nodeKeyId}`;
  const userKey = `user_${userId}`;

  const query = aql`
    UPSERT { _key: ${nodeKey} }
    INSERT {
      _key: ${nodeKey},
      external_id: ${nodeId},
      user_key: ${userKey},
      type: 'workflow_node',
      title: ${'Node ' + nodeId},
      created_at: DATE_ISO8601(DATE_NOW()),
      metadata: {}
    }
    UPDATE {}
    IN timeline_nodes
  `;
  await db.query(query);
}

async function upsertSession(
  db: Database,
  sessionId: string,
  userId: number,
  nodeId: string,
  workflowTag: string,
  timestamp: Date
): Promise<void> {
  const sessionKey = `session_${sessionId.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const userKey = `user_${userId}`;
  const nodeKeyId = nodeId.replace(/-/g, '_');
  const nodeKey = `node_${nodeKeyId}`;

  // Upsert session
  const sessionQuery = aql`
    UPSERT { _key: ${sessionKey} }
    INSERT {
      _key: ${sessionKey},
      external_id: ${sessionId},
      user_key: ${userKey},
      node_key: ${nodeKey},
      start_time: ${timestamp.toISOString()},
      end_time: null,
      duration_seconds: 0,
      screenshot_count: 1,
      workflow_classification: {
        primary: ${workflowTag},
        confidence: 0.8
      },
      metadata: {}
    }
    UPDATE {
      screenshot_count: OLD.screenshot_count + 1
    }
    IN sessions
  `;
  await db.query(sessionQuery);

  // Create BELONGS_TO edge (session -> node)
  const belongsToQuery = aql`
    INSERT {
      _from: ${'sessions/' + sessionKey},
      _to: ${'timeline_nodes/' + nodeKey},
      created_at: DATE_ISO8601(DATE_NOW())
    } INTO BELONGS_TO
    OPTIONS { overwriteMode: "ignore" }
  `;
  try {
    await db.query(belongsToQuery);
  } catch (error: any) {
    if (!error.message?.includes('unique constraint')) {
      throw error;
    }
  }

  // Create CONTAINS edge (node -> session)
  const containsQuery = aql`
    INSERT {
      _from: ${'timeline_nodes/' + nodeKey},
      _to: ${'sessions/' + sessionKey},
      created_at: DATE_ISO8601(DATE_NOW())
    } INTO CONTAINS
    OPTIONS { overwriteMode: "ignore" }
  `;
  try {
    await db.query(containsQuery);
  } catch (error: any) {
    if (!error.message?.includes('unique constraint')) {
      throw error;
    }
  }
}

/**
 * Simple rule-based entity and concept extraction
 * This is a fallback when LLM is not available
 */
function extractEntitiesAndConcepts(
  summary: string,
  workflowTag: string
): {
  entities: Array<{ name: string; type: string; confidence: number; context?: string }>;
  concepts: Array<{ name: string; category: string; relevanceScore: number }>;
} {
  const entities: Array<{ name: string; type: string; confidence: number; context?: string }> = [];
  const concepts: Array<{ name: string; category: string; relevanceScore: number }> = [];

  const text = summary.toLowerCase();

  // Technology patterns
  const techPatterns: Record<string, string> = {
    'react': 'technology',
    'typescript': 'technology',
    'javascript': 'technology',
    'node': 'technology',
    'python': 'technology',
    'java': 'technology',
    'rust': 'technology',
    'go': 'technology',
    'sql': 'technology',
    'postgresql': 'technology',
    'mongodb': 'technology',
    'redis': 'technology',
    'docker': 'technology',
    'kubernetes': 'technology',
    'aws': 'technology',
    'gcp': 'technology',
    'azure': 'technology',
    'html': 'technology',
    'css': 'technology',
    'graphql': 'technology',
    'rest': 'technology',
    'api': 'technology',
    'git': 'technology',
    'npm': 'technology',
    'yarn': 'technology',
    'pnpm': 'technology',
  };

  // Tool patterns
  const toolPatterns: Record<string, string> = {
    'vscode': 'tool',
    'vs code': 'tool',
    'visual studio': 'tool',
    'cursor': 'tool',
    'chrome': 'tool',
    'firefox': 'tool',
    'safari': 'tool',
    'terminal': 'tool',
    'iterm': 'tool',
    'slack': 'tool',
    'discord': 'tool',
    'figma': 'tool',
    'notion': 'tool',
    'jira': 'tool',
    'github': 'tool',
    'gitlab': 'tool',
    'bitbucket': 'tool',
    'postman': 'tool',
    'insomnia': 'tool',
  };

  // Check for technologies
  for (const [tech, type] of Object.entries(techPatterns)) {
    if (text.includes(tech)) {
      entities.push({
        name: tech.charAt(0).toUpperCase() + tech.slice(1),
        type,
        confidence: 0.7,
        context: `Found in: ${summary.slice(0, 100)}`,
      });
    }
  }

  // Check for tools
  for (const [tool, type] of Object.entries(toolPatterns)) {
    if (text.includes(tool)) {
      entities.push({
        name: tool.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        type,
        confidence: 0.7,
        context: `Found in: ${summary.slice(0, 100)}`,
      });
    }
  }

  // Concept patterns based on workflow tag
  const conceptsByWorkflowTag: Record<string, Array<{ name: string; category: string }>> = {
    coding: [
      { name: 'Software Development', category: 'programming' },
      { name: 'Code Writing', category: 'work_activity' },
    ],
    debugging: [
      { name: 'Debugging', category: 'programming' },
      { name: 'Problem Solving', category: 'work_activity' },
    ],
    research: [
      { name: 'Research', category: 'work_activity' },
      { name: 'Information Gathering', category: 'methodology' },
    ],
    documentation: [
      { name: 'Documentation', category: 'work_activity' },
      { name: 'Technical Writing', category: 'methodology' },
    ],
    meeting: [
      { name: 'Collaboration', category: 'work_activity' },
      { name: 'Communication', category: 'methodology' },
    ],
    code_review: [
      { name: 'Code Review', category: 'work_activity' },
      { name: 'Quality Assurance', category: 'methodology' },
    ],
    testing: [
      { name: 'Testing', category: 'programming' },
      { name: 'Quality Assurance', category: 'methodology' },
    ],
    deployment: [
      { name: 'Deployment', category: 'programming' },
      { name: 'DevOps', category: 'domain' },
    ],
    planning: [
      { name: 'Planning', category: 'work_activity' },
      { name: 'Project Management', category: 'methodology' },
    ],
    design: [
      { name: 'Design', category: 'work_activity' },
      { name: 'UI/UX', category: 'domain' },
    ],
  };

  // Add concepts based on workflow tag
  const tagConcepts = conceptsByWorkflowTag[workflowTag] || [
    { name: 'General Work', category: 'work_activity' },
  ];

  for (const concept of tagConcepts) {
    concepts.push({
      ...concept,
      relevanceScore: 0.7,
    });
  }

  // Additional concept detection from summary text
  const conceptPatterns: Record<string, { name: string; category: string }> = {
    'api': { name: 'API Development', category: 'programming' },
    'database': { name: 'Database Management', category: 'programming' },
    'frontend': { name: 'Frontend Development', category: 'domain' },
    'backend': { name: 'Backend Development', category: 'domain' },
    'authentication': { name: 'Authentication', category: 'programming' },
    'testing': { name: 'Testing', category: 'programming' },
    'refactor': { name: 'Refactoring', category: 'work_activity' },
    'bug': { name: 'Bug Fixing', category: 'work_activity' },
    'feature': { name: 'Feature Development', category: 'work_activity' },
    'performance': { name: 'Performance Optimization', category: 'programming' },
    'security': { name: 'Security', category: 'programming' },
  };

  for (const [pattern, concept] of Object.entries(conceptPatterns)) {
    if (text.includes(pattern)) {
      // Avoid duplicates
      if (!concepts.some(c => c.name === concept.name)) {
        concepts.push({
          ...concept,
          relevanceScore: 0.6,
        });
      }
    }
  }

  return { entities, concepts };
}

// Run the backfill
backfillArangoGraph().catch((error) => {
  console.error('Unhandled error during backfill:', error);
  process.exit(1);
});
