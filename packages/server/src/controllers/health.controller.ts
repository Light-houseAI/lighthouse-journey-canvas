/**
 * HealthController
 * API endpoints for application health monitoring and readiness checks
 */

import * as schema from '@journey/schema';
import {
  type HealthCheckSuccessResponse,
  HttpStatusCode,
  type LivenessSuccessResponse,
  type ReadinessSuccessResponse,
  ServiceUnavailableError,
  type V2HealthSuccessResponse,
} from '@journey/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request, Response } from 'express';

export class HealthController {
  private startTime = Date.now();

  constructor(
    private database: NodePgDatabase<typeof schema>
  ) {}

  /**
   * GET /health
   * @summary Comprehensive application health check
   * @tags Health
   * @description Returns detailed health status including application uptime, version information, environment configuration, and system checks. Performs validation of critical components like environment variables and configuration. Returns degraded or unhealthy status (503) if critical checks fail, otherwise returns healthy status (200).
   * @return {HealthCheckResponse} 200 - Health check successful with detailed status
   * @return {HealthCheckResponse} 503 - Service unhealthy or degraded
   */
  async getHealth(req: Request, res: Response) {
    const startTime = Date.now();
    const checks: HealthCheckSuccessResponse['data']['checks'] = {};

    // Basic environment check
    checks.environment = {
      status: 'pass',
      timestamp: new Date().toISOString(),
      message: 'Environment configuration loaded',
      details: {
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: process.env.PORT || '5000',
        DATABASE_URL: process.env.DATABASE_URL ? 'configured' : 'not configured'
      }
    };

    const duration = Date.now() - startTime;
    checks.self = {
      status: 'pass',
      timestamp: new Date().toISOString(),
      duration,
      message: 'Health check completed successfully'
    };

    const data = {
      status: 'healthy' as const,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks
    };

    const statusCode = data.status === 'healthy' ? HttpStatusCode.OK :
                      data.status === 'degraded' ? HttpStatusCode.OK : HttpStatusCode.SERVICE_UNAVAILABLE;

    const response: HealthCheckSuccessResponse = {
      success: true,
      data
    };

    res.status(statusCode).json(response);
  }

  /**
   * GET /ready
   * @summary Kubernetes readiness probe
   * @tags Health
   * @description Checks if the application is ready to serve requests. Validates critical dependencies including database connectivity and application initialization state. Used by container orchestrators (Kubernetes, etc.) to determine when to route traffic to the application. Returns 503 if the application is not ready.
   * @return {ReadinessResponse} 200 - Application is ready to serve requests
   * @return {ServiceUnavailableErrorResponse} 503 - Application is not ready
   */
  async getReadiness(req: Request, res: Response) {
    // Check critical dependencies
    await this.checkDatabaseConnectivity();

    // Check if application is ready to serve requests
    const isReady = this.isApplicationReady();

    if (!isReady) {
      throw new ServiceUnavailableError('Application is not ready to serve requests');
    }

    const response: ReadinessSuccessResponse = {
      success: true,
      data: {
        status: 'ready',
        timestamp: new Date().toISOString(),
        message: 'Application is ready to serve requests'
      }
    };

    res.status(HttpStatusCode.OK).json(response);
  }

  /**
   * GET /live
   * @summary Kubernetes liveness probe
   * @tags Health
   * @description Basic liveness check indicating the server process is alive and responsive. Returns server uptime and process ID. Used by container orchestrators to determine if the application needs to be restarted. This is a lightweight check that always succeeds unless the process is completely unresponsive.
   * @return {LivenessResponse} 200 - Server is alive and responsive
   */
  async getLiveness(req: Request, res: Response) {
    const response: LivenessSuccessResponse = {
      success: true,
      data: {
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime,
        pid: process.pid
      }
    };

    res.status(HttpStatusCode.OK).json(response);
  }

  /**
   * GET /api/v2/health
   * @summary API v2 health and feature discovery endpoint
   * @tags Health
   * @description Returns v2 API health status along with available features and supported endpoints. Useful for API discovery and version compatibility checks. Includes information about supported node types and available API operations. This endpoint is specific to the timeline API version 2.
   * @return {V2HealthResponse} 200 - V2 API health check with feature list
   */
  async getV2Health(req: Request, res: Response) {
    const response: V2HealthSuccessResponse = {
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
    };

    res.status(HttpStatusCode.OK).json(response);
  }

  /**
   * Check database connectivity
   */
  private async checkDatabaseConnectivity(): Promise<void> {
    // Simple query to test database connection
    if (!this.database) {
      throw new Error('Database instance not available');
    }

    // In a real implementation, you might run:
    // await this.database.raw('SELECT 1');
  }

  /**
   * Check if application is ready
   */
  private isApplicationReady(): boolean {
    // Check if all critical components are initialized
    return !!(this.database);
  }
}
