#!/usr/bin/env tsx
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Ensure migration tracking table exists
 */
async function ensureMigrationTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "_custom_migrations" (
      "name" varchar(255) PRIMARY KEY,
      "executed_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
}

/**
 * Check if a migration has already been run
 */
async function isMigrationExecuted(pool: Pool, name: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM "_custom_migrations" WHERE name = $1',
    [name]
  );
  return result.rows.length > 0;
}

/**
 * Record that a migration has been executed
 */
async function recordMigration(pool: Pool, name: string): Promise<void> {
  await pool.query(
    'INSERT INTO "_custom_migrations" (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
    [name]
  );
}

/**
 * Run SQL migration file directly (idempotent - only runs once)
 */
async function runSqlMigration(pool: Pool, migrationPath: string, name: string): Promise<boolean> {
  // Check if already executed
  if (await isMigrationExecuted(pool, name)) {
    console.log(`⏭️  ${name} already executed - skipping`);
    return true;
  }

  if (!fs.existsSync(migrationPath)) {
    console.log(`⚠️  ${name} migration file not found - skipping`);
    return false;
  }

  console.log(`📄 Running ${name} migration...`);
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  try {
    await pool.query(migrationSQL);
    await recordMigration(pool, name);
    console.log(`✅ ${name} migration completed`);
    return true;
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      // Table exists but wasn't tracked - record it now
      await recordMigration(pool, name);
      console.log(`⚠️  ${name} already exists - marking as executed`);
      return true;
    }
    throw error;
  }
}

/**
 * Run Drizzle migrations for either production or test databases
 * Uses environment detection to determine which database to migrate
 */
async function runMigrations() {
  const isTest = process.env.NODE_ENV === 'test';
  const databaseUrl = isTest
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

  if (!databaseUrl) {
    const requiredVar = isTest ? 'TEST_DATABASE_URL' : 'DATABASE_URL';
    throw new Error(`${requiredVar} is required to run migrations`);
  }

  console.log(
    `🔄 Running migrations for ${isTest ? 'test' : 'production'} database...`
  );
  console.log(`📁 Migrations folder: ${path.join(__dirname, '../migrations')}`);

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const db = drizzle(pool);

    // Run Drizzle migrations first
    await migrate(db, {
      migrationsFolder: path.join(__dirname, '../migrations'),
    });

    console.log('✅ Drizzle migrations completed');

    // Ensure custom migration tracking table exists
    await ensureMigrationTable(pool);

    // Run additional SQL migrations for workflow analysis
    console.log('\n🔄 Running additional SQL migrations...');

    // workflow_screenshots table
    const workflowMigrationPath = path.join(
      __dirname,
      '../../schema/migrations/20251227000001_add_workflow_screenshots_table.sql'
    );
    await runSqlMigration(pool, workflowMigrationPath, 'workflow_screenshots');

    // Verify workflow_screenshots table
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'workflow_screenshots'
    `);

    if (result.rows.length > 0) {
      const indexResult = await pool.query(`
        SELECT COUNT(*) as count FROM pg_indexes WHERE tablename = 'workflow_screenshots'
      `);
      console.log(`✓ workflow_screenshots table verified with ${indexResult.rows[0].count} indexes`);
    }

    console.log('\n✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}

// Export for programmatic use (e.g., from test setup)
export { runMigrations };
