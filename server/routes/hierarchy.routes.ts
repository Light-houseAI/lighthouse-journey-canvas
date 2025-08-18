import { Router } from 'express';
import { HierarchyController } from '../controllers/hierarchy-controller';
import { DocsController } from '../controllers/docs.controller';
import { requireAuth, validateRequestSize, containerMiddleware } from '../middleware';

const router = Router();

// Apply middleware to all routes
router.use(requireAuth, validateRequestSize, containerMiddleware);

// Node CRUD Operations
router.post('/nodes', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>('hierarchyController');
  await controller.createNode(req, res);
});

router.get('/nodes', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>('hierarchyController');
  await controller.listNodes(req, res);
});

router.get('/nodes/:id', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>('hierarchyController');
  await controller.getNodeById(req, res);
});

router.patch('/nodes/:id', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>('hierarchyController');
  await controller.updateNode(req, res);
});

router.delete('/nodes/:id', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>('hierarchyController');
  await controller.deleteNode(req, res);
});

// Node Insights Operations
router.get('/nodes/:nodeId/insights', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>('hierarchyController');
  await controller.getNodeInsights(req, res);
});

router.post('/nodes/:nodeId/insights', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>('hierarchyController');
  await controller.createInsight(req, res);
});

router.put('/insights/:insightId', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>('hierarchyController');
  await controller.updateInsight(req, res);
});

router.delete('/insights/:insightId', async (req, res) => {
  const controller = req.scope.resolve<HierarchyController>('hierarchyController');
  await controller.deleteInsight(req, res);
});

export default router;
