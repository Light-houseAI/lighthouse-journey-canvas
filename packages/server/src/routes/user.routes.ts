import { Router } from 'express';

import { CONTROLLER_TOKENS } from '../core/container-tokens.js';
import {
  containerMiddleware,
  requireAuth,
  validateRequestSize,
} from '../middleware/index.js';

const router: any = Router();

// Apply middleware to all routes
router.use(requireAuth, validateRequestSize, containerMiddleware);

// User search endpoint
router.get('/search', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.USER_CONTROLLER
  );
  await controller.searchUsers(req, res);
});

export default router;
