import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, desc } from 'drizzle-orm';
import { hierarchyNodes, sessionMapping } from '@journey/schema/src/schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function checkAndRemapSessions() {
  try {
    console.log('🔍 Checking current session mappings...\n');

    // Get all sessions with their nodes
    const query = `
      SELECT
        sm.id,
        sm.desktop_session_id,
        sm.node_id,
        sm.workflow_name,
        sm.category,
        sm.user_id,
        tn.type as node_type,
        tn.meta->>'title' as node_title
      FROM session_mappings sm
      LEFT JOIN timeline_nodes tn ON sm.node_id = tn.id
      ORDER BY sm.created_at DESC
      LIMIT 20;
    `;

    const result = await pool.query(query);

    console.log(`Found ${result.rows.length} sessions:\n`);

    for (const row of result.rows) {
      console.log(`Session: ${row.workflow_name || row.desktop_session_id}`);
      console.log(`  - Mapped to: ${row.node_title || row.node_id || 'UNMAPPED'}`);
      console.log(`  - Node type: ${row.node_type || 'N/A'}`);
      console.log(`  - Category: ${row.category}`);
      console.log(`  - User ID: ${row.user_id}\n`);
    }

    // Get all job nodes for the user
    const jobQuery = `
      SELECT id, type, meta->>'title' as title, user_id
      FROM timeline_nodes
      WHERE type = 'job'
      ORDER BY created_at DESC;
    `;

    const jobResult = await pool.query(jobQuery);

    console.log('\n📋 Available job nodes:\n');
    for (const job of jobResult.rows) {
      console.log(`- ${job.title || 'Untitled'} (ID: ${job.id}) [User: ${job.user_id}]`);
    }

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkAndRemapSessions();
