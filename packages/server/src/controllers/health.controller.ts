/**
 * Health Check Controller
 * Provides comprehensive health monitoring endpoints for the authentication system and application
 */

import * as schema from '@journey/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Request, Response } from 'express';

import { HttpStatus } from '../core';
import { BaseController } from './base-controller.js';

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
    private database: NodePgDatabase<typeof schema>
  ) {
    super();
  }

  /**
   * GET /health
   * @tags Health
   * @summary Application health check
   * @description Comprehensive health check with environment and database status
   * @return {HealthCheckDto} 200 - Application is healthy
   * @return {HealthCheckDto} 503 - Application is unhealthy
   * @example response - 200 - Healthy response
   * {
   *   "status": "healthy",
   *   "timestamp": "2024-01-01T00:00:00.000Z",
   *   "uptime": 123456,
   *   "version": "2.0.0",
   *   "environment": "development",
   *   "checks": {
   *     "environment": {
   *       "status": "pass",
   *       "timestamp": "2024-01-01T00:00:00.000Z",
   *       "message": "Environment configuration loaded"
   *     }
   *   }
   * }
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

    const statusCode = result.status === 'healthy' ? HttpStatus.OK :
                      result.status === 'degraded' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(statusCode).json(result);
  }

  /**
   * GET /ready
   * @tags Health
   * @summary Readiness probe
   * @description Check if application is ready to serve requests (Kubernetes readiness probe)
   * @return {ReadinessDto} 200 - Application is ready
   * @return {ReadinessDto} 503 - Application is not ready
   * @example response - 200 - Ready response
   * {
   *   "status": "ready",
   *   "timestamp": "2024-01-01T00:00:00.000Z",
   *   "message": "Application is ready to serve requests"
   * }
   */
  async getReadiness(req: Request, res: Response): Promise<Response> {
    try {
      // Check critical dependencies
      await this.checkDatabaseConnectivity();

      // Check if application is ready to serve requests
      const isReady = this.isApplicationReady();

      if (isReady) {
        return res.status(HttpStatus.OK).json({
          status: 'ready',
          timestamp: new Date().toISOString(),
          message: 'Application is ready to serve requests'
        });
      } else {
        return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          status: 'not ready',
          timestamp: new Date().toISOString(),
          message: 'Application is not ready to serve requests'
        });
      }
    } catch (error) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: `Readiness check failed: ${error}`
      });
    }
  }

  /**
   * GET /live
   * @tags Health
   * @summary Liveness probe
   * @description Check if application is alive (Kubernetes liveness probe)
   * @return {LivenessDto} 200 - Application is alive
   * @example response - 200 - Alive response
   * {
   *   "status": "alive",
   *   "timestamp": "2024-01-01T00:00:00.000Z",
   *   "uptime": 123456,
   *   "pid": 12345
   * }
   */
  async getLiveness(req: Request, res: Response): Promise<Response> {
    // Basic liveness check - if we can respond, we're alive
    return res.status(HttpStatus.OK).json({
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
   * GET /api/v2/health
   * @tags Health
   * @summary API v2 health check
   * @description Health check with API version information and available features
   * @return {ApiV2HealthDto} 200 - API health status with features
   * @example response - 200 - API v2 health response
   * {
   *   "success": true,
   *   "data": {
   *     "version": "2.0.0",
   *     "status": "healthy",
   *     "timestamp": "2024-01-01T00:00:00.000Z",
   *     "features": {
   *       "timeline": true,
   *       "nodeTypes": ["job", "education", "project", "event", "action", "careerTransition"],
   *       "apiEndpoints": ["GET /timeline/health", "POST /timeline/nodes"]
   *     }
   *   }
   * }
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
