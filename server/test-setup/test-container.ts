/**
 * Test Container Configuration
 *
 * Provides standardized Awilix container setup for tests following memory patterns:
 * 1. Real repositories with test database connections
 * 2. Real services with production-identical dependency injection
 * 3. Mock external dependencies (AI services, email, etc.)
 * 4. Test-specific utilities and helpers
 */

import { createContainer, asClass, asValue, asFunction, Lifetime, type AwilixContainer } from 'awilix';
import { drizzle } from 'drizzle-orm/node-postgres';

import type { DatabaseConfig } from '../../config/database-config';
import { createLogger } from '../../core/logger';

// Import all production services
import { HierarchyService } from '../../services/hierarchy.service';
import { NodePermissionService } from '../../services/node-permission.service';
import { OrganizationService } from '../../services/organization.service';
import { AuthService } from '../../services/auth.service';
import { JwtService } from '../../services/jwt.service';
import { RefreshTokenService } from '../../services/refresh-token.service';
import { PasswordService } from '../../services/password.service';
import { InsightService } from '../../services/insight.service';

// Import all production repositories
import { HierarchyRepository } from '../../repositories/hierarchy.repository';
import { NodePermissionRepository } from '../../repositories/node-permission.repository';
import { OrganizationRepository } from '../../repositories/organization.repository';
import { UserRepository } from '../../repositories/user.repository';
import { InsightRepository } from '../../repositories/insight.repository';
import { RefreshTokenRepository } from '../../repositories/refresh-token.repository';

// Import controllers for controller tests
import { HierarchyController } from '../../controllers/hierarchy.controller';
import { NodePermissionController } from '../../controllers/node-permission.controller';
import { OrganizationController } from '../../controllers/organization.controller';
import { AuthController } from '../../controllers/auth.controller';
import { HealthController } from '../../controllers/health.controller';
import { InsightController } from '../../controllers/insight.controller';

export interface TestContainerOptions {
  db: ReturnType<typeof drizzle>;
  dbConfig: DatabaseConfig;
  enableMocks?: boolean;
  customRegistrations?: Record<string, any>;
}

/**
 * Create test container with real services and repositories
 * This follows the memory pattern of using production-identical dependency injection
 */
