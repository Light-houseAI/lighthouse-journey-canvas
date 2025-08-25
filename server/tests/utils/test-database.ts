/**
 * Test Database Manager
 *
 * Manages isolated test databases and user data for parallel testing
 */

import type { Profile, User, UserSkill } from '@shared/schema';
import {
  nodeInsights,
  nodePolicies,
  orgMembers,
  profiles,
  timelineNodeClosure,
  timelineNodes,
  users,
  userSkills,
} from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

import { createSimplifiedCareerAgent } from '../../../server/services/ai/simplified-career-agent.js';
import { DatabaseConfig, TestingConfig } from '../../config/database-config.js';
import { DatabaseFactory } from '../../config/database-factory.js';
import { TestDatabaseCreator } from '../../config/test-database-creator.js';

export class TestDatabaseManager {
  static readonly TEST_USER_ID = 999;
  private static instance: TestDatabaseManager;
  private static testAgents = new Map<string, any>();
  private static testDatabases = new Map<string, { pool: Pool; db: any }>();

  static getInstance(): TestDatabaseManager {
    if (!TestDatabaseManager.instance) {
      TestDatabaseManager.instance = new TestDatabaseManager();
    }
    return TestDatabaseManager.instance;
  }

  private constructor() {}

  /**
   * Create an isolated agent with its own PostgreSQL test database for parallel testing
   */
  static async createIsolatedAgent(testId: string) {
    // Check if agent already exists for this test
    if (TestDatabaseManager.testAgents.has(testId)) {
      return TestDatabaseManager.testAgents.get(testId);
    }

    try {
      // Create test-specific database configuration with unique database name
      const dbConfig = await DatabaseFactory.createConfig({
        environment: 'test',
        testId,
      });

      // Create agent with isolated database
      const agent = await createSimplifiedCareerAgent({
        databaseConfig: dbConfig,
      });

      // Cache the agent for this test
      TestDatabaseManager.testAgents.set(testId, agent);

      console.log(
        `✅ Created isolated agent with PostgreSQL test database: ${testId}`
      );
      return agent;
    } catch (error) {
      console.error(
        `❌ Failed to create isolated agent for test ${testId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Create isolated database configuration for a test
   */
  static async createTestConfig(testId: string): Promise<DatabaseConfig> {
    return DatabaseFactory.createConfig({
      environment: 'test',
      testId,
    });
  }

  /**
   * Get database connection for a specific test
   */
  static async getTestDatabase(
    testId?: string
  ): Promise<{ pool: Pool; db: any }> {
    const dbKey = testId || 'default';

    if (TestDatabaseManager.testDatabases.has(dbKey)) {
      return TestDatabaseManager.testDatabases.get(dbKey)!;
    }

    // Create database connection for this test
    let connectionString: string;

    if (testId) {
      // Use isolated test database
      const config = await TestDatabaseManager.createTestConfig(testId);
      connectionString = config.connectionString;
    } else {
      // Use default test database
      connectionString =
        process.env.TEST_DATABASE_URL ||
        'postgresql://test_user:test_password@localhost:5433/lighthouse_test';
    }

    const pool = new Pool({
      connectionString,
      ssl: false, // Local Docker container - no SSL needed
    });

    // Handle expected connection terminations during cleanup
    pool.on('error', (err: any) => {
      if (
        err.code === '57P01' &&
        err.message.includes(
          'terminating connection due to administrator command'
        )
      ) {
        // This is expected during database cleanup - suppress the error
        console.log(`🧹 Connection terminated during cleanup (expected)`);
      } else {
        console.error('Database pool error:', err);
      }
    });

    const db = drizzle(pool, { schema: { users, profiles, userSkills } });

    const connection = { pool, db };
    TestDatabaseManager.testDatabases.set(dbKey, connection);

    return connection;
  }

  /**
   * Cleanup test agent and database
   */
  static async cleanup(testId: string): Promise<void> {
    if (TestDatabaseManager.testAgents.has(testId)) {
      const agent = TestDatabaseManager.testAgents.get(testId);

      // Get the database config to find the test database name
      const dbConfig = (await DatabaseFactory.createConfig({
        environment: 'test',
        testId,
      })) as TestingConfig;

      // Close database connection if exists
      if (TestDatabaseManager.testDatabases.has(testId)) {
        const { pool } = TestDatabaseManager.testDatabases.get(testId)!;
        try {
          await pool.end();
        } catch (error: any) {
          // Ignore connection termination errors during cleanup
          if (error.code !== '57P01') {
            console.warn(
              `⚠️ Error closing database connection for ${testId}:`,
              error.message
            );
          }
        }
        TestDatabaseManager.testDatabases.delete(testId);
      }

      // Drop the test database
      await TestDatabaseCreator.dropTestDatabase(dbConfig.testDatabaseName);

      TestDatabaseManager.testAgents.delete(testId);
      console.log(`🧹 Cleaned up test agent and database: ${testId}`);
    }
  }

  /**
   * Cleanup all test agents (for global teardown)
   */
  static async cleanupAll(): Promise<void> {
    console.log(
      `🧹 Cleaning up ${TestDatabaseManager.testAgents.size} test agents`
    );

    const cleanupPromises = Array.from(
      TestDatabaseManager.testAgents.keys()
    ).map((testId) => TestDatabaseManager.cleanup(testId));

    await Promise.all(cleanupPromises);

    // Close any remaining database connections
    for (const [key, { pool }] of TestDatabaseManager.testDatabases) {
      try {
        await pool.end();
      } catch (error: any) {
        // Ignore connection termination errors during cleanup
        if (error.code !== '57P01') {
          console.warn(
            `⚠️ Error closing database connection ${key}:`,
            error.message
          );
        }
      }
    }
    TestDatabaseManager.testDatabases.clear();

    // Cleanup any remaining test databases
    await TestDatabaseCreator.cleanupAllTestDatabases();

    TestDatabaseManager.testAgents.clear();
  }

  /**
   * Load template data from fixture files
   */
  private loadTemplates() {
    const fixturesDir = join(process.cwd(), 'server', 'tests', 'fixtures');

    try {
      const userTemplate = JSON.parse(
        readFileSync(join(fixturesDir, 'test-user-template.json'), 'utf8')
      );

      const profileTemplate = JSON.parse(
        readFileSync(join(fixturesDir, 'test-profile-template.json'), 'utf8')
      );

      let skillsTemplate = [];
      try {
        skillsTemplate = JSON.parse(
          readFileSync(join(fixturesDir, 'test-skills-template.json'), 'utf8')
        );
      } catch {
        // Skills template might be empty
      }

      return { userTemplate, profileTemplate, skillsTemplate };
    } catch (error) {
      throw new Error(`Failed to load test templates: ${error}`);
    }
  }

  /**
   * Setup test user with fresh data from templates
   */
  async setupTestUser(testId?: string): Promise<void> {
    console.log(
      `🔧 Setting up test user (ID: ${TestDatabaseManager.TEST_USER_ID})...`
    );

    const { userTemplate, profileTemplate, skillsTemplate } =
      this.loadTemplates();
    const { db } = await TestDatabaseManager.getTestDatabase(testId);

    // Remove any existing test user data first
    await this.cleanupTestUser(testId);

    try {
      // Insert user (handle duplicate key)
      try {
        await db.insert(users).values({
          id: TestDatabaseManager.TEST_USER_ID,
          email: userTemplate.email,
          password: userTemplate.password,
          interest: userTemplate.interest,
          hasCompletedOnboarding: userTemplate.hasCompletedOnboarding,
        });
      } catch (insertError: any) {
        if (insertError.code === '23505') {
          // User already exists, that's okay - just skip insertion
          console.log(
            `📋 Test user already exists (ID: ${TestDatabaseManager.TEST_USER_ID})`
          );
        } else {
          throw insertError;
        }
      }

      // Insert profile if exists
      if (profileTemplate) {
        try {
          await db.insert(profiles).values({
            id: TestDatabaseManager.TEST_USER_ID,
            userId: TestDatabaseManager.TEST_USER_ID,
            username: profileTemplate.username,
            rawData: profileTemplate.rawData,
            filteredData: profileTemplate.filteredData,
            projects: profileTemplate.projects || [],
          });
        } catch (profileError: any) {
          if (profileError.code === '23505') {
            // Profile already exists, that's okay
            console.log(
              `📋 Test profile already exists (ID: ${TestDatabaseManager.TEST_USER_ID})`
            );
          } else {
            throw profileError;
          }
        }
      }

      // Insert skills if exist
      if (skillsTemplate && skillsTemplate.length > 0) {
        const skillsData = skillsTemplate.map((skill: any) => ({
          ...skill,
          userId: TestDatabaseManager.TEST_USER_ID,
        }));
        await db.insert(userSkills).values(skillsData);
      }

      // Clear and sync profile data to vector database to ensure consistency
      // Skip in test environment if we're doing rapid test iterations
      if (profileTemplate && process.env.NODE_ENV !== 'test') {
        try {
          const { profileVectorManager } = await import(
            '../../services/ai/profile-vector-manager.js'
          );

          // Use the new sync method that checks and only syncs if needed
          await profileVectorManager.syncVectorWithProfile(
            TestDatabaseManager.TEST_USER_ID.toString(),
            profileTemplate
          );
          console.log(`✅ Vector database sync completed`);
        } catch (error) {
          console.log(
            `⚠️ Vector database sync failed (continuing without it):`,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      } else if (profileTemplate) {
        console.log(`⚪ Skipping vector database sync in test environment`);
      }

      console.log(`✅ Test user setup completed`);
      console.log(`   - User ID: ${TestDatabaseManager.TEST_USER_ID}`);
      console.log(`   - Email: ${userTemplate.email}`);
      console.log(`   - Profile: ${profileTemplate ? 'Created' : 'None'}`);
      console.log(`   - Skills: ${skillsTemplate.length} records`);
    } catch (error) {
      console.error('❌ Error setting up test user:', error);
      throw error;
    }
  }

  /**
   * Reset test user data to fresh state
   */
  async resetTestUserData(testId?: string): Promise<void> {
    console.log(`🔄 Resetting test user data...`);

    try {
      // Use the comprehensive cleanup method
      await this.cleanupTestUser(testId);

      // Re-setup with fresh data
      await this.setupTestUser(testId);
    } catch (error) {
      console.error('❌ Error resetting test user data:', error);
      throw error;
    }
  }

  /**
   * Clean up test user completely
   */
  async cleanupTestUser(testId?: string): Promise<void> {
    try {
      const { db } = await TestDatabaseManager.getTestDatabase(testId);

      // Delete in reverse order due to foreign key constraints
      // Start with the deepest dependencies and work up to users

      // Delete node policies (depends on timeline_nodes and users)
      await db
        .delete(nodePolicies)
        .where(
          inArray(
            nodePolicies.nodeId,
            db
              .select({ id: timelineNodes.id })
              .from(timelineNodes)
              .where(eq(timelineNodes.userId, TestDatabaseManager.TEST_USER_ID))
          )
        );

      // Delete timeline node closure entries (depends on timeline_nodes)
      await db
        .delete(timelineNodeClosure)
        .where(
          inArray(
            timelineNodeClosure.ancestorId,
            db
              .select({ id: timelineNodes.id })
              .from(timelineNodes)
              .where(eq(timelineNodes.userId, TestDatabaseManager.TEST_USER_ID))
          )
        );
      await db
        .delete(timelineNodeClosure)
        .where(
          inArray(
            timelineNodeClosure.descendantId,
            db
              .select({ id: timelineNodes.id })
              .from(timelineNodes)
              .where(eq(timelineNodes.userId, TestDatabaseManager.TEST_USER_ID))
          )
        );

      // Delete node insights (depends on timeline_nodes)
      await db
        .delete(nodeInsights)
        .where(
          inArray(
            nodeInsights.nodeId,
            db
              .select({ id: timelineNodes.id })
              .from(timelineNodes)
              .where(eq(timelineNodes.userId, TestDatabaseManager.TEST_USER_ID))
          )
        );

      // Delete timeline nodes (depends on users)
      await db
        .delete(timelineNodes)
        .where(eq(timelineNodes.userId, TestDatabaseManager.TEST_USER_ID));

      // Delete organization memberships (depends on users)
      await db
        .delete(orgMembers)
        .where(eq(orgMembers.userId, TestDatabaseManager.TEST_USER_ID));

      // Delete user skills (depends on users)
      await db
        .delete(userSkills)
        .where(eq(userSkills.userId, TestDatabaseManager.TEST_USER_ID));

      // Delete profiles (depends on users)
      await db
        .delete(profiles)
        .where(eq(profiles.userId, TestDatabaseManager.TEST_USER_ID));

      // Finally delete the user
      await db
        .delete(users)
        .where(eq(users.id, TestDatabaseManager.TEST_USER_ID));

      console.log(`🧹 Test user cleanup completed`);
    } catch (error) {
      // Don't throw on cleanup errors - might not exist
      console.log(`⚠️  Cleanup warning (safe to ignore): ${error}`);
    }
  }

  /**
   * Verify test user exists and has expected data
   */
  async verifyTestUser(testId?: string): Promise<boolean> {
    try {
      const { db } = await TestDatabaseManager.getTestDatabase(testId);

      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, TestDatabaseManager.TEST_USER_ID))
        .limit(1);

      const profile = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, TestDatabaseManager.TEST_USER_ID))
        .limit(1);

      return user.length > 0 && profile.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get test user profile data
   */
  async getTestUserProfile(testId?: string) {
    const { db } = await TestDatabaseManager.getTestDatabase(testId);

    const profile = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, TestDatabaseManager.TEST_USER_ID))
      .limit(1);

    return profile.length > 0 ? profile[0] : null;
  }
}
