/**
 * Health Check Controller
 * Provides comprehensive health monitoring endpoints for the authentication system and application
 */

import { Request, Response } from 'express';

import { Database } from '../core/container';
import { BaseController } from './base-controller';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    [key: string]: {
      status: 'pass' | 'warn' | 'fail';
      timestamp: string;
      duration?: number;
      message?: string;
      details?: any;
    };
  };
}

/**
 * Health Check Controller
 * Provides endpoints for monitoring application health and performance
 */
export class HealthController extends BaseController {
  private startTime = Date.now();

  constructor(
    private database: Database
  ) {
    super();
  }

  /**
   * Basic health check endpoint
   * GET /health
   */
  async getHealth(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    const result: HealthCheckResult = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {}
    };

    // Basic environment check
    try {
      result.checks.environment = {
        status: 'pass',
        timestamp: new Date().toISOString(),
        message: 'Environment configuration loaded',
        details: {
          NODE_ENV: process.env.NODE_ENV || 'development',
          PORT: process.env.PORT || '5000',
          DATABASE_URL: process.env.DATABASE_URL ? 'configured' : 'not configured'
        }
      };
    } catch (error) {
      result.checks.environment = {
        status: 'fail',
        timestamp: new Date().toISOString(),
        message: `Environment check failed: ${error}`
      };
      result.status = 'unhealthy';
    }

    const duration = Date.now() - startTime;
    result.checks.self = {
      status: 'pass',
      timestamp: new Date().toISOString(),
      duration,
      message: 'Health check completed successfully'
    };

    const statusCode = result.status === 'healthy' ? 200 :
                      result.status === 'degraded' ? 200 : 503;

    return res.status(statusCode).json(result);
  }

  /**
   * Readiness probe endpoint
   * GET /ready
   */

  async getReadiness(req: Request, res: Response): Promise<Response> {
    try {
      // Check critical dependencies
      await this.checkDatabaseConnectivity();

      // Check if application is ready to serve requests
      const isReady = this.isApplicationReady();

      if (isReady) {
        return res.status(200).json({
          status: 'ready',
          timestamp: new Date().toISOString(),
          message: 'Application is ready to serve requests'
        });
      } else {
        return res.status(503).json({
          status: 'not ready',
          timestamp: new Date().toISOString(),
          message: 'Application is not ready to serve requests'
        });
      }
    } catch (error) {
      return res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: `Readiness check failed: ${error}`
      });
    }
  }

  /**
   * Liveness probe endpoint
   * GET /live
   */

  async getLiveness(req: Request, res: Response): Promise<Response> {
    // Basic liveness check - if we can respond, we're alive
    return res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      pid: process.pid
    });
  }

  /**
   * Check database connectivity
   */
  private async checkDatabaseConnectivity(): Promise<void> {
    // Simple query to test database connection
    try {
      // This would depend on your database implementation
      // For now, we'll assume the database is connected if it exists
      if (!this.database) {
        throw new Error('Database instance not available');
      }

      // In a real implementation, you might run:
      // await this.database.raw('SELECT 1');

    } catch (error) {
      throw new Error(`Database connectivity check failed: ${error}`);
    }
  }

  /**
   * Check if application is ready
   */
  private isApplicationReady(): boolean {
    // Check if all critical components are initialized
    return !!(this.database);
  }

  /**
   * API v2 health check endpoint
   * GET /api/v2/health
   */
  async getV2Health(req: Request, res: Response): Promise<Response> {
    return res.json({
      success: true,
      data: {
        version: '2.0.0',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        features: {
          timeline: true,
          nodeTypes: ['job', 'education', 'project', 'event', 'action', 'careerTransition'],
          apiEndpoints: [
            'GET /timeline/health',
            'GET /timeline/docs',
            'POST /timeline/nodes',
            'GET /timeline/nodes',
            'GET /timeline/nodes/:id',
            'PATCH /timeline/nodes/:id',
            'DELETE /timeline/nodes/:id',
            'GET /timeline/validate',
            'GET /timeline/schema/:type'
          ]
        }
      }
    });
  }
}
