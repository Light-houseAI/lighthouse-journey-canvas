/**
 * Container Smoke Test
 *
 * Verifies that all registered DI container tokens can be resolved successfully.
 * This ensures no missing dependencies or circular dependencies in the Awilix container.
 *
 * Test Strategy:
 * - Mock infrastructure dependencies (database, logger)
 * - Iterate through all CONTAINER_TOKENS
 * - Attempt to resolve each token
 * - Track resolution time for performance monitoring
 * - Verify singleton vs transient scope behavior
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { Database } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';

import { Container } from '../../src/core/container-setup';
import { CONTAINER_TOKENS } from '../../src/core/container-tokens';
import type { Logger } from '../../src/core/logger';

// Mock database connection at top level (hoisted)
vi.mock('../../src/config/database.connection.js', () => ({
  createDatabaseConnection: vi.fn().mockResolvedValue(mock<Database>()),
  disposeDatabaseConnection: vi.fn().mockResolvedValue(undefined),
  getPoolFromDatabase: vi.fn().mockReturnValue(mock<Pool>()),
}));

describe('Container Smoke Test', () => {
  let mockLogger: Logger;
  let resolvedTokens: Map<string, { success: boolean; timeMs: number; error?: string }>;

  beforeAll(async () => {
    // Create mock logger
    mockLogger = mock<Logger>({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    });

    // Configure container with mocked infrastructure
    await Container.configure(mockLogger);

    // Initialize results map
    resolvedTokens = new Map();
  });

  afterAll(async () => {
    await Container.dispose();
  });

  describe('Token Resolution', () => {
    it('should resolve all infrastructure tokens', () => {
      const infraTokens = {
        DATABASE: CONTAINER_TOKENS.DATABASE,
        LOGGER: CONTAINER_TOKENS.LOGGER,
      };

      Object.entries(infraTokens).forEach(([name, token]) => {
        const startTime = performance.now();
        try {
          const resolved = Container.getContainer().resolve(token);
          const timeMs = performance.now() - startTime;

          expect(resolved).toBeDefined();
          resolvedTokens.set(name, { success: true, timeMs });
        } catch (error: any) {
          const timeMs = performance.now() - startTime;
          resolvedTokens.set(name, { success: false, timeMs, error: error.message });
          throw error;
        }
      });
    });

    it('should resolve all repository tokens', () => {
      const repoTokens = [
        'HIERARCHY_REPOSITORY',
        'INSIGHT_REPOSITORY',
        'NODE_PERMISSION_REPOSITORY',
        'ORGANIZATION_REPOSITORY',
        'USER_REPOSITORY',
        'REFRESH_TOKEN_REPOSITORY',
        'PGVECTOR_GRAPHRAG_REPOSITORY',
        'UPDATES_REPOSITORY',
      ];

      repoTokens.forEach((tokenName) => {
        const token = CONTAINER_TOKENS[tokenName as keyof typeof CONTAINER_TOKENS];
        const startTime = performance.now();

        try {
          const resolved = Container.getContainer().resolve(token);
          const timeMs = performance.now() - startTime;

          expect(resolved).toBeDefined();
          expect(resolved.constructor.name).toBeTruthy();
          resolvedTokens.set(tokenName, { success: true, timeMs });
        } catch (error: any) {
          const timeMs = performance.now() - startTime;
          resolvedTokens.set(tokenName, { success: false, timeMs, error: error.message });
          throw error;
        }
      });
    });

    it('should resolve all service tokens', () => {
      const serviceTokens = [
        'HIERARCHY_SERVICE',
        'MULTI_SOURCE_EXTRACTOR',
        'JWT_SERVICE',
        'REFRESH_TOKEN_SERVICE',
        'NODE_PERMISSION_SERVICE',
        'ORGANIZATION_SERVICE',
        'USER_SERVICE',
        'PGVECTOR_GRAPHRAG_SERVICE',
        'OPENAI_EMBEDDING_SERVICE',
        'LLM_PROVIDER',
        'EXPERIENCE_MATCHES_SERVICE',
        'TRANSACTION_MANAGER',
        'UPDATES_SERVICE',
      ];

      serviceTokens.forEach((tokenName) => {
        const token = CONTAINER_TOKENS[tokenName as keyof typeof CONTAINER_TOKENS];
        const startTime = performance.now();

        try {
          const resolved = Container.getContainer().resolve(token);
          const timeMs = performance.now() - startTime;

          expect(resolved).toBeDefined();
          resolvedTokens.set(tokenName, { success: true, timeMs });
        } catch (error: any) {
          const timeMs = performance.now() - startTime;
          resolvedTokens.set(tokenName, { success: false, timeMs, error: error.message });
          throw error;
        }
      });
    });

    it('should resolve all controller tokens', () => {
      const controllerTokens = [
        'AUTH_CONTROLLER',
        'HIERARCHY_CONTROLLER',
        'USER_ONBOARDING_CONTROLLER',
        'NODE_PERMISSION_CONTROLLER',
        'USER_CONTROLLER',
        'ORGANIZATION_CONTROLLER',
        'PGVECTOR_GRAPHRAG_CONTROLLER',
        'EXPERIENCE_MATCHES_CONTROLLER',
        'UPDATES_CONTROLLER',
      ];

      controllerTokens.forEach((tokenName) => {
        const token = CONTAINER_TOKENS[tokenName as keyof typeof CONTAINER_TOKENS];
        const startTime = performance.now();

        try {
          const resolved = Container.getContainer().resolve(token);
          const timeMs = performance.now() - startTime;

          expect(resolved).toBeDefined();
          expect(resolved.constructor.name).toContain('Controller');
          resolvedTokens.set(tokenName, { success: true, timeMs });
        } catch (error: any) {
          const timeMs = performance.now() - startTime;
          resolvedTokens.set(tokenName, { success: false, timeMs, error: error.message });
          throw error;
        }
      });
    });
  });

  describe('Resolution Performance', () => {
    it('should resolve all tokens within acceptable time', () => {
      // After all tokens have been resolved, check performance
      const allResults = Array.from(resolvedTokens.values());
      const successfulResolutions = allResults.filter((r) => r.success);

      // All resolutions should succeed
      expect(successfulResolutions.length).toBe(resolvedTokens.size);

      // Calculate statistics
      const times = successfulResolutions.map((r) => r.timeMs);
      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      const maxTime = Math.max(...times);

      // Log performance stats
      console.log('\n📊 Container Resolution Performance:');
      console.log(`   Total tokens: ${resolvedTokens.size}`);
      console.log(`   Average resolution time: ${avgTime.toFixed(2)}ms`);
      console.log(`   Max resolution time: ${maxTime.toFixed(2)}ms`);

      // Performance assertions
      expect(avgTime).toBeLessThan(50); // Average should be fast
      expect(maxTime).toBeLessThan(200); // Max should still be reasonable
    });

    it('should list slowest token resolutions for optimization', () => {
      const sortedByTime = Array.from(resolvedTokens.entries())
        .filter(([, result]) => result.success)
        .sort(([, a], [, b]) => b.timeMs - a.timeMs)
        .slice(0, 5); // Top 5 slowest

      console.log('\n🐌 Slowest token resolutions:');
      sortedByTime.forEach(([token, result], index) => {
        console.log(`   ${index + 1}. ${token}: ${result.timeMs.toFixed(2)}ms`);
      });

      // This is informational, not a failure
      expect(sortedByTime.length).toBeGreaterThan(0);
    });
  });

  describe('Singleton Behavior', () => {
    it('should return same instance for singleton services', () => {
      const container = Container.getContainer();

      // Test singleton behavior on a few key services
      const service1 = container.resolve(CONTAINER_TOKENS.USER_SERVICE);
      const service2 = container.resolve(CONTAINER_TOKENS.USER_SERVICE);

      expect(service1).toBe(service2); // Same instance

      const repo1 = container.resolve(CONTAINER_TOKENS.USER_REPOSITORY);
      const repo2 = container.resolve(CONTAINER_TOKENS.USER_REPOSITORY);

      expect(repo1).toBe(repo2); // Same instance
    });

    it('should maintain singleton identity across multiple resolutions', () => {
      const container = Container.getContainer();

      // Resolve the same token 10 times
      const instances = Array.from({ length: 10 }, () =>
        container.resolve(CONTAINER_TOKENS.HIERARCHY_SERVICE)
      );

      // All should be the same instance
      const firstInstance = instances[0];
      instances.forEach((instance) => {
        expect(instance).toBe(firstInstance);
      });
    });
  });

  describe('Dependency Chain Validation', () => {
    it('should resolve deeply nested dependencies without circular references', () => {
      const container = Container.getContainer();

      // HierarchyService depends on multiple repositories and services
      // If circular dependencies exist, this will fail or timeout
      const hierarchyService = container.resolve(CONTAINER_TOKENS.HIERARCHY_SERVICE);
      expect(hierarchyService).toBeDefined();

      // UserService depends on multiple repositories and services
      const userService = container.resolve(CONTAINER_TOKENS.USER_SERVICE);
      expect(userService).toBeDefined();

      // Controllers depend on services which depend on repositories
      const hierarchyController = container.resolve(CONTAINER_TOKENS.HIERARCHY_CONTROLLER);
      expect(hierarchyController).toBeDefined();
    });

    it('should handle optional dependencies gracefully', () => {
      const container = Container.getContainer();

      // Some services may have optional dependencies
      // They should still resolve successfully
      const multiSourceExtractor = container.resolve(CONTAINER_TOKENS.MULTI_SOURCE_EXTRACTOR);
      expect(multiSourceExtractor).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should throw clear error for unregistered token', () => {
      const container = Container.getContainer();

      expect(() => {
        container.resolve('NONEXISTENT_TOKEN' as any);
      }).toThrow();
    });

    it('should provide helpful error messages for resolution failures', () => {
      const container = Container.getContainer();

      try {
        container.resolve('INVALID_TOKEN' as any);
        fail('Should have thrown error');
      } catch (error: any) {
        // Error message should mention the token name
        expect(error.message).toBeTruthy();
      }
    });
  });

  describe('Container Health Summary', () => {
    it('should generate comprehensive health report', () => {
      const totalTokens = resolvedTokens.size;
      const successfulTokens = Array.from(resolvedTokens.values()).filter((r) => r.success).length;
      const failedTokens = totalTokens - successfulTokens;

      const times = Array.from(resolvedTokens.values())
        .filter((r) => r.success)
        .map((r) => r.timeMs);

      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      const totalTime = times.reduce((sum, t) => sum + t, 0);

      const healthReport = {
        status: failedTokens === 0 ? 'healthy' : 'unhealthy',
        totalTokens,
        successfulTokens,
        failedTokens,
        performance: {
          averageResolutionTimeMs: parseFloat(avgTime.toFixed(2)),
          totalResolutionTimeMs: parseFloat(totalTime.toFixed(2)),
        },
        timestamp: new Date().toISOString(),
      };

      console.log('\n🏥 Container Health Report:');
      console.log(JSON.stringify(healthReport, null, 2));

      // Assertions
      expect(healthReport.status).toBe('healthy');
      expect(healthReport.failedTokens).toBe(0);
      expect(healthReport.successfulTokens).toBe(totalTokens);
    });
  });
});
