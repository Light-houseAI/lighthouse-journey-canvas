/**
 * Database Migration Script for Graph RAG Schema Changes
 *
 * This script adds the following to support Graph RAG workflow analysis:
 * 1. New columns to workflow_screenshots (arango_activity_key, entities_extracted, concepts_extracted)
 * 2. New concept_embeddings table
 * 3. New entity_embeddings table
 * 4. Appropriate indexes for performance
 *
 * Usage:
 *   pnpm db:migrate:graph-rag
 */

import dotenv from 'dotenv';
import { Pool } from 'pg';


// Load environment variables
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

async function migrateGraphRAGSchema() {
  console.log('Starting Graph RAG schema migration...');

  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('Connected to PostgreSQL database successfully');

    // Step 1: Add new columns to workflow_screenshots
    console.log('Step 1: Adding new columns to workflow_screenshots table...');

    await pool.query(`
      ALTER TABLE workflow_screenshots
      ADD COLUMN IF NOT EXISTS arango_activity_key VARCHAR(255),
      ADD COLUMN IF NOT EXISTS entities_extracted JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS concepts_extracted JSONB DEFAULT '[]'::jsonb;
    `);

    console.log('✓ Added Graph RAG columns to workflow_screenshots');

    // Step 2: Create indexes on new columns
    console.log('Step 2: Creating indexes on new workflow_screenshots columns...');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ws_arango_activity
      ON workflow_screenshots(arango_activity_key);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ws_entities
      ON workflow_screenshots USING gin(entities_extracted);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ws_concepts
      ON workflow_screenshots USING gin(concepts_extracted);
    `);

    console.log('✓ Created indexes on workflow_screenshots');

    // Step 3: Create concept_embeddings table
    console.log('Step 3: Creating concept_embeddings table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS concept_embeddings (
        id SERIAL PRIMARY KEY,
        concept_name VARCHAR(255) NOT NULL UNIQUE,
        category VARCHAR(100),
        embedding vector(1536) NOT NULL,
        source_type VARCHAR(50),
        frequency INTEGER NOT NULL DEFAULT 1,
        first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        meta JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    console.log('✓ Created concept_embeddings table');

    // Step 4: Create indexes on concept_embeddings
    console.log('Step 4: Creating indexes on concept_embeddings...');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_concept_embeddings_vector
      ON concept_embeddings USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_concept_embeddings_category
      ON concept_embeddings(category);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_concept_embeddings_frequency
      ON concept_embeddings(frequency DESC);
    `);

    console.log('✓ Created indexes on concept_embeddings');

    // Step 5: Create entity_embeddings table
    console.log('Step 5: Creating entity_embeddings table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS entity_embeddings (
        id SERIAL PRIMARY KEY,
        entity_name VARCHAR(255) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        embedding vector(1536) NOT NULL,
        frequency INTEGER NOT NULL DEFAULT 1,
        first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        meta JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(entity_name, entity_type)
      );
    `);

    console.log('✓ Created entity_embeddings table');

    // Step 6: Create indexes on entity_embeddings
    console.log('Step 6: Creating indexes on entity_embeddings...');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_entity_embeddings_vector
      ON entity_embeddings USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_entity_embeddings_type
      ON entity_embeddings(entity_type);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_entity_embeddings_frequency
      ON entity_embeddings(frequency DESC);
    `);

    console.log('✓ Created indexes on entity_embeddings');

    // Verify the migration
    console.log('Verifying migration...');

    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name IN ('concept_embeddings', 'entity_embeddings')
      AND table_schema = 'public';
    `);

    const columnsResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'workflow_screenshots'
      AND column_name IN ('arango_activity_key', 'entities_extracted', 'concepts_extracted');
    `);

    console.log('✅ Graph RAG schema migration completed successfully!');
    console.log('');
    console.log('Migration Summary:');
    console.log(`  - New tables created: ${tablesResult.rows.map(r => r.table_name).join(', ')}`);
    console.log(`  - New columns in workflow_screenshots: ${columnsResult.rows.map(r => r.column_name).join(', ')}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run the ArangoDB initialization: pnpm db:init-arango');
    console.log('  2. Start the server: pnpm dev');
    console.log('  3. Test the Graph RAG workflow analysis feature');

    await pool.end();
    process.exit(0);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to migrate Graph RAG schema', new Error(errorMessage));
    console.error(error instanceof Error ? error.stack || '' : '');
    await pool.end();
    process.exit(1);
  }
}

// Run the migration
migrateGraphRAGSchema().catch((error) => {
  console.error('Unhandled error during migration', error);
  process.exit(1);
});
