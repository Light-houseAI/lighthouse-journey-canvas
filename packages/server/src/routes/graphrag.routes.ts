/**
 * GraphRAG Routes
 *
 * API routes for pgvector-based GraphRAG search functionality
 * Maintains compatibility with Neo4j GraphRAG API specification
 */

import { Router } from 'express';

import { CONTROLLER_TOKENS } from '../core/container-tokens.js';
import { containerMiddleware,requireAuth, validateRequestSize } from '../middleware/index.js';

const router: any = Router();

// Apply middleware to all routes
router.use(requireAuth, validateRequestSize, containerMiddleware);

/**
 * POST /api/v2/graphrag/search
 *
 * Search for user profiles using GraphRAG with pgvector
 * Compatible with Neo4j GraphRAG API specification
 */
router.post('/search', async (req: any, res: any) => {
  const controller = ((req as any).scope as any).resolve(
    CONTROLLER_TOKENS.PGVECTOR_GRAPHRAG_CONTROLLER
  );
  return controller.searchProfiles(req, res);
});

export default router;
