import { Router } from 'express';

import { OrganizationController } from '../controllers/organization.controller.js';
import { CONTROLLER_TOKENS } from '../core/container-tokens.js';
import { containerMiddleware,requireAuth, validateRequestSize } from '../middleware/index.js';

const router: any = Router();

// Apply middleware to all routes
router.use(requireAuth, validateRequestSize, containerMiddleware);

// Get user's organizations
router.get('/', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(CONTROLLER_TOKENS.ORGANIZATION_CONTROLLER);
  await controller.getUserOrganizations(req, res);
});

// Organization search endpoint
router.get('/search', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(CONTROLLER_TOKENS.ORGANIZATION_CONTROLLER);
  await controller.searchOrganizations(req, res);
});

export default router;
