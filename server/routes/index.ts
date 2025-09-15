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

// Register health routes under /api prefix
router.use('/api', createBasicHealthRoutes());

// Register all route modules with their prefixes
router.use('/api/v2/timeline', hierarchyRoutes);
router.use('/api/auth', authRoutes);
router.use('/api/onboarding', onboardingRoutes);

router.use('/api/v2/users', userRoutes);
router.use('/api/v2/organizations', organizationRoutes);
router.use('/api/v2/graphrag', graphragRoutes);

// Node permissions are now integrated into hierarchy routes at /api/v2/timeline

export default router;
