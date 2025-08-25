#!/usr/bin/env tsx
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'path';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    // Run migrations
    await migrate(db, {
      migrationsFolder: path.join(__dirname, '../migrations'),
    });

    console.log('✅ Migrations completed successfully');
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
