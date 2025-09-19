import { Router } from 'express';

import authRoutes from './auth.routes';
import { createBasicHealthRoutes } from './health';
import graphragRoutes from './graphrag.routes';
// Import route modules
import hierarchyRoutes from './hierarchy.routes';
import onboardingRoutes from './onboarding.routes';
import organizationRoutes from './organization.routes';
import userRoutes from './user.routes';

const router = Router();

// Register health routes
router.use('/', createBasicHealthRoutes());

// Register all route modules with their prefixes
router.use('/v2/timeline', hierarchyRoutes);
router.use('/auth', authRoutes);
router.use('/onboarding', onboardingRoutes);

router.use('/v2/users', userRoutes);
router.use('/v2/organizations', organizationRoutes);
router.use('/v2/graphrag', graphragRoutes);

// Node permissions are now integrated into hierarchy routes at /api/v2/timeline

export default router;
