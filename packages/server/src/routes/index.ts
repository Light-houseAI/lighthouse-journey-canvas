import { Router } from 'express';

import authRoutes from './auth.routes.js';
import { createBasicHealthRoutes } from './health.js';
import graphragRoutes from './graphrag.routes.js';
// Import route modules
import hierarchyRoutes from './hierarchy.routes.js';
import onboardingRoutes from './onboarding.routes.js';
import organizationRoutes from './organization.routes.js';
import userRoutes from './user.routes.js';
import experienceMatchesRoutes from './experience-matches.routes.js';
import updatesRoutes from './updates.routes.js';

const router: any = Router();

// Register health routes
router.use('/', createBasicHealthRoutes());

// Register all route modules with their prefixes
router.use('/v2/timeline', hierarchyRoutes);
router.use('/auth', authRoutes);
router.use('/onboarding', onboardingRoutes);

router.use('/v2/users', userRoutes);
router.use('/v2/organizations', organizationRoutes);
router.use('/v2/graphrag', graphragRoutes);
router.use('/v2/experience', experienceMatchesRoutes);
router.use('/nodes/:nodeId/updates', updatesRoutes);

// Node permissions are now integrated into hierarchy routes at /api/v2/timeline

export default router;
