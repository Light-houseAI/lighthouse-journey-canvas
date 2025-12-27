#!/usr/bin/env tsx
/**
 * Run the workflow screenshots migration
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_rlxp4PGjLMu9@ep-lucky-feather-afu3qb3d-pooler.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require";

async function runMigration() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log('🔄 Running workflow screenshots migration...\n');

    const migrationPath = path.join(__dirname, '../schema/migrations', '20251227000001_add_workflow_screenshots_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file:', migrationPath);
    console.log('📊 SQL size:', migrationSQL.length, 'bytes\n');

    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('\n📋 Created:');
    console.log('  - workflow_screenshots table');
    console.log('  - Vector and full-text search indexes');
    console.log('  - Workflow tag constraints');

    const result = await pool.query(`
      SELECT table_name,
        (SELECT count(*) FROM information_schema.columns WHERE table_name = 'workflow_screenshots') as column_count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'workflow_screenshots'
    `);

    if (result.rows.length > 0) {
      console.log('\n✓ Table verification:');
      console.log(`  - Table: ${result.rows[0].table_name}`);
      console.log(`  - Columns: ${result.rows[0].column_count}`);
    }

    const indexResult = await pool.query(`
      SELECT indexname FROM pg_indexes WHERE tablename = 'workflow_screenshots' ORDER BY indexname
    `);

    if (indexResult.rows.length > 0) {
      console.log(`\n✓ Indexes created: ${indexResult.rows.length}`);
      indexResult.rows.forEach(row => console.log(`  - ${row.indexname}`));
    }

  } catch (error: any) {
    if (error.message && error.message.includes('already exists')) {
      console.log('⚠️  Table already exists. Migration skipped.');
      console.log('✅ Database is up to date.');
    } else {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  } finally {
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('\n🎉 Workflow Analysis feature is ready to use!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
