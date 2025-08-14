import 'reflect-metadata';
import { container } from 'tsyringe';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Logger } from './logger';
import { HIERARCHY_TOKENS } from './hierarchy-tokens';
import { HierarchyRepository } from '../repositories/hierarchy-repository';
import { InsightRepository } from '../repositories/insight-repository';
import { HierarchyService } from '../services/hierarchy-service';
import { ValidationService } from '../services/validation-service';
import { HierarchyController } from '../controllers/hierarchy-controller';

/**
 * Hierarchy container configuration - integrates with existing Lighthouse DI setup
 */
export class HierarchyContainerSetup {
  private static isConfigured = false;

  /**
   * Configure hierarchy services in TSyringe container
   */
  static async configure(database: NodePgDatabase<any>, logger: Logger): Promise<void> {
    if (this.isConfigured) {
      return;
    }

    try {
      // Register infrastructure dependencies
      container.registerInstance(HIERARCHY_TOKENS.DATABASE, database);
      container.registerInstance(HIERARCHY_TOKENS.LOGGER, logger);

      // Register hierarchy services with dependency injection
      container.registerSingleton(HIERARCHY_TOKENS.HIERARCHY_REPOSITORY, HierarchyRepository);
      container.registerSingleton(HIERARCHY_TOKENS.INSIGHT_REPOSITORY, InsightRepository);
      container.registerSingleton(HIERARCHY_TOKENS.VALIDATION_SERVICE, ValidationService);
      container.registerSingleton(HIERARCHY_TOKENS.HIERARCHY_SERVICE, HierarchyService);
      container.registerSingleton(HIERARCHY_TOKENS.HIERARCHY_CONTROLLER, HierarchyController);

      this.isConfigured = true;
      logger.info('Hierarchy container configured successfully');

    } catch (error) {
      logger.error('Failed to configure hierarchy container:', error);
      throw error;
    }
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

  req.userId = userId;
  next();
};
