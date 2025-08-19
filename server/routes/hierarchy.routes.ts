import { Router } from 'express';
import { HierarchyController } from '../controllers/hierarchy-controller';
import { NodePermissionController } from '../controllers/node-permission.controller';
import { requireAuth, validateRequestSize, containerMiddleware } from '../middleware';
import { CONTROLLER_TOKENS } from '../core/container-tokens';

const router = Router();

// Apply middleware to all routes
router.use(requireAuth, validateRequestSize, containerMiddleware);

// Node CRUD Operations
router.post('/nodes', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>(CONTROLLER_TOKENS.HIERARCHY_CONTROLLER);
  await controller.createNode(req, res);
});

router.get('/nodes', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>(CONTROLLER_TOKENS.HIERARCHY_CONTROLLER);
  await controller.listNodes(req, res);
});

router.get('/nodes/:id', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>(CONTROLLER_TOKENS.HIERARCHY_CONTROLLER);
  await controller.getNodeById(req, res);
});

router.patch('/nodes/:id', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>(CONTROLLER_TOKENS.HIERARCHY_CONTROLLER);
  await controller.updateNode(req, res);
});

router.delete('/nodes/:id', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>(CONTROLLER_TOKENS.HIERARCHY_CONTROLLER);
  await controller.deleteNode(req, res);
});

// Node Insights Operations
router.get('/nodes/:nodeId/insights', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>(CONTROLLER_TOKENS.HIERARCHY_CONTROLLER);
  await controller.getNodeInsights(req, res);
});

router.post('/nodes/:nodeId/insights', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>(CONTROLLER_TOKENS.HIERARCHY_CONTROLLER);
  await controller.createInsight(req, res);
});

router.put('/insights/:insightId', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>(CONTROLLER_TOKENS.HIERARCHY_CONTROLLER);
  await controller.updateInsight(req, res);
});

router.delete('/insights/:insightId', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>(CONTROLLER_TOKENS.HIERARCHY_CONTROLLER);
  await controller.deleteInsight(req, res);
});

// Node Permissions Operations

// Permission management endpoints (owner only)
router.get('/nodes/:nodeId/permissions', async (req, res) => {
  const controller = req.scope.resolve<NodePermissionController>(CONTROLLER_TOKENS.NODE_PERMISSION_CONTROLLER);
  await controller.getPermissions(req, res);
});

router.post('/nodes/:nodeId/permissions', async (req, res) => {
  const controller = req.scope.resolve<NodePermissionController>(CONTROLLER_TOKENS.NODE_PERMISSION_CONTROLLER);
  await controller.setPermissions(req, res);
});

router.delete('/nodes/:nodeId/permissions/:policyId', async (req, res) => {
  const controller = req.scope.resolve<NodePermissionController>(CONTROLLER_TOKENS.NODE_PERMISSION_CONTROLLER);
  await controller.deletePolicy(req, res);
});


export default router;
