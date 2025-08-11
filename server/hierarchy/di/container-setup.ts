import 'reflect-metadata';
import { container, injectable, inject } from 'tsyringe';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from '../../core/logger';
import { HIERARCHY_TOKENS } from './tokens';
import { HierarchyRepository } from '../infrastructure/hierarchy-repository';
import { HierarchyService } from '../services/hierarchy-service';
import { ValidationService } from '../services/validation-service';
import { CycleDetectionService } from '../services/cycle-detection-service';
import { HierarchyController } from '../api/hierarchy-controller';

/**
 * Hierarchy container configuration - integrates with existing Lighthouse DI setup
 * This approach allows hierarchy system to coexist with existing container without conflicts
 */
export class HierarchyContainerSetup {
  private static isConfigured = false;

  /**
   * Configure hierarchy services in TSyringe container
   * Designed to integrate with existing Lighthouse container setup
   */
  static async configure(
    database: NodePgDatabase<any>, 
    logger: Logger,
    existingContainer?: any // Lighthouse's existing container
  ): Promise<void> {
    if (this.isConfigured) {
      return;
    }

    try {
      // Register infrastructure dependencies (shared with main app)
      container.registerInstance(HIERARCHY_TOKENS.DATABASE, database);
      container.registerInstance(HIERARCHY_TOKENS.LOGGER, logger);

      // Register hierarchy-specific services with dependency injection
      container.registerSingleton(HIERARCHY_TOKENS.HIERARCHY_REPOSITORY, HierarchyRepository);
      container.registerSingleton(HIERARCHY_TOKENS.VALIDATION_SERVICE, ValidationService);
      container.registerSingleton(HIERARCHY_TOKENS.CYCLE_DETECTION_SERVICE, CycleDetectionService);
      container.registerSingleton(HIERARCHY_TOKENS.HIERARCHY_SERVICE, HierarchyService);
      container.registerSingleton(HIERARCHY_TOKENS.HIERARCHY_CONTROLLER, HierarchyController);

      // Integration point: if existing container has user context, register it
      if (existingContainer?.isRegistered('USER_CONTEXT')) {
        const userContext = await existingContainer.resolve('USER_CONTEXT');
        container.registerInstance(Symbol.for('USER_CONTEXT'), userContext);
      }

      this.isConfigured = true;
      logger.info('Hierarchy container configured successfully');

    } catch (error) {
      logger.error('Failed to configure hierarchy container:', error);
      throw error;
    }
  }

  /**
   * Create request-scoped child container for user isolation
   * Each request gets isolated context with user information
   */
  static createRequestContainer(userId: number): typeof container {
    const requestContainer = container.createChildContainer();
    
    // Register user context for this request
    requestContainer.registerInstance(Symbol.for('REQUEST_USER_ID'), userId);
    requestContainer.registerInstance(Symbol.for('REQUEST_TIMESTAMP'), new Date());
    
    return requestContainer;
  }

  /**
   * Resolve service with proper user context
   */
  static async resolveWithContext<T>(token: symbol, userId: number): Promise<T> {
    const requestContainer = this.createRequestContainer(userId);
    return requestContainer.resolve<T>(token);
  }

  /**
   * Health check for hierarchy container
   */
  static async healthCheck(): Promise<{ healthy: boolean; services: Record<string, boolean> }> {
    const health = { healthy: true, services: {} as Record<string, boolean> };

    try {
      // Check if all required services can be resolved
      const services = Object.entries(HIERARCHY_TOKENS);
      
      for (const [name, token] of services) {
        try {
          await container.resolve(token);
          health.services[name] = true;
        } catch (error) {
          health.services[name] = false;
          health.healthy = false;
        }
      }

    } catch (error) {
      health.healthy = false;
    }

    return health;
  }

  /**
   * Cleanup method for testing environments
   */
  static reset(): void {
    container.clearInstances();
    this.isConfigured = false;
  }
}

// Integration middleware for Express routes
export const hierarchyContextMiddleware = (req: any, res: any, next: any) => {
  // Extract user ID from existing Lighthouse auth middleware
  const userId = req.user?.id || req.session?.userId;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'User authentication required' }
    });
  }

  // Attach hierarchy container context to request
  req.hierarchyContainer = HierarchyContainerSetup.createRequestContainer(userId);
  req.userId = userId;
  
  next();
};

// Type definitions for dependency injection
export interface HierarchyDependencies {
  database: NodePgDatabase<any>;
  logger: Logger;
  userId?: number;
}

// Export decorated classes for use in hierarchy system
@injectable()
export class HierarchyRepositoryWrapper {
  constructor(
    @inject(HIERARCHY_TOKENS.DATABASE) private database: NodePgDatabase<any>,
    @inject(HIERARCHY_TOKENS.LOGGER) private logger: Logger
  ) {}
}

@injectable() 
export class HierarchyServiceWrapper {
  constructor(
    @inject(HIERARCHY_TOKENS.HIERARCHY_REPOSITORY) private repository: HierarchyRepository,
    @inject(HIERARCHY_TOKENS.VALIDATION_SERVICE) private validation: ValidationService,
    @inject(HIERARCHY_TOKENS.CYCLE_DETECTION_SERVICE) private cycleDetection: CycleDetectionService,
    @inject(HIERARCHY_TOKENS.LOGGER) private logger: Logger
  ) {}
}

@injectable()
export class HierarchyControllerWrapper {
  constructor(
    @inject(HIERARCHY_TOKENS.HIERARCHY_SERVICE) private hierarchyService: HierarchyService,
    @inject(HIERARCHY_TOKENS.LOGGER) private logger: Logger
  ) {}
}

export { container as hierarchyContainer };