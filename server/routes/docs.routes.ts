/**
 * Documentation Routes
 * Provides API documentation endpoints for all versions
 */

import { Router } from 'express';

import { DocsController } from '../controllers/docs.controller';
import { CONTROLLER_TOKENS } from '../core/container-tokens';
import { containerMiddleware } from '../middleware';

const router = Router();

// Apply container middleware for DI
router.use(containerMiddleware);

// V1 API Documentation
router.get('/v1', async (req, res) => {
  const controller = req.scope.resolve<DocsController>(
    CONTROLLER_TOKENS.DOCS_CONTROLLER
  );
  await controller.getV1Docs(req, res);
});

// V2 API Documentation
router.get('/v2', async (req, res) => {
  const controller = req.scope.resolve<DocsController>(
    CONTROLLER_TOKENS.DOCS_CONTROLLER
  );
  await controller.getV2Docs(req, res);
});

// Default docs endpoint (redirect to latest version)
router.get('/', async (req, res) => {
  const controller = req.scope.resolve<DocsController>(
    CONTROLLER_TOKENS.DOCS_CONTROLLER
  );
  await controller.getV2Docs(req, res);
});

export default router;
