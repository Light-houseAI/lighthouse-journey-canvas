#!/usr/bin/env npx tsx

/**
 * Quick script to check what sessions and screenshots exist in the database
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createDatabaseConnection, disposeDatabaseConnection } from '../config/database.connection.js';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Connecting to database...');
  const db = await createDatabaseConnection();

  try {
    // Check for sessions
    console.log('\n=== Session Mappings ===');
    const sessions = await db.execute(sql`SELECT id, user_id, desktop_session_id, category FROM session_mappings LIMIT 10`);
    console.log('Sessions found:', sessions.rows.length);
    if (sessions.rows.length > 0) {
      console.log('Sample sessions:');
      for (const row of sessions.rows) {
        console.log(`  - User ${row.user_id}: ${row.desktop_session_id} (${row.category})`);
      }
    }

    // Check for screenshots
    console.log('\n=== Workflow Screenshots ===');
    const screenshots = await db.execute(sql`SELECT id, user_id, session_id, workflow_tag FROM workflow_screenshots LIMIT 10`);
    console.log('Screenshots found:', screenshots.rows.length);
    if (screenshots.rows.length > 0) {
      console.log('Sample screenshots:');
      for (const row of screenshots.rows) {
        console.log(`  - User ${row.user_id}: Session ${row.session_id} (${row.workflow_tag})`);
      }
    }

    // Check user IDs with screenshots
    console.log('\n=== Users with Screenshots ===');
    const usersWithScreenshots = await db.execute(sql`
      SELECT user_id, COUNT(*) as screenshot_count
      FROM workflow_screenshots
      GROUP BY user_id
      ORDER BY screenshot_count DESC
      LIMIT 5
    `);
    if (usersWithScreenshots.rows.length > 0) {
      for (const row of usersWithScreenshots.rows) {
        console.log(`  - User ${row.user_id}: ${row.screenshot_count} screenshots`);
      }
    } else {
      console.log('  No users with screenshots found');
    }

    // Check session IDs with screenshots count
    console.log('\n=== Sessions with Screenshots ===');
    const sessionsWithScreenshots = await db.execute(sql`
      SELECT session_id, user_id, COUNT(*) as screenshot_count
      FROM workflow_screenshots
      GROUP BY session_id, user_id
      HAVING COUNT(*) >= 3
      ORDER BY screenshot_count DESC
      LIMIT 5
    `);
    if (sessionsWithScreenshots.rows.length > 0) {
      for (const row of sessionsWithScreenshots.rows) {
        console.log(`  - User ${row.user_id}, Session ${row.session_id}: ${row.screenshot_count} screenshots`);
      }
    } else {
      console.log('  No sessions with 3+ screenshots found');
    }

    // Check session alignment between tables
    console.log('\n=== Session Alignment Check ===');
    const orphanScreenshots = await db.execute(sql`
      SELECT DISTINCT ws.session_id, ws.user_id
      FROM workflow_screenshots ws
      WHERE NOT EXISTS (
        SELECT 1 FROM session_mappings sm
        WHERE sm.desktop_session_id = ws.session_id
      )
      LIMIT 5
    `);
    console.log('Screenshot sessions without matching session_mapping:', orphanScreenshots.rows.length);
    if (orphanScreenshots.rows.length > 0) {
      console.log('  (These screenshots have session_ids not in session_mappings.desktop_session_id)');
    }

  } finally {
    await disposeDatabaseConnection(db);
    console.log('\nDone!');
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
