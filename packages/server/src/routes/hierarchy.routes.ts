import { Router } from 'express';

import { CONTROLLER_TOKENS } from '../core/container-tokens.js';
import { containerMiddleware,requireAuth, validateRequestSize } from '../middleware/index.js';

const router: any = Router();

// Apply middleware to all routes
router.use(requireAuth, validateRequestSize, containerMiddleware);

// Node CRUD Operations
router.post('/nodes', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(CONTROLLER_TOKENS.HIERARCHY_CONTROLLER);
  await controller.createNode(req, res);
});

router.get('/nodes', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(CONTROLLER_TOKENS.HIERARCHY_CONTROLLER);
  await controller.listNodes(req, res);
});

router.get('/nodes/:id', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(CONTROLLER_TOKENS.HIERARCHY_CONTROLLER);
  await controller.getNodeById(req, res);
});

router.patch('/nodes/:id', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(CONTROLLER_TOKENS.HIERARCHY_CONTROLLER);
  await controller.updateNode(req, res);
});

router.delete('/nodes/:id', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(CONTROLLER_TOKENS.HIERARCHY_CONTROLLER);
  await controller.deleteNode(req, res);
});

// Node Insights Operations
router.get('/nodes/:nodeId/insights', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(CONTROLLER_TOKENS.HIERARCHY_CONTROLLER);
  await controller.getNodeInsights(req, res);
});

router.post('/nodes/:nodeId/insights', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(CONTROLLER_TOKENS.HIERARCHY_CONTROLLER);
  await controller.createInsight(req, res);
});

router.put('/insights/:insightId', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(CONTROLLER_TOKENS.HIERARCHY_CONTROLLER);
  await controller.updateInsight(req, res);
});

router.delete('/insights/:insightId', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(CONTROLLER_TOKENS.HIERARCHY_CONTROLLER);
  await controller.deleteInsight(req, res);
});

// Node Permissions Operations

// Permission management endpoints (owner only)
router.get('/nodes/:nodeId/permissions', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(CONTROLLER_TOKENS.NODE_PERMISSION_CONTROLLER);
  await controller.getPermissions(req, res);
});

router.post('/nodes/:nodeId/permissions', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(CONTROLLER_TOKENS.NODE_PERMISSION_CONTROLLER);
  await controller.setPermissions(req, res);
});

router.delete('/nodes/:nodeId/permissions/:policyId', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(CONTROLLER_TOKENS.NODE_PERMISSION_CONTROLLER);
  await controller.deletePolicy(req, res);
});

// Single policy update endpoint
router.put('/permissions/:policyId', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(CONTROLLER_TOKENS.NODE_PERMISSION_CONTROLLER);
  await controller.updatePolicy(req, res);
});

// Bulk policy updates endpoint
router.put('/permissions/bulk', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(CONTROLLER_TOKENS.NODE_PERMISSION_CONTROLLER);
  await controller.updateBulkPolicies(req, res);
});

// Bulk permissions endpoint
router.post('/nodes/permissions/bulk', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(CONTROLLER_TOKENS.NODE_PERMISSION_CONTROLLER);
  await controller.getBulkPermissions(req, res);
});

export default router;
