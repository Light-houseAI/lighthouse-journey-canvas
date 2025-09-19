import { Router } from 'express';

import { UserController } from '../controllers/user.controller';
import { CONTROLLER_TOKENS } from '../core/container-tokens';
import {
  containerMiddleware,
  requireAuth,
  validateRequestSize,
} from '../middleware';

const router = Router();

// Apply middleware to all routes
router.use(requireAuth, validateRequestSize, containerMiddleware);

// User search endpoint
router.get('/search', async (req, res) => {
  const controller = req.scope.resolve<UserController>(
    CONTROLLER_TOKENS.USER_CONTROLLER
  );
  await controller.searchUsers(req, res);
});

export default router;
