/**
 * Nano Agent Routes
 *
 * API endpoints for the Nano Agent automation system.
 *
 * Flow CRUD:
 * - POST   /flows                          - Create flow
 * - GET    /flows                          - List flows
 * - GET    /flows/:flowId                  - Get flow
 * - PUT    /flows/:flowId                  - Update flow
 * - DELETE /flows/:flowId                  - Delete flow
 * - POST   /flows/:flowId/share            - Share with org
 * - POST   /flows/:flowId/fork             - Fork a shared flow
 *
 * Action Generation:
 * - POST   /generate-actions               - NL → ExecutableActions
 * - POST   /generate-from-workflow          - Workflow → ExecutableActions
 *
 * Execution:
 * - POST   /flows/:flowId/execute          - Start execution
 * - GET    /executions/:executionId        - Get status
 * - GET    /executions/:executionId/stream - SSE progress
 * - POST   /executions/:executionId/confirm - Confirm step
 * - POST   /executions/:executionId/skip    - Skip step
 * - POST   /executions/:executionId/abort   - Abort
 *
 * Desktop:
 * - GET    /desktop/pending                - Poll for work
 * - POST   /desktop/report                 - Report step result
 */

import { Router } from 'express';

import { CONTAINER_TOKENS } from '../core/container-tokens.js';
import { requireAuth, containerMiddleware } from '../middleware/index.js';

const router = Router();

// All nano agent routes require authentication
router.use(requireAuth);

// Helper to resolve controller
const resolveController = (req: any) =>
  req.scope.resolve(CONTAINER_TOKENS.NANO_AGENT_CONTROLLER);

// ============================================================================
// ACTION GENERATION
// ============================================================================

router.post('/generate-actions', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = resolveController(req);
    await controller.generateActionsFromNL(req, res);
  } catch (error) {
    next(error);
  }
});

router.post('/generate-from-workflow', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = resolveController(req);
    await controller.generateActionsFromWorkflow(req, res);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// FLOW CRUD
// ============================================================================

router.post('/flows', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = resolveController(req);
    await controller.createFlow(req, res);
  } catch (error) {
    next(error);
  }
});

router.get('/flows', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = resolveController(req);
    await controller.listFlows(req, res);
  } catch (error) {
    next(error);
  }
});

router.get('/flows/:flowId', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = resolveController(req);
    await controller.getFlow(req, res);
  } catch (error) {
    next(error);
  }
});

router.put('/flows/:flowId', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = resolveController(req);
    await controller.updateFlow(req, res);
  } catch (error) {
    next(error);
  }
});

router.delete('/flows/:flowId', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = resolveController(req);
    await controller.deleteFlow(req, res);
  } catch (error) {
    next(error);
  }
});

router.post('/flows/:flowId/share', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = resolveController(req);
    await controller.shareFlow(req, res);
  } catch (error) {
    next(error);
  }
});

router.post('/flows/:flowId/fork', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = resolveController(req);
    await controller.forkFlow(req, res);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// EXECUTION
// ============================================================================

router.post('/flows/:flowId/execute', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = resolveController(req);
    await controller.startExecution(req, res);
  } catch (error) {
    next(error);
  }
});

router.get('/executions/:executionId', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = resolveController(req);
    await controller.getExecution(req, res);
  } catch (error) {
    next(error);
  }
});

router.get('/executions/:executionId/stream', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = resolveController(req);
    await controller.streamExecution(req, res);
  } catch (error) {
    next(error);
  }
});

router.post('/executions/:executionId/confirm', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = resolveController(req);
    await controller.confirmStep(req, res);
  } catch (error) {
    next(error);
  }
});

router.post('/executions/:executionId/skip', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = resolveController(req);
    await controller.skipStep(req, res);
  } catch (error) {
    next(error);
  }
});

router.post('/executions/:executionId/abort', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = resolveController(req);
    await controller.abortExecution(req, res);
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// DESKTOP COMPANION
// ============================================================================

router.get('/desktop/pending', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = resolveController(req);
    await controller.getDesktopPending(req, res);
  } catch (error) {
    next(error);
  }
});

router.post('/desktop/report', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = resolveController(req);
    await controller.handleDesktopReport(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
