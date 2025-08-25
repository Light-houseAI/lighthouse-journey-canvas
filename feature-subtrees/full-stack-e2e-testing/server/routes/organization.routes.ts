import { Router } from 'express';
import { OrganizationController } from '../controllers/organization.controller';
import { requireAuth, validateRequestSize, containerMiddleware } from '../middleware';
import { CONTROLLER_TOKENS } from '../core/container-tokens';

const router = Router();

// Apply middleware to all routes
router.use(requireAuth, validateRequestSize, containerMiddleware);

// Get user's organizations
router.get('/', async (req, res) => {
  const controller = req.scope.resolve<OrganizationController>(CONTROLLER_TOKENS.ORGANIZATION_CONTROLLER);
  await controller.getUserOrganizations(req, res);
});

// Organization search endpoint
router.get('/search', async (req, res) => {
  const controller = req.scope.resolve<OrganizationController>(CONTROLLER_TOKENS.ORGANIZATION_CONTROLLER);
  await controller.searchOrganizations(req, res);
});

export default router;