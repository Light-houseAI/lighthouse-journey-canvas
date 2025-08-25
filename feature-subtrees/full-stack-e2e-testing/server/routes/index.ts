import { Router } from "express";

// Import route modules
import aiRoutes from "./ai.routes";
import hierarchyRoutes from "./hierarchy.routes";
import authRoutes from "./auth.routes";
import onboardingRoutes from "./onboarding.routes";
import legacyRoutes from "./legacy.routes";
import docsRoutes from "./docs.routes";
import userRoutes from "./user.routes";
import organizationRoutes from "./organization.routes";

const router = Router();

// Register all route modules with their prefixes
router.use('/ai', aiRoutes);
router.use('/api/v2/timeline', hierarchyRoutes);
router.use('/api', authRoutes);
router.use('/api/onboarding', onboardingRoutes);
router.use('/api', legacyRoutes);
router.use('/api/docs', docsRoutes);
router.use('/api/v2/users', userRoutes);
router.use('/api/v2/organizations', organizationRoutes);

// Node permissions are now integrated into hierarchy routes at /api/v2/timeline

export default router;
