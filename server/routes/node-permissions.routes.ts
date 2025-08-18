/**
 * Node Permissions API Routes
 * RESTful endpoints for node permission management
 */

import { Router } from 'express';
import type { AwilixContainer } from 'awilix';
import { NodePermissionController } from '../controllers/node-permission.controller';

export function createNodePermissionRoutes(container: AwilixContainer): Router {
  const router = Router();
  
  // Resolve controller from container for each request
  const getController = () => container.resolve<NodePermissionController>('nodePermissionController');

  // Node access endpoints
  router.get('/nodes/:nodeId/access', (req, res) => getController().checkAccess(req, res));
  router.get('/nodes/:nodeId/access-level', (req, res) => getController().getAccessLevel(req, res));
  router.get('/nodes/:nodeId/ownership', (req, res) => getController().checkOwnership(req, res));

  // Permission management endpoints (owner only)
  router.get('/nodes/:nodeId/permissions', (req, res) => getController().getPermissions(req, res));
  router.post('/nodes/:nodeId/permissions', (req, res) => getController().setPermissions(req, res));
  router.delete('/nodes/:nodeId/permissions/:policyId', (req, res) => getController().deletePolicy(req, res));

  // Batch operations
  router.get('/nodes/accessible', (req, res) => getController().getAccessibleNodes(req, res));
  router.post('/nodes/batch-check', (req, res) => getController().batchCheckAccess(req, res));

  // Admin endpoints
  router.post('/admin/cleanup-expired-policies', (req, res) => getController().cleanupExpiredPolicies(req, res));

  return router;
}