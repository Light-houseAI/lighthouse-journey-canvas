import { Router } from 'express';

import authRoutes from './auth.routes.js';
import desktopTrackRoutes from './desktop-track.routes.js';
import experienceMatchesRoutes from './experience-matches.routes.js';
import feedbackRoutes from './feedback.routes.js';
import filesRoutes from './files.routes.js';
import graphragRoutes from './graphrag.routes.js';
import { createBasicHealthRoutes } from './health.js';
// Import route modules
import hierarchyRoutes from './hierarchy.routes.js';
import onboardingRoutes from './onboarding.routes.js';
import organizationRoutes from './organization.routes.js';
import privacyRoutes from './privacy.routes.js';
import insightAssistantRoutes from './insight-assistant.routes.js';
import { companyDocumentsRoutes } from './company-documents.routes.js';
import sessionsRoutes from './sessions.routes.js';
import updatesRoutes from './updates.routes.js';
import uploadsRoutes from './uploads.routes.js';
import userRoutes from './user.routes.js';
import workflowAnalysisRoutes from './workflow-analysis.routes.js';

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
router.use('/v2/files', filesRoutes);
router.use('/v2/uploads', uploadsRoutes);
router.use('/v2/sessions', sessionsRoutes);
router.use('/v2/desktop', desktopTrackRoutes);
router.use('/v2/workflow-analysis', workflowAnalysisRoutes);
router.use('/v2/feedback', feedbackRoutes);
router.use('/v2/privacy', privacyRoutes);
router.use('/v2/insight-assistant', insightAssistantRoutes);
router.use('/v2/company-docs', companyDocumentsRoutes());

// Node permissions are now integrated into hierarchy routes at /api/v2/timeline

export default router;
