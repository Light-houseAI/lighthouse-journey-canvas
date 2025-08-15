import 'reflect-metadata';
import { createContainer, asClass, asValue, AwilixContainer, InjectionMode } from 'awilix';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from './logger';
import { HierarchyRepository } from '../repositories/hierarchy-repository';
import { InsightRepository } from '../repositories/insight-repository';
import { HierarchyService } from '../services/hierarchy-service';
import { ValidationService } from '../services/validation-service';
import { HierarchyController } from '../controllers/hierarchy-controller';
import { UserOnboardingController } from '../controllers/user-onboarding-controller';
import { MultiSourceExtractor } from '../services/multi-source-extractor';

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
  static async configure(database: NodePgDatabase<any>, logger: Logger): Promise<AwilixContainer> {
    if (this.isConfigured && this.rootContainer) {
      return this.rootContainer;
    }

    try {
      // Create root container with PROXY injection mode (uses object destructuring)
      this.rootContainer = createContainer({
        injectionMode: InjectionMode.PROXY,
        strict: true, // Enable strict mode for better error detection
      });

      // Register infrastructure dependencies as singletons
      this.rootContainer.register({
        database: asValue(database),
        logger: asValue(logger),
      });

      // Register repositories as singletons (shared across requests)
      this.rootContainer.register({
        hierarchyRepository: asClass(HierarchyRepository).singleton(),
        insightRepository: asClass(InsightRepository).singleton(),
      });

      // Register services as singletons
      this.rootContainer.register({
        validationService: asClass(ValidationService).singleton(),
        hierarchyService: asClass(HierarchyService).singleton(),
        multiSourceExtractor: asClass(MultiSourceExtractor).singleton(),
      });

      // Register controllers as transient (new instance per request)
      this.rootContainer.register({
        hierarchyController: asClass(HierarchyController).transient(),
        userOnboardingController: asClass(UserOnboardingController).transient(),
      });

      this.isConfigured = true;
      logger.info('✅ Awilix container configured successfully');

      return this.rootContainer;

    } catch (error) {
      logger.error('❌ Failed to configure Awilix container:', error instanceof Error ? error : new Error(String(error)));
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
   * Reset container (mainly for testing)
   * Clears the singleton instance and configuration state
   */
  static reset(): void {
    this.isConfigured = false;
    this.rootContainer = null as any;
  }
}