export function createTestContainer(options: TestContainerOptions): AwilixContainer {
  const { db, dbConfig, enableMocks = true, customRegistrations = {} } = options;
  
  const container = createContainer();

  // Create test logger (quiet during tests)
  const logger = createLogger({ 
    level: process.env.TEST_LOG_LEVEL || 'warn',
    silent: process.env.NODE_ENV === 'test'
  });

  // Register core infrastructure
  container.register({
    // Database and configuration
    db: asValue(db),
    dbConfig: asValue(dbConfig),
    logger: asValue(logger),

    // Environment configuration
    environment: asValue('test'),
    jwtSecret: asValue(process.env.JWT_SECRET || 'test-jwt-secret-key'),
    jwtRefreshSecret: asValue(process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-key'),
  });

  // Register repositories (real implementations with test database)
  container.register({
    hierarchyRepository: asClass(HierarchyRepository, { lifetime: Lifetime.SINGLETON }),
    nodePermissionRepository: asClass(NodePermissionRepository, { lifetime: Lifetime.SINGLETON }),
    organizationRepository: asClass(OrganizationRepository, { lifetime: Lifetime.SINGLETON }),
    userRepository: asClass(UserRepository, { lifetime: Lifetime.SINGLETON }),
    insightRepository: asClass(InsightRepository, { lifetime: Lifetime.SINGLETON }),
    refreshTokenRepository: asClass(RefreshTokenRepository, { lifetime: Lifetime.SINGLETON }),
  });

  // Register core services (real implementations)
  container.register({
    // Authentication services
    jwtService: asClass(JwtService, { lifetime: Lifetime.SINGLETON }),
    refreshTokenService: asClass(RefreshTokenService, { lifetime: Lifetime.SINGLETON }),
    passwordService: asClass(PasswordService, { lifetime: Lifetime.SINGLETON }),
    authService: asClass(AuthService, { lifetime: Lifetime.SINGLETON }),

    // Business logic services  
    hierarchyService: asClass(HierarchyService, { lifetime: Lifetime.SINGLETON }),
    nodePermissionService: asClass(NodePermissionService, { lifetime: Lifetime.SINGLETON }),
    organizationService: asClass(OrganizationService, { lifetime: Lifetime.SINGLETON }),
    insightService: asClass(InsightService, { lifetime: Lifetime.SINGLETON }),
  });

  // Register controllers (transient for request-specific state)
  container.register({
    hierarchyController: asClass(HierarchyController, { lifetime: Lifetime.TRANSIENT }),
    nodePermissionController: asClass(NodePermissionController, { lifetime: Lifetime.TRANSIENT }),
    organizationController: asClass(OrganizationController, { lifetime: Lifetime.TRANSIENT }),
    authController: asClass(AuthController, { lifetime: Lifetime.TRANSIENT }),
    healthController: asClass(HealthController, { lifetime: Lifetime.TRANSIENT }),
    insightController: asClass(InsightController, { lifetime: Lifetime.TRANSIENT }),
  });

  // Register mocks for external dependencies if enabled
  if (enableMocks) {
    registerMocks(container);
  }

  // Register any custom test registrations
  if (Object.keys(customRegistrations).length > 0) {
    container.register(customRegistrations);
  }

  return container;
}

/**
 * Register mock implementations for external dependencies
 * This avoids hitting real AI services, email providers, etc. during tests
 */
function registerMocks(container: AwilixContainer) {
  // Mock AI/Vector services
  const mockAIService = {
    async generateInsight() {
      return { insight: 'Test AI insight', confidence: 0.85 };
    },
    async searchSimilar() {
      return [];
    },
    async updateVector() {
      return { success: true };
    }
  };

  // Mock email service
  const mockEmailService = {
    async sendEmail() {
      return { sent: true, messageId: 'test-message-id' };
    },
    async sendWelcomeEmail() {
      return { sent: true };
    }
  };

  // Mock file storage service
  const mockStorageService = {
    async uploadFile() {
      return { url: 'https://test.example.com/file.jpg', key: 'test-key' };
    },
    async deleteFile() {
      return { deleted: true };
    }
  };

  container.register({
    aiService: asValue(mockAIService),
    emailService: asValue(mockEmailService),
    storageService: asValue(mockStorageService),
  });
}

/**
 * Create container specifically for unit tests with mocked dependencies
 * Use this when you want to test a specific service in isolation
 */
export function createUnitTestContainer(options: {
  db: ReturnType<typeof drizzle>;
  dbConfig: DatabaseConfig;
  mockDependencies?: string[];
  customMocks?: Record<string, any>;
}): AwilixContainer {
  const { db, dbConfig, mockDependencies = [], customMocks = {} } = options;
  
  const container = createTestContainer({
    db,
    dbConfig,
    enableMocks: true,
  });

  // Add specific mocks for dependencies
  mockDependencies.forEach(dependency => {
    if (customMocks[dependency]) {
      container.register({ [dependency]: asValue(customMocks[dependency]) });
    } else {
      // Create generic mock
      const genericMock = createGenericMock(dependency);
      container.register({ [dependency]: asValue(genericMock) });
    }
  });

  return container;
}

/**
 * Create container specifically for integration tests
 * Uses real services throughout for end-to-end workflows
 */
export function createIntegrationTestContainer(options: {
  db: ReturnType<typeof drizzle>;
  dbConfig: DatabaseConfig;
}): AwilixContainer {
  return createTestContainer({
    ...options,
    enableMocks: true, // Still mock external services like AI, email
  });
}

/**
 * Create a generic mock object for a service
 */
function createGenericMock(serviceName: string): any {
  const mock = {};
  
  // Common async methods that return success
  const asyncMethods = [
    'create', 'update', 'delete', 'get', 'list', 'find', 'search',
    'save', 'remove', 'load', 'process', 'execute', 'handle'
  ];

  asyncMethods.forEach(method => {
    (mock as any)[method] = async (...args: any[]) => {
      console.log(`Mock ${serviceName}.${method} called with:`, args);
      return { success: true, data: null };
    };
  });

  // Common sync methods
  const syncMethods = ['validate', 'check', 'transform', 'format'];
  
  syncMethods.forEach(method => {
    (mock as any)[method] = (...args: any[]) => {
      console.log(`Mock ${serviceName}.${method} called with:`, args);
      return true;
    };
  });

  return mock;
}

/**
 * Helper to resolve services from container with proper typing
 */
export function resolveService<T>(container: AwilixContainer, serviceName: string): T {
  return container.resolve<T>(serviceName);
}

/**
 * Test container factory for different test scenarios
 */
export const TestContainerFactory = {
  /**
   * For integration tests - real services with test database
   */
  createForIntegration: createIntegrationTestContainer,

  /**
   * For unit tests - isolated service testing with mocks
   */
  createForUnit: createUnitTestContainer,

  /**
   * For controller tests - real controllers with mocked services
   */
  createForController: (options: TestContainerOptions) => {
    return createTestContainer({
      ...options,
      enableMocks: true,
    });
  },

  /**
   * For repository tests - real repositories with test database
   */
  createForRepository: (options: TestContainerOptions) => {
    return createTestContainer({
      ...options,
      enableMocks: false, // Repositories shouldn't need external service mocks
    });
  },
};