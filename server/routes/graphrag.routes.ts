/**
 * GraphRAG Routes
 * 
 * API routes for pgvector-based GraphRAG search functionality
 * Maintains compatibility with Neo4j GraphRAG API specification
 */

import { Router } from 'express';

import { PgVectorGraphRAGController } from '../controllers/pgvector-graphrag.controller';
import { CONTROLLER_TOKENS } from '../core/container-tokens';
import { containerMiddleware,requireAuth, validateRequestSize } from '../middleware';

const router = Router();

// Apply middleware to all routes
router.use(requireAuth, validateRequestSize, containerMiddleware);

/**
 * POST /api/v2/graphrag/search
 * 
 * Search for user profiles using GraphRAG with pgvector
 * Compatible with Neo4j GraphRAG API specification
 */
router.post('/search', async (req, res) => {
  const controller = req.scope.resolve<PgVectorGraphRAGController>(
    CONTROLLER_TOKENS.PGVECTOR_GRAPHRAG_CONTROLLER
  );
  await controller.searchProfiles(req, res);
});

export default router;