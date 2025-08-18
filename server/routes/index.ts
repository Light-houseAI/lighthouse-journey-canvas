import { Router } from "express";

// Import route modules
import aiRoutes from "./ai.routes";
import hierarchyRoutes from "./hierarchy.routes";
import authRoutes from "./auth.routes";
import onboardingRoutes from "./onboarding.routes";
import legacyRoutes from "./legacy.routes";
import docsRoutes from "./docs.routes";
// Import node permission routes
import { createNodePermissionRoutes } from "./node-permissions.routes";
import { createOrganizationRoutes } from "./organizations.routes";
import { Container } from "../core/container-setup";

const router = Router();

// Register all route modules with their prefixes
router.use('/ai', aiRoutes);
router.use('/api/v2/timeline', hierarchyRoutes);
router.use('/api', authRoutes);
router.use('/api/onboarding', onboardingRoutes);
router.use('/api', legacyRoutes);
router.use('/api/docs', docsRoutes);

// Register node permission routes with dependency injection
const container = Container.getContainer();
router.use('/api/v2', createNodePermissionRoutes(container));
router.use('/api/v2', createOrganizationRoutes(container));

export default router;
