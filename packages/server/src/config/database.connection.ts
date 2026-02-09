import * as schema from "@journey/schema";
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { DatabaseFactory } from './database-factory.js';

/**
 * Database factory function for Awilix DI container
 * This will be registered as a singleton to ensure single database instance
 */
export async function createDatabaseConnection() {
  console.log('🔄 Creating database connection...');

  // Create database configuration based on environment
  const config = await DatabaseFactory.createConfig();

  // Create connection pool with environment-appropriate configuration
  const pool = new Pool({
    connectionString: config.connectionString,
    ssl: config.type === 'postgresql' ? config.ssl : false,
    ...config.pgPoolOptions,
  });

  // Set HNSW search parameter on each new connection for optimal vector search performance
  pool.on('connect', (client) => {
    client.query('SET hnsw.ef_search = 64').catch(() => {
      // Silently ignore if pgvector/HNSW not available (e.g., test environments)
    });
  });

  const db = drizzle(pool, { schema });

  // Store pool reference on the db object for cleanup
  (db as any).__pool = pool;

  console.log('✅ Database connection created');
  console.log('🔍 Returning db - type:', typeof db);
  console.log('🔍 Returning db - select type:', typeof db?.select);
  console.log('🔍 Returning db - constructor:', db?.constructor?.name);
  return db;
}

/**
 * Get pool instance from database (for session middleware)
 * This is needed for express-session store configuration
 */
export function getPoolFromDatabase(db: any) {
  return db.__pool;
}

/**
 * Get database instance from container (for AI services and standalone usage)
 * This provides access to the database outside of the DI system
 */
export function getDatabaseInstance() {
  try {
    const { Container } = require('../core/container-setup.js');
    const { CONTAINER_TOKENS } = require('../core/container-tokens.js');
    const container = Container.getContainer();
    return container.resolve(CONTAINER_TOKENS.DATABASE);
  } catch (error) {
    console.error('Error getting database instance from container:', error);
    throw new Error('Database not initialized. Make sure container is configured first.');
  }
}

/**
 * Disposer function for cleaning up database connections
 * This will be called when the Awilix container is disposed
 */
export async function disposeDatabaseConnection(db: any) {
  console.log('🧹 Closing database connection...');
  if (db.__pool) {
    await db.__pool.end();
  }
  console.log('✅ Database connection closed');
}
