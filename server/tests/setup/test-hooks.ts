/**
 * Vitest Test Hooks Configuration
 *
 * Provides standardized test setup following memory-documented patterns:
 * 1. Real database setup with Awilix container
 * 2. AAA pattern utilities
 * 3. Test data builders for consistent state
 * 4. Automatic cleanup and isolation
 */

import { beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import type { AwilixContainer } from 'awilix';

import { EnhancedTestDatabase, type TestDatabaseContext } from './enhanced-test-database.js';

export interface TestContext {
  container: AwilixContainer;
  db: ReturnType<typeof import('drizzle-orm/node-postgres').drizzle>;
  testId: string;
  testData?: any;
}

/**
 * Setup test context with real database and services
 * Use this for integration tests that need real database state
 */
export function setupIntegrationTestContext(options: {
  suiteName?: string;
  withTestData?: boolean;
} = {}) {
  let context: TestDatabaseContext;
  let testData: any;

  beforeAll(async () => {
    context = await EnhancedTestDatabase.createContext(options.suiteName);
    
    if (options.withTestData) {
      testData = await EnhancedTestDatabase.createTestData(context.container);
    }
  });

  afterAll(async () => {
    if (context) {
      await context.cleanup();
    }
  });

  return {
    getContext: (): TestContext => ({
      container: context.container,
      db: context.db,
      testId: context.testId,
      testData,
    }),
    getContainer: () => context.container,
    getDb: () => context.db,
    getTestData: () => testData,
  };
}

/**
 * Setup test context for each test (more isolation, slower)
 * Use this for tests that need complete isolation between test cases
 */
export function setupIsolatedTestContext(options: {
  suiteName?: string;
  withTestData?: boolean;
} = {}) {
  let context: TestDatabaseContext;
  let testData: any;

  beforeEach(async () => {
    context = await EnhancedTestDatabase.createContext(options.suiteName);
    
    if (options.withTestData) {
      testData = await EnhancedTestDatabase.createTestData(context.container);
    }
  });

  afterEach(async () => {
    if (context) {
      await context.cleanup();
    }
  });

  return {
    getContext: (): TestContext => ({
      container: context.container,
      db: context.db,
      testId: context.testId,
      testData,
    }),
    getContainer: () => context.container,
    getDb: () => context.db,
    getTestData: () => testData,
  };
}

/**
 * AAA Pattern Helpers for Test Structure
 * Following memory-documented enhanced AAA pattern
 */
export class AAATestHelper {
  constructor(private container: AwilixContainer) {}

  /**
   * ARRANGE: Setup test state using real services
   * Returns services commonly used in tests
   */
  arrange() {
    const hierarchyService = this.container.resolve<any>('hierarchyService');
    const nodePermissionService = this.container.resolve<any>('nodePermissionService');
    const organizationService = this.container.resolve<any>('organizationService');
    const authService = this.container.resolve<any>('authService');

    return {
      hierarchyService,
      nodePermissionService,
      organizationService,
      authService,
      
      // Helper methods for common setup patterns
      async createUser(email: string, interest = 'Technology') {
        return await authService.register({
          email,
          password: 'TestPassword123!',
          interest,
        });
      },

      async createOrganization(name: string, type = 'company') {
        return await organizationService.createOrganization({
          name,
          type: type as any,
          metadata: { description: `Test ${name}` }
        });
      },

      async addOrgMember(orgId: string, userId: number, role = 'member') {
        return await organizationService.addMember(orgId, {
          userId,
          role: role as any
        });
      },

      async createNode(type: string, meta: any, userId: number, parentId?: string) {
        return await hierarchyService.createNode({
          type: type as any,
          parentId,
          meta
        }, userId);
      },

      async setPermissions(nodeId: string, grantedBy: number, policies: any) {
        return await nodePermissionService.setNodePermissions(nodeId, grantedBy, policies);
      }
    };
  }

  /**
   * ACT: Execute the operation being tested
   * Wrapper for clarity in test structure
   */
  act<T>(operation: () => Promise<T>): Promise<T> {
    return operation();
  }

  /**
   * ASSERT: Verification helpers for common assertions
   */
  assert() {
    const nodePermissionService = this.container.resolve<any>('nodePermissionService');
    const hierarchyService = this.container.resolve<any>('hierarchyService');
    const organizationService = this.container.resolve<any>('organizationService');

    return {
      // Permission assertions
      async canAccess(userId: number | null, nodeId: string, action = 'view', level = 'full') {
        return await nodePermissionService.canAccess(userId, nodeId, action as any, level as any);
      },

      async getAccessLevel(userId: number | null, nodeId: string) {
        return await nodePermissionService.getAccessLevel(userId, nodeId);
      },

      // Node assertions
      async nodeExists(nodeId: string) {
        const node = await hierarchyService.getNode(nodeId);
        return node !== null;
      },

      async nodeHasParent(nodeId: string, expectedParentId: string) {
        const node = await hierarchyService.getNode(nodeId);
        return node?.parentId === expectedParentId;
      },

      // Organization assertions
      async isOrgMember(userId: number, orgId: string) {
        const members = await organizationService.getMembers(orgId);
        return members.some((member: any) => member.userId === userId);
      },

      // Database state assertions (for deep verification)
      async verifyInDatabase(db: any, query: () => Promise<any>, expectedCondition: (result: any) => boolean) {
        const result = await query();
        return expectedCondition(result);
      }
    };
  }
}

/**
 * Create AAA helper for a test context
 */
export function createAAAHelper(container: AwilixContainer): AAATestHelper {
  return new AAATestHelper(container);
}

/**
 * Global test hooks for cleanup
 */
beforeAll(() => {
  console.log('🚀 Starting test suite with enhanced database infrastructure');
});

afterAll(async () => {
  console.log('🧹 Cleaning up enhanced test infrastructure');
  await EnhancedTestDatabase.cleanupAll();
});

/**
 * Test timeout helpers
 */
export const TEST_TIMEOUTS = {
  UNIT: 5000,      // 5 seconds for unit tests
  INTEGRATION: 15000, // 15 seconds for integration tests  
  E2E: 30000,      // 30 seconds for E2E tests
  DATABASE: 10000,  // 10 seconds for database operations
} as const;

/**
 * Common test data builders
 */
export const TestDataBuilders = {
  user: (overrides: any = {}) => ({
    email: `test.user.${Date.now()}@example.com`,
    password: 'TestPassword123!',
    interest: 'Technology',
    ...overrides,
  }),

  organization: (overrides: any = {}) => ({
    name: `Test Org ${Date.now()}`,
    type: 'company' as any,
    metadata: { description: 'Test organization' },
    ...overrides,
  }),

  jobNode: (overrides: any = {}) => ({
    type: 'job' as any,
    meta: {
      title: 'Test Job',
      company: 'Test Company',
      startDate: '2023-01',
      description: 'Test job description',
      ...overrides.meta,
    },
    ...overrides,
  }),

  projectNode: (overrides: any = {}) => ({
    type: 'project' as any,
    meta: {
      title: 'Test Project',
      description: 'Test project description',
      technologies: ['TypeScript', 'Node.js'],
      ...overrides.meta,
    },
    ...overrides,
  }),

  publicPermissions: () => ({
    policies: [
      {
        subjectType: 'public' as any,
        subjectId: null,
        effect: 'allow' as any,
        action: 'view' as any,
        level: 'overview' as any,
      }
    ]
  }),

  orgPermissions: (orgId: string) => ({
    policies: [
      {
        subjectType: 'organization' as any,
        subjectId: orgId,
        effect: 'allow' as any,
        action: 'view' as any,
        level: 'full' as any,
      }
    ]
  }),
};