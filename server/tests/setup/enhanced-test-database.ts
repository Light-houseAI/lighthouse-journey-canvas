/**
 * Enhanced Test Database Infrastructure
 *
 * Provides real PostgreSQL database testing following memory-documented patterns:
 * 1. Each test suite gets isolated database
 * 2. Real database transactions and constraints
 * 3. Proper cleanup between tests
 * 4. Support for parallel test execution
 * 5. Container-based dependency injection with real repositories
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { beforeEach, afterEach, afterAll } from 'vitest';
import type { AwilixContainer } from 'awilix';
import { createContainer, asClass, asValue, Lifetime } from 'awilix';

import { DatabaseFactory } from '../../config/database-factory.js';
import { TestDatabaseCreator } from '../../config/test-database-creator.js';
import type { DatabaseConfig, TestingConfig } from '../../config/database-config.js';

// Import production services and repositories
import { HierarchyService } from '../../services/hierarchy.service.js';
import { NodePermissionService } from '../../services/node-permission.service.js';
import { OrganizationService } from '../../services/organization.service.js';
import { AuthService } from '../../services/auth.service.js';

import { HierarchyRepository } from '../../repositories/hierarchy.repository.js';
import { NodePermissionRepository } from '../../repositories/node-permission.repository.js';
import { OrganizationRepository } from '../../repositories/organization.repository.js';
import { UserRepository } from '../../repositories/user.repository.js';
import { InsightRepository } from '../../repositories/insight.repository.js';

import { createLogger } from '../../core/logger.js';

export interface TestDatabaseContext {
  container: AwilixContainer;
  db: ReturnType<typeof drizzle>;
  dbConfig: TestingConfig;
  testId: string;
  cleanup: () => Promise<void>;
}

export class EnhancedTestDatabase {
  private static activeContexts = new Map<string, TestDatabaseContext>();
  private static globalCleanupScheduled = false;

  /**
   * Create isolated test database context for a test suite
   * This follows the memory pattern of using real services with real databases
   */
  static async createContext(testSuiteName?: string): Promise<TestDatabaseContext> {
    const testId = testSuiteName 
      ? `${testSuiteName}_${Date.now()}_${Math.random().toString(36).substring(7)}`
      : `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    console.log(`🔧 Creating test database context: ${testId}`);

    try {
      // Create isolated test database configuration
      const dbConfig = await DatabaseFactory.createConfig({
        environment: 'test',
        testId,
      }) as TestingConfig;

      // Create database connection pool
      const pool = new Pool({
        connectionString: dbConfig.connectionString,
        ssl: false,
        max: 5,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000,
      });

      // Handle expected connection terminations during cleanup
      pool.on('error', (err: any) => {
        if (err.code === '57P01' && err.message.includes('terminating connection due to administrator command')) {
          console.log(`🧹 Connection terminated during cleanup (expected)`);
        } else {
          console.error('Database pool error:', err);
        }
      });

      // Create Drizzle database instance
      const db = drizzle(pool);

      // Create Awilix container with real services and repositories
      const container = EnhancedTestDatabase.createTestContainer(db, dbConfig);

      // Define cleanup function
      const cleanup = async () => {
        try {
          await pool.end();
          await TestDatabaseCreator.dropTestDatabase(dbConfig.testDatabaseName);
          EnhancedTestDatabase.activeContexts.delete(testId);
          console.log(`🧹 Cleaned up test database context: ${testId}`);
        } catch (error: any) {
          if (error.code !== '57P01') {
            console.warn(`⚠️ Error during cleanup of ${testId}:`, error.message);
          }
        }
      };

      const context: TestDatabaseContext = {
        container,
        db,
        dbConfig,
        testId,
        cleanup,
      };

      EnhancedTestDatabase.activeContexts.set(testId, context);
      EnhancedTestDatabase.scheduleGlobalCleanup();

      console.log(`✅ Created test database context: ${testId}`);
      return context;

    } catch (error) {
      console.error(`❌ Failed to create test database context: ${testId}`, error);
      throw error;
    }
  }

  /**
   * Create Awilix container with real services and repositories
   * This follows the memory pattern of using production-identical dependency injection
   */
  private static createTestContainer(db: ReturnType<typeof drizzle>, dbConfig: DatabaseConfig): AwilixContainer {
    const container = createContainer();

    // Create test logger
    const logger = createLogger({ level: 'warn' }); // Quiet during tests

    // Register core dependencies
    container.register({
      // Database and configuration
      db: asValue(db),
      dbConfig: asValue(dbConfig),
      logger: asValue(logger),

      // Repositories - singleton instances with real database
      hierarchyRepository: asClass(HierarchyRepository, { lifetime: Lifetime.SINGLETON }),
      nodePermissionRepository: asClass(NodePermissionRepository, { lifetime: Lifetime.SINGLETON }),
      organizationRepository: asClass(OrganizationRepository, { lifetime: Lifetime.SINGLETON }),
      userRepository: asClass(UserRepository, { lifetime: Lifetime.SINGLETON }),
      insightRepository: asClass(InsightRepository, { lifetime: Lifetime.SINGLETON }),

      // Services - singleton instances for consistency
      hierarchyService: asClass(HierarchyService, { lifetime: Lifetime.SINGLETON }),
      nodePermissionService: asClass(NodePermissionService, { lifetime: Lifetime.SINGLETON }),
      organizationService: asClass(OrganizationService, { lifetime: Lifetime.SINGLETON }),
      authService: asClass(AuthService, { lifetime: Lifetime.SINGLETON }),
    });

    return container;
  }

  /**
   * Setup Vitest hooks for automatic test isolation
   * This follows the memory pattern of AAA with real service setup
   */
  static setupTestHooks(contextProvider: () => Promise<TestDatabaseContext> | TestDatabaseContext) {
    let context: TestDatabaseContext;

    beforeEach(async () => {
      context = await contextProvider();
      
      // Optional: Clear any existing test data
      // Note: Since we use isolated databases, this is usually not needed
      // but can be useful for debugging or specific test scenarios
    });

    afterEach(async () => {
      // Database is automatically isolated, so individual cleanup is minimal
      // The context will be cleaned up when the test suite completes
    });

    return {
      getContext: () => context,
      getContainer: () => context.container,
      getDb: () => context.db,
    };
  }

  /**
   * Batch create test data following memory patterns
   * Uses real services to establish realistic test state
   */
  static async createTestData(container: AwilixContainer) {
    const hierarchyService = container.resolve<HierarchyService>('hierarchyService');
    const organizationService = container.resolve<OrganizationService>('organizationService');
    const authService = container.resolve<AuthService>('authService');

    // Create test users using real auth service
    const testOwner = await authService.register({
      email: 'test.owner@example.com',
      password: 'TestPassword123!',
      interest: 'Technology'
    });

    const testMember = await authService.register({
      email: 'test.member@example.com', 
      password: 'TestPassword123!',
      interest: 'Design'
    });

    const testPublic = await authService.register({
      email: 'test.public@example.com',
      password: 'TestPassword123!', 
      interest: 'Marketing'
    });

    // Create test organization using real service
    const testOrg = await organizationService.createOrganization({
      name: 'Test Organization',
      type: 'company' as any,
      metadata: { description: 'Test organization for integration tests' }
    });

    // Add members using real service
    await organizationService.addMember(testOrg.id, {
      userId: testOwner.user.id,
      role: 'admin' as any
    });

    await organizationService.addMember(testOrg.id, {
      userId: testMember.user.id,
      role: 'member' as any
    });

    // Create test timeline nodes using real service
    const testJob = await hierarchyService.createNode({
      type: 'job' as any,
      meta: {
        title: 'Senior Software Engineer',
        company: 'Test Company',
        startDate: '2023-01',
        description: 'Test job for integration testing'
      }
    }, testOwner.user.id);

    const testProject = await hierarchyService.createNode({
      type: 'project' as any,
      parentId: testJob.id,
      meta: {
        title: 'Test Project',
        description: 'Test project for integration testing',
        technologies: ['TypeScript', 'Node.js', 'PostgreSQL']
      }
    }, testOwner.user.id);

    return {
      users: {
        owner: testOwner.user,
        member: testMember.user,
        publicUser: testPublic.user,
        anonymous: null, // Represents unauthenticated user
      },
      organization: testOrg,
      nodes: {
        job: testJob,
        project: testProject,
      }
    };
  }

  /**
   * Schedule global cleanup on process exit
   */
  private static scheduleGlobalCleanup() {
    if (EnhancedTestDatabase.globalCleanupScheduled) return;

    EnhancedTestDatabase.globalCleanupScheduled = true;

    const cleanup = async () => {
      console.log(`🧹 Cleaning up ${EnhancedTestDatabase.activeContexts.size} test database contexts`);
      
      const cleanupPromises = Array.from(EnhancedTestDatabase.activeContexts.values())
        .map(context => context.cleanup());

      await Promise.allSettled(cleanupPromises);
      EnhancedTestDatabase.activeContexts.clear();
    };

    // Cleanup on various exit scenarios
    process.on('exit', () => { cleanup().catch(console.error); });
    process.on('SIGINT', () => { cleanup().then(() => process.exit(0)); });
    process.on('SIGTERM', () => { cleanup().then(() => process.exit(0)); });
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      cleanup().then(() => process.exit(1));
    });

    // Register global teardown for test runner
    afterAll(async () => {
      await cleanup();
    });
  }

  /**
   * Cleanup all active contexts (for global teardown)
   */
  static async cleanupAll(): Promise<void> {
    console.log(`🧹 Cleaning up all ${EnhancedTestDatabase.activeContexts.size} test database contexts`);

    const cleanupPromises = Array.from(EnhancedTestDatabase.activeContexts.values())
      .map(context => context.cleanup());

    await Promise.allSettled(cleanupPromises);
    EnhancedTestDatabase.activeContexts.clear();
    
    // Also cleanup any remaining test databases
    await TestDatabaseCreator.cleanupAllTestDatabases();
  }
}