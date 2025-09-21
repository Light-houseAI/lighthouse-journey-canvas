import {
  createContainer,
  asClass,
  asValue,
  asFunction,
  AwilixContainer,
  InjectionMode,
} from 'awilix';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from './logger.js';
import {
  createDatabaseConnection,
  disposeDatabaseConnection,
} from '../config/database.connection.js';
import { getPoolFromDatabase } from '../config/database.connection.js';
import { CONTAINER_TOKENS } from './container-tokens.js';
import { createLLMProvider, getLLMConfig } from './llm-provider.js';
// Controllers
import { AuthController } from '../controllers/auth.controller';

import { HierarchyController } from '../controllers/hierarchy-controller';
import { LegacyController } from '../controllers/legacy.controller';
import { NodePermissionController } from '../controllers/node-permission.controller';

import { OrganizationController } from '../controllers/organization.controller';
import { PgVectorGraphRAGController } from '../controllers/pgvector-graphrag.controller';
import { UserController } from '../controllers/user.controller';
import { UserOnboardingController } from '../controllers/user-onboarding-controller';
// Repositories
import { HierarchyRepository } from '../repositories/hierarchy-repository';
import { InsightRepository } from '../repositories/insight-repository';
import { NodePermissionRepository } from '../repositories/node-permission.repository';
import { OrganizationRepository } from '../repositories/organization.repository';
import { PgVectorGraphRAGRepository } from '../repositories/pgvector-graphrag.repository';
import { DatabaseRefreshTokenRepository } from '../repositories/refresh-token.repository';
import { UserRepository } from '../repositories/user-repository';
// Services
import { HierarchyService } from '../services/hierarchy-service';
import { JWTService } from '../services/jwt.service';
import { MultiSourceExtractor } from '../services/multi-source-extractor';
import { NodePermissionService } from '../services/node-permission.service';
import { OpenAIEmbeddingService } from '../services/openai-embedding.service';
import { OrganizationService } from '../services/organization.service';
import { PgVectorGraphRAGService } from '../services/pgvector-graphrag.service';
import { RefreshTokenService } from '../services/refresh-token.service';
import { UserService } from '../services/user-service';
// Interfaces for dependency injection (used for type checking during injection)

/**
 * Application container configuration using Awilix
 * Provides dependency injection with request scoping support for Express.js
 */
export class Container {
  private static rootContainer: AwilixContainer;
  private static isConfigured = false;

  /**
   * Configure application services in Awilix container
   * Sets up dependency injection for the entire application
   */
  static async configure(
    logger: Logger
  ): Promise<AwilixContainer> {
    if (this.isConfigured && this.rootContainer) {
      return this.rootContainer;
    }

    try {
      // Create root container with PROXY injection mode (uses object destructuring)
      this.rootContainer = createContainer({
        injectionMode: InjectionMode.PROXY,
        strict: true, // Enable strict mode for better error detection
      });

      // Create database connection BEFORE registering it
      // This ensures we have the resolved database instance, not a Promise
      logger.info('🔄 Initializing database connection...');
      const database = await createDatabaseConnection();
      logger.info('✅ Database connection initialized');

      // Register infrastructure dependencies as singletons
      this.rootContainer.register({
        // Database connection - register the resolved instance as a value
        [CONTAINER_TOKENS.DATABASE]: asValue(database),

        [CONTAINER_TOKENS.LOGGER]: asValue(logger),
      });

      // Register repositories as singletons (shared across requests)
      this.rootContainer.register({
        [CONTAINER_TOKENS.HIERARCHY_REPOSITORY]: asClass(HierarchyRepository).singleton(),
        [CONTAINER_TOKENS.INSIGHT_REPOSITORY]: asClass(InsightRepository).singleton(),
        // Node permission repositories (interface-based)
        [CONTAINER_TOKENS.NODE_PERMISSION_REPOSITORY]: asClass(NodePermissionRepository).singleton(),
        [CONTAINER_TOKENS.ORGANIZATION_REPOSITORY]: asClass(OrganizationRepository).singleton(),
        [CONTAINER_TOKENS.USER_REPOSITORY]: asClass(UserRepository).singleton(),
        // JWT repositories
        [CONTAINER_TOKENS.REFRESH_TOKEN_REPOSITORY]: asClass(DatabaseRefreshTokenRepository).singleton(),
        // GraphRAG repository - uses database pool directly
        [CONTAINER_TOKENS.PGVECTOR_GRAPHRAG_REPOSITORY]: asFunction(() => {
          const pool = getPoolFromDatabase(database);
          return new PgVectorGraphRAGRepository(pool, database);
        }).singleton(),
      });

      // Register services as singletons
      this.rootContainer.register({
        [CONTAINER_TOKENS.HIERARCHY_SERVICE]: asClass(HierarchyService).singleton(),
        [CONTAINER_TOKENS.MULTI_SOURCE_EXTRACTOR]: asClass(MultiSourceExtractor).singleton(),
        // JWT services
        [CONTAINER_TOKENS.JWT_SERVICE]: asClass(JWTService).singleton(),
        [CONTAINER_TOKENS.REFRESH_TOKEN_SERVICE]: asClass(RefreshTokenService).singleton(),
        // Node permission services
        [CONTAINER_TOKENS.NODE_PERMISSION_SERVICE]: asClass(NodePermissionService).singleton(),
        [CONTAINER_TOKENS.ORGANIZATION_SERVICE]: asClass(OrganizationService).singleton(),
        [CONTAINER_TOKENS.USER_SERVICE]: asClass(UserService).singleton(),
        // GraphRAG services
        [CONTAINER_TOKENS.OPENAI_EMBEDDING_SERVICE]: asClass(OpenAIEmbeddingService).singleton(),
        [CONTAINER_TOKENS.PGVECTOR_GRAPHRAG_SERVICE]: asClass(PgVectorGraphRAGService).singleton(),
        // LLM provider
        [CONTAINER_TOKENS.LLM_PROVIDER]: asFunction(() => {
          const config = getLLMConfig();
          return createLLMProvider(config);
        }).singleton(),
      });

      // Register controllers as transient (new instance per request)
      this.rootContainer.register({
        [CONTAINER_TOKENS.AUTH_CONTROLLER]: asClass(AuthController).transient(),

        [CONTAINER_TOKENS.HIERARCHY_CONTROLLER]: asClass(HierarchyController).transient(),
        [CONTAINER_TOKENS.LEGACY_CONTROLLER]: asClass(LegacyController).transient(),
        [CONTAINER_TOKENS.USER_ONBOARDING_CONTROLLER]: asClass(UserOnboardingController).transient(),
        // Node permission controllers
        [CONTAINER_TOKENS.NODE_PERMISSION_CONTROLLER]: asClass(NodePermissionController).transient(),
        [CONTAINER_TOKENS.USER_CONTROLLER]: asClass(UserController).transient(),
        [CONTAINER_TOKENS.ORGANIZATION_CONTROLLER]: asClass(OrganizationController).transient(),
        [CONTAINER_TOKENS.PGVECTOR_GRAPHRAG_CONTROLLER]: asClass(PgVectorGraphRAGController).transient(),
      });

      this.isConfigured = true;
      logger.info('✅ Awilix container configured successfully');

      return this.rootContainer;
    } catch (error) {
      logger.error(
        '❌ Failed to configure Awilix container:',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Get the root container instance
   * @throws {Error} If container hasn't been configured
   */
  static getContainer(): AwilixContainer {
    if (!this.rootContainer) {
      throw new Error('Container not configured. Call configure() first.');
    }
    return this.rootContainer;
  }

  /**
   * Create a request-scoped container for per-request dependencies
   * Request scopes inherit all registrations from the root container
   * but can have their own request-specific values
   */
  static createRequestScope(): AwilixContainer {
    return this.getContainer().createScope();
  }

  /**
   * Dispose of container resources (database connections, etc.)
   * This should be called when shutting down the application
   */
  static async dispose(): Promise<void> {
    if (this.rootContainer) {
      // Manually dispose database connection since we're not using the disposer pattern
      try {
        const database = this.rootContainer.resolve(CONTAINER_TOKENS.DATABASE);
        await disposeDatabaseConnection(database);
      } catch (error) {
        // Database might not be registered or already disposed
        // eslint-disable-next-line no-console
        console.warn('Could not dispose database connection:', error);
      }

      await this.rootContainer.dispose();
    }
  }

  /**
   * Reset container (mainly for testing)
   * Clears the singleton instance and configuration state
   */
  static reset(): void {
    this.isConfigured = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.rootContainer = null as any;
  }
}
