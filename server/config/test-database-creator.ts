/**
 * Test Database Creator (Simplified)
 *
 * Creates isolated test databases using unified Drizzle migrations
 * No more manual schema creation - everything handled by migrations!
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'path';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TestDatabaseCreator {
  private static adminPool: Pool | null = null;
  private static createdDatabases = new Set<string>();
  private static templateDatabaseName = 'lighthouse_test';

  /**
   * Create a new test database using migrations (simplified approach)
   */
  static async createTestDatabaseFromTemplate(
    testDatabaseName: string
  ): Promise<void> {
    if (TestDatabaseCreator.createdDatabases.has(testDatabaseName)) {
      return; // Database already exists
    }

    const adminPool = await TestDatabaseCreator.getAdminPool();

    try {
      // Create empty database first
      await adminPool.query(`CREATE DATABASE "${testDatabaseName}"`);

      // Connect to new database and set up schema + fixture data
      const localConnectionString =
        process.env.TEST_DATABASE_URL ||
        'postgresql://test_user:test_password@localhost:5433/lighthouse_test';
      const url = new URL(localConnectionString);
      url.pathname = `/${testDatabaseName}`;

      const testPool = new Pool({
        connectionString: url.toString(),
        ssl: false, // Local Docker container - no SSL needed
      });

      // Handle expected connection terminations during cleanup
      testPool.on('error', (err: any) => {
        if (
          err.code === '57P01' &&
          err.message.includes(
            'terminating connection due to administrator command'
          )
        ) {
          // This is expected during database cleanup - suppress the error
        } else {
          console.error('Test database pool error:', err);
        }
      });

      try {
        // Create required extensions before migrations
        await testPool.query('CREATE EXTENSION IF NOT EXISTS vector');
        await testPool.query('CREATE SCHEMA IF NOT EXISTS mastra_ai');

        // 🚀 Run Drizzle migrations - handles ALL schema creation!
        console.log(`🔄 Running migrations for: ${testDatabaseName}`);
        const db = drizzle(testPool);
        await migrate(db, {
          migrationsFolder: path.join(__dirname, '../migrations'),
        });
        console.log(`✅ Migrations completed for: ${testDatabaseName}`);

        // 📊 Seed test data only (schema is handled by migrations)
        await TestDatabaseCreator.seedTestData(testPool);

        console.log(`✅ Created test database: ${testDatabaseName}`);
        TestDatabaseCreator.createdDatabases.add(testDatabaseName);
      } finally {
        await testPool.end();
      }
    } catch (error: any) {
      if (error.code === '42P04') {
        // Database already exists, that's okay
        TestDatabaseCreator.createdDatabases.add(testDatabaseName);
        console.log(`📋 Test database already exists: ${testDatabaseName}`);
      } else {
        console.error(
          `❌ Failed to create test database ${testDatabaseName}:`,
          error
        );
        throw error;
      }
    }
  }

  /**
   * Seed test data (no schema creation needed - handled by migrations)
   */
  private static async seedTestData(testPool: Pool): Promise<void> {
    // Create multiple test users for different test scenarios
    await testPool.query(`
      INSERT INTO users (id, email, password, first_name, last_name, user_name, interest, has_completed_onboarding, created_at)
      VALUES
        (1, 'test-user-1@example.com', '$2b$10$test.hash', 'Test', 'User1', 'user1', 'grow-career', true, NOW()),
        (2, 'test-user-2@example.com', '$2b$10$test.hash', 'Test', 'User2', 'user2', 'grow-career', true, NOW()),
        (3, 'test-user-3@example.com', '$2b$10$test.hash', 'Test', 'User3', 'user3', 'grow-career', true, NOW()),
        (123, 'test-user-123@example.com', '$2b$10$test.hash', 'Current', 'User', 'current_user', 'grow-career', true, NOW()),
        (456, 'test-user-456@example.com', '$2b$10$test.hash', 'Target', 'User', 'target_user', 'grow-career', true, NOW()),
        (999, 'test-user@example.com', '$2b$10$test.hash.for.test.user.only', 'Test', 'User', 'test_user_999', 'grow-career', true, '2025-07-30T20:40:16.433Z'::timestamp)
      ON CONFLICT (id) DO NOTHING
    `);

    // Create test organizations
    await testPool.query(`
      INSERT INTO organizations (id, name, type, created_at, updated_at)
      VALUES
        (1, 'Test Company', 'company', NOW(), NOW()),
        (2, 'Another Company', 'company', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);

    // Legacy profile data for compatibility
    await testPool.query(
      `
      INSERT INTO profiles (id, user_id, username, raw_data, filtered_data, projects, created_at)
      VALUES (999, 999, 'test-user', $1::jsonb, $2::jsonb, $3::jsonb, '2025-07-30T20:40:16.434Z'::timestamp)
      ON CONFLICT (id) DO NOTHING
    `,
      [
        JSON.stringify({
          name: 'Test User',
          headline: 'Software Engineer',
          location: 'Test City',
          experiences: [
            {
              title: { name: 'Software Engineer' },
              company: 'Test Company',
              start: 'Jan 2024',
              end: 'Present',
            },
          ],
          education: [
            {
              school: 'Test University',
              degree: 'Computer Science',
              start: '2020',
              end: '2024',
            },
          ],
          skills: ['JavaScript', 'TypeScript', 'Node.js'],
        }),
        JSON.stringify({
          name: 'Test User',
          headline: 'Software Engineer',
          location: 'Test City',
          experiences: [
            {
              title: { name: 'Software Engineer' },
              company: 'Test Company',
              start: 'Jan 2024',
              end: 'Present',
            },
          ],
          education: [
            {
              school: 'Test University',
              degree: 'Computer Science',
              start: '2020',
              end: '2024',
            },
          ],
          skills: ['JavaScript', 'TypeScript', 'Node.js'],
        }),
        JSON.stringify([]),
      ]
    );
  }

  /**
   * Create a new test database (cloud version - also simplified)
   */
  static async createTestDatabase(testDatabaseName: string): Promise<void> {
    if (TestDatabaseCreator.createdDatabases.has(testDatabaseName)) {
      return; // Database already exists
    }

    const adminPool = await TestDatabaseCreator.getAdminPool();

    try {
      // Create the database
      await adminPool.query(`CREATE DATABASE "${testDatabaseName}"`);

      // Connect to the new database and set up schema
      const testConnectionString = process.env.DATABASE_URL?.replace(
        /\/[^/]*$/,
        `/${testDatabaseName}`
      );
      if (!testConnectionString) {
        throw new Error('DATABASE_URL not configured');
      }

      // Configure SSL - node-postgres 8.0+ requires explicit SSL config
      let sslConfig: any = false;
      if (
        testConnectionString.includes('sslmode=require') ||
        testConnectionString.includes('ssl=true') ||
        testConnectionString.includes('sslmode=prefer')
      ) {
        sslConfig = { rejectUnauthorized: false };
      } else if (testConnectionString.includes('sslmode=disable')) {
        sslConfig = false;
      } else {
        sslConfig = { rejectUnauthorized: false };
      }

      const testPool = new Pool({
        connectionString: testConnectionString,
        ssl: sslConfig,
      });

      try {
        // Create required extensions before migrations
        await testPool.query('CREATE EXTENSION IF NOT EXISTS vector');
        await testPool.query('CREATE SCHEMA IF NOT EXISTS mastra_ai');

        // 🚀 Run Drizzle migrations - handles ALL schema creation!
        console.log(`🔄 Running migrations for: ${testDatabaseName}`);
        const db = drizzle(testPool);
        await migrate(db, {
          migrationsFolder: path.join(__dirname, '../migrations'),
        });

        console.log(
          `✅ Created test database with migrations: ${testDatabaseName}`
        );
        TestDatabaseCreator.createdDatabases.add(testDatabaseName);
      } finally {
        await testPool.end();
      }
    } catch (error: any) {
      if (error.code === '42P04') {
        // Database already exists, that's okay
        TestDatabaseCreator.createdDatabases.add(testDatabaseName);
        console.log(`📋 Test database already exists: ${testDatabaseName}`);
      } else {
        console.error(
          `❌ Failed to create test database ${testDatabaseName}:`,
          error
        );
        throw error;
      }
    }
  }

  /**
   * Drop a test database
   */
  static async dropTestDatabase(testDatabaseName: string): Promise<void> {
    if (!TestDatabaseCreator.createdDatabases.has(testDatabaseName)) {
      return; // Database doesn't exist in our tracking
    }

    const adminPool = await TestDatabaseCreator.getAdminPool();

    try {
      // Terminate connections to the database
      await adminPool.query(
        `
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()
      `,
        [testDatabaseName]
      );

      // Drop the database
      await adminPool.query(`DROP DATABASE IF EXISTS "${testDatabaseName}"`);

      TestDatabaseCreator.createdDatabases.delete(testDatabaseName);
      console.log(`🧹 Dropped test database: ${testDatabaseName}`);
    } catch (error) {
      console.warn(
        `⚠️ Error dropping test database ${testDatabaseName}:`,
        error
      );
      // Don't throw - cleanup should be best effort
    }
  }

  /**
   * Clean up all created test databases
   */
  static async cleanupAllTestDatabases(): Promise<void> {
    console.log(
      `🧹 Cleaning up ${TestDatabaseCreator.createdDatabases.size} test databases...`
    );

    const cleanupPromises = Array.from(
      TestDatabaseCreator.createdDatabases
    ).map((dbName) => TestDatabaseCreator.dropTestDatabase(dbName));

    await Promise.all(cleanupPromises);

    // Close admin pool
    if (TestDatabaseCreator.adminPool) {
      await TestDatabaseCreator.adminPool.end();
      TestDatabaseCreator.adminPool = null;
    }
  }

  /**
   * Get admin connection pool for database operations
   */
  private static async getAdminPool(): Promise<Pool> {
    if (!TestDatabaseCreator.adminPool) {
      // Use default Docker PostgreSQL connection if TEST_DATABASE_URL not set
      const adminConnectionString =
        process.env.TEST_DATABASE_URL ||
        'postgresql://test_user:test_password@localhost:5433/lighthouse_test';

      if (!adminConnectionString) {
        throw new Error('TEST_DATABASE_URL must be set for testing');
      }

      // Configure SSL - local Docker containers don't need SSL
      let sslConfig: any = false;
      if (adminConnectionString.includes('localhost:5433')) {
        sslConfig = false;
      } else if (
        adminConnectionString.includes('sslmode=require') ||
        adminConnectionString.includes('ssl=true') ||
        adminConnectionString.includes('sslmode=prefer')
      ) {
        sslConfig = { rejectUnauthorized: false };
      } else if (adminConnectionString.includes('sslmode=disable')) {
        sslConfig = false;
      } else {
        sslConfig = { rejectUnauthorized: false };
      }

      TestDatabaseCreator.adminPool = new Pool({
        connectionString: adminConnectionString,
        max: 2, // Limited connections for admin operations
        ssl: sslConfig,
      });

      // Handle expected connection terminations during cleanup
      TestDatabaseCreator.adminPool.on('error', (err: any) => {
        if (
          err.code === '57P01' &&
          err.message.includes(
            'terminating connection due to administrator command'
          )
        ) {
          // This is expected during database cleanup - suppress the error
        } else {
          console.error('Admin database pool error:', err);
        }
      });
    }

    return TestDatabaseCreator.adminPool;
  }

  /**
   * Check if database exists
   */
  static async databaseExists(testDatabaseName: string): Promise<boolean> {
    const adminPool = await TestDatabaseCreator.getAdminPool();

    try {
      const result = await adminPool.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [testDatabaseName]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking database existence:', error);
      return false;
    }
  }
}
