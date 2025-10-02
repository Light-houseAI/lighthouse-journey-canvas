import { Router } from 'express';

import { CONTROLLER_TOKENS } from '../core/container-tokens.js';
import {
  containerMiddleware,
  requireAuth,
  validateRequestSize,
} from '../middleware/index.js';

const router: any = Router({ mergeParams: true }); // mergeParams to access :nodeId from parent router

// Apply middleware to all routes
router.use(requireAuth, validateRequestSize, containerMiddleware);

// Create update
router.post('/', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.UPDATES_CONTROLLER
  );
  await controller.createUpdate(req, res);
});

// Get updates for node (paginated)
router.get('/', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.UPDATES_CONTROLLER
  );
  await controller.getUpdatesByNodeId(req, res);
});

// Get specific update
router.get('/:updateId', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.UPDATES_CONTROLLER
  );
  await controller.getUpdateById(req, res);
});

// Update existing update
router.put('/:updateId', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.UPDATES_CONTROLLER
  );
  await controller.updateUpdate(req, res);
});

// Delete update
router.delete('/:updateId', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.UPDATES_CONTROLLER
  );
  await controller.deleteUpdate(req, res);
});

export default router;