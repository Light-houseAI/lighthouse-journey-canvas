/**
 * Health Check Routes
 * Provides comprehensive health monitoring endpoints
 */

import { Router } from 'express';

import { HealthController } from '../controllers/health.controller';
import { Database } from '../core/container';


/**
 * Create health check routes
 */
export function createHealthRoutes(database: Database): Router {
  const router = Router();
  const healthController = new HealthController(database);

  // Basic health check - lightweight, fast response
  router.get('/health', (req, res) => healthController.getHealth(req, res));

  // Kubernetes-style probes
  router.get('/live', (req, res) => healthController.getLiveness(req, res));
  router.get('/ready', (req, res) => healthController.getReadiness(req, res));

}

/**
 * Default health routes for quick setup
 */
export function createBasicHealthRoutes(): Router {
  const router = Router();

  // Minimal health check
  router.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Minimal liveness probe
  router.get('/live', (req, res) => {
    res.json({
      status: 'alive',
      timestamp: new Date().toISOString()
    });
  });

  // Minimal readiness probe
  router.get('/ready', (req, res) => {
    res.json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  });

  return router;
}
