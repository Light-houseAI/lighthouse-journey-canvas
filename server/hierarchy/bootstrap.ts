/**
 * Hierarchy System Bootstrap
 * 
 * Integration point for the hierarchical timeline system with existing Lighthouse infrastructure.
 * This file handles initialization, database setup, and service registration.
 */

import 'reflect-metadata';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { HierarchyContainerSetup } from './di/container-setup';
import { createHierarchyRoutes } from './api/routes';
import type { Express } from 'express';
import type { Logger } from '../core/logger';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export interface HierarchyBootstrapConfig {
  database: NodePgDatabase<any>;
  logger: Logger;
  app: Express;
  existingContainer?: any; // Lighthouse's existing container
  apiPrefix?: string;
  requireAuth?: boolean;
}

export class HierarchyBootstrap {
  private static isInitialized = false;
  private static hierarchyRoutes: any = null;

  /**
   * Initialize the complete hierarchy system
   */
  static async initialize(config: HierarchyBootstrapConfig): Promise<{
    success: boolean;
    message: string;
    routes?: string;
    services: string[];
  }> {
    if (this.isInitialized) {
      return {
        success: true,
        message: 'Hierarchy system already initialized',
        routes: config.apiPrefix || '/api/v2/timeline',
        services: ['HierarchyService', 'ValidationService']
      };
    }

    try {
      config.logger.info('Initializing Hierarchy Timeline System...');

      // Step 1: Run database migrations
      await this.runMigrations(config.database, config.logger);

      // Step 2: Configure dependency injection
      await HierarchyContainerSetup.configure(
        config.database,
        config.logger,
        config.existingContainer
      );

      // Step 3: Setup API routes
      const apiPrefix = config.apiPrefix || '/api/v2/timeline';
      this.hierarchyRoutes = createHierarchyRoutes();
      
      // Apply existing Lighthouse auth middleware if required
      if (config.requireAuth !== false) {
        // Integrate with existing Lighthouse authentication
        config.app.use(apiPrefix, this.getExistingAuthMiddleware(config));
      }

      config.app.use(apiPrefix, this.hierarchyRoutes);

      // Step 4: Validate system health
      const health = await HierarchyContainerSetup.healthCheck();
      if (!health.healthy) {
        throw new Error(`Health check failed: ${JSON.stringify(health.services)}`);
      }

      this.isInitialized = true;

      config.logger.info('Hierarchy Timeline System initialized successfully', {
        apiPrefix,
        services: Object.keys(health.services),
        healthStatus: health.healthy
      });

      return {
        success: true,
        message: 'Hierarchy system initialized successfully',
        routes: apiPrefix,
        services: Object.keys(health.services)
      };

    } catch (error) {
      config.logger.error('Failed to initialize Hierarchy Timeline System:', error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown initialization error',
        services: []
      };
    }
  }

  /**
   * Graceful shutdown of hierarchy system
   */
  static async shutdown(logger: Logger): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      logger.info('Shutting down Hierarchy Timeline System...');

      // Clean up DI container
      HierarchyContainerSetup.reset();

      this.isInitialized = false;
      this.hierarchyRoutes = null;

      logger.info('Hierarchy Timeline System shutdown complete');

    } catch (error) {
      logger.error('Error during hierarchy system shutdown:', error);
      throw error;
    }
  }

  /**
   * Get system status for monitoring
   */
  static async getStatus(): Promise<{
    initialized: boolean;
    healthy: boolean;
    services: Record<string, boolean>;
    uptime: number;
    version: string;
  }> {
    const startTime = Date.now();
    
    if (!this.isInitialized) {
      return {
        initialized: false,
        healthy: false,
        services: {},
        uptime: 0,
        version: '2.0.0'
      };
    }

    try {
      const health = await HierarchyContainerSetup.healthCheck();
      
      return {
        initialized: true,
        healthy: health.healthy,
        services: health.services,
        uptime: Date.now() - startTime,
        version: '2.0.0'
      };

    } catch (error) {
      return {
        initialized: true,
        healthy: false,
        services: {},
        uptime: Date.now() - startTime,
        version: '2.0.0'
      };
    }
  }

  /**
   * Run database migrations for hierarchy schema
   */
  private static async runMigrations(db: NodePgDatabase<any>, logger: Logger): Promise<void> {
    try {
      logger.info('Running hierarchy database migrations...');
      
      // Create timeline_node_type enum if it doesn't exist
      await db.execute(`
        DO $$ BEGIN
          CREATE TYPE timeline_node_type AS ENUM (
            'job', 'education', 'project', 'event', 'action', 'careerTransition'
          );
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      // Create timeline_nodes table if it doesn't exist
      await db.execute(`
        CREATE TABLE IF NOT EXISTS timeline_nodes (
          id TEXT PRIMARY KEY,
          type timeline_node_type NOT NULL,
          label TEXT NOT NULL,
          parent_id TEXT REFERENCES timeline_nodes(id) ON DELETE SET NULL,
          meta JSONB NOT NULL DEFAULT '{}',
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );
      `);

      // Create performance indexes
      await db.execute(`
        CREATE INDEX IF NOT EXISTS timeline_nodes_user_id_idx ON timeline_nodes(user_id);
      `);
      
      await db.execute(`
        CREATE INDEX IF NOT EXISTS timeline_nodes_parent_id_idx ON timeline_nodes(parent_id);
      `);
      
      await db.execute(`
        CREATE INDEX IF NOT EXISTS timeline_nodes_type_idx ON timeline_nodes(type);
      `);
      
      await db.execute(`
        CREATE INDEX IF NOT EXISTS timeline_nodes_user_parent_idx ON timeline_nodes(user_id, parent_id);
      `);

      // Add updated_at trigger for automatic timestamp updates
      await db.execute(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ language 'plpgsql';
      `);

      await db.execute(`
        DROP TRIGGER IF EXISTS update_timeline_nodes_updated_at ON timeline_nodes;
        CREATE TRIGGER update_timeline_nodes_updated_at
          BEFORE UPDATE ON timeline_nodes
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
      `);

      logger.info('Hierarchy database migrations completed successfully');

    } catch (error) {
      logger.error('Failed to run hierarchy migrations:', error);
      throw new Error(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get existing Lighthouse auth middleware
   */
  private static getExistingAuthMiddleware(config: HierarchyBootstrapConfig) {
    // This would integrate with Lighthouse's existing auth middleware
    // For now, return a placeholder that extracts user from session/request
    return (req: any, res: any, next: any) => {
      // Extract user from existing Lighthouse authentication
      const userId = req.user?.id || req.session?.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required to access hierarchy API'
          }
        });
      }

      // Add user context to request
      req.userId = userId;
      next();
    };
  }

  /**
   * Integration helper for existing Lighthouse server setup
   */
  static async integrateWithLighthouseServer(
    app: Express,
    database: NodePgDatabase<any>,
    logger: Logger,
    options: {
      enableV2Api?: boolean;
      requireAuth?: boolean;
      apiPrefix?: string;
    } = {}
  ): Promise<void> {
    const config: HierarchyBootstrapConfig = {
      app,
      database,
      logger,
      requireAuth: options.requireAuth !== false,
      apiPrefix: options.enableV2Api !== false ? '/api/v2/timeline' : undefined
    };

    const result = await this.initialize(config);
    
    if (!result.success) {
      throw new Error(`Failed to integrate hierarchy system: ${result.message}`);
    }

    logger.info('Hierarchy system integrated with Lighthouse server', {
      apiEndpoint: result.routes,
      services: result.services
    });
  }
}

export default HierarchyBootstrap;