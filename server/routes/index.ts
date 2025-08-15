import { Router } from "express";

// Import route modules
import aiRoutes from "./ai.routes";
import hierarchyRoutes from "./hierarchy.routes";
import authRoutes from "./auth.routes";
import onboardingRoutes from "./onboarding.routes";
import legacyRoutes from "./legacy.routes";

const router = Router();

// Register all route modules with their prefixes
router.use('/ai', aiRoutes);
router.use('/api/v2/timeline', hierarchyRoutes);
router.use('/api', authRoutes);
router.use('/api/onboarding', onboardingRoutes);
router.use('/api', legacyRoutes);

export default router;
