// Test-friendly database configuration
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema";
import { createMockDb, mockPool } from './db-mock';

neonConfig.webSocketConstructor = ws;

let db: any;
let pool: any;

// Initialize database with fallback to mock
const initializeDatabase = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.log('⚠️  No DATABASE_URL found, using mock database for testing');
    pool = mockPool;
    db = createMockDb();
    return { db, pool };
  }

  try {
    // Test the connection first
    const testPool = new Pool({ 
      connectionString: databaseUrl,
      connectionTimeoutMillis: 5000, // 5 second timeout
    });
    
    // Try to connect
    const client = await testPool.connect();
    await client.query('SELECT 1');
    client.release();
    
    console.log('✅ PostgreSQL connection successful');
    
    // Use real database
    pool = testPool;
    db = drizzle({ client: pool, schema });
    
  } catch (error) {
    console.log('⚠️  PostgreSQL connection failed, using mock database');
    console.log(`   Error: ${error.message}`);
    
    // Use mock database
    pool = mockPool;
    db = createMockDb();
  }
  
  return { db, pool };
};

// Initialize immediately
const dbPromise = initializeDatabase();

// Export promise-based access
export const getDb = async () => {
  const { db } = await dbPromise;
  return db;
};

export const getPool = async () => {
  const { pool } = await dbPromise;
  return pool;
};

// For backwards compatibility, export synchronous versions that will work after initialization
export let pool_sync: any;
export let db_sync: any;

dbPromise.then(({ db: dbInstance, pool: poolInstance }) => {
  pool_sync = poolInstance;
  db_sync = dbInstance;
});

// Default exports for immediate use (will be undefined until initialized)
export { db_sync as db, pool_sync as pool };