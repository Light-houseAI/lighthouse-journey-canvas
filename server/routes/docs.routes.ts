/**
 * Documentation Routes
 * Provides API documentation endpoints for all versions
 */

import { Router } from 'express';
import { DocsController } from '../controllers/docs.controller';

const router = Router();
const docsController = new DocsController();

// V1 API Documentation
router.get('/v1', async (req, res) => {
  await docsController.getV1Docs(req, res);
});

// V2 API Documentation  
router.get('/v2', async (req, res) => {
  await docsController.getV2Docs(req, res);
});

// Default docs endpoint (redirect to latest version)
router.get('/', async (req, res) => {
  await docsController.getV2Docs(req, res);
});

export default router;