import { Router } from 'express';

import { CONTROLLER_TOKENS } from '../core/container-tokens.js';
import {
  asyncHandler,
  containerMiddleware,
  requireAuth,
  validateRequestSize,
} from '../middleware/index.js';

const router: any = Router();

// Apply middleware to all routes
router.use(requireAuth, validateRequestSize, containerMiddleware);

// Node CRUD Operations
router.post('/nodes', asyncHandler(async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.HIERARCHY_CONTROLLER
  );
  await controller.createNode(req, res);
}));

router.get('/nodes', asyncHandler(async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.HIERARCHY_CONTROLLER
  );
  await controller.listNodes(req, res);
}));

router.get('/nodes/:id', asyncHandler(async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.HIERARCHY_CONTROLLER
  );
  await controller.getNodeById(req, res);
}));

router.put('/nodes/:id', asyncHandler(async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.HIERARCHY_CONTROLLER
  );
  await controller.replaceNode(req, res);
}));

router.patch('/nodes/:id', asyncHandler(async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.HIERARCHY_CONTROLLER
  );
  await controller.updateNode(req, res);
}));

router.delete('/nodes/:id', asyncHandler(async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.HIERARCHY_CONTROLLER
  );
  await controller.deleteNode(req, res);
}));

// Node Insights Operations
router.get('/nodes/:nodeId/insights', asyncHandler(async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.HIERARCHY_CONTROLLER
  );
  await controller.getNodeInsights(req, res);
}));

router.post('/nodes/:nodeId/insights', asyncHandler(async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.HIERARCHY_CONTROLLER
  );
  await controller.createInsight(req, res);
}));

router.put('/insights/:insightId', asyncHandler(async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.HIERARCHY_CONTROLLER
  );
  await controller.updateInsight(req, res);
}));

router.delete('/insights/:insightId', asyncHandler(async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.HIERARCHY_CONTROLLER
  );
  await controller.deleteInsight(req, res);
}));

// Node Sessions Operations (LIG-247: Desktop Session to Work Track Mapping)
router.get('/nodes/:nodeId/sessions', asyncHandler(async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.SESSION_CONTROLLER
  );
  await controller.getNodeSessions(req, res);
}));

// Node Permissions Operations

// Permission management endpoints (owner only)
router.get('/nodes/:nodeId/permissions', asyncHandler(async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.NODE_PERMISSION_CONTROLLER
  );
  await controller.getPermissions(req, res);
}));

router.post('/nodes/:nodeId/permissions', asyncHandler(async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.NODE_PERMISSION_CONTROLLER
  );
  await controller.setPermissions(req, res);
}));

router.delete(
  '/nodes/:nodeId/permissions/:policyId',
  asyncHandler(async (req: any, res: any) => {
    const controller = ((req as any).scope as any).resolve(
      CONTROLLER_TOKENS.NODE_PERMISSION_CONTROLLER
    );
    await controller.deletePolicy(req, res);
  })
);

// Single policy update endpoint
router.put('/permissions/:policyId', asyncHandler(async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.NODE_PERMISSION_CONTROLLER
  );
  await controller.updatePolicy(req, res);
}));

// Bulk policy updates endpoint
router.put('/permissions/bulk', asyncHandler(async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.NODE_PERMISSION_CONTROLLER
  );
  await controller.updateBulkPolicies(req, res);
}));

// Bulk permissions endpoint
router.post('/nodes/permissions/bulk', asyncHandler(async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.NODE_PERMISSION_CONTROLLER
  );
  await controller.getBulkPermissions(req, res);
}));

export default router;
