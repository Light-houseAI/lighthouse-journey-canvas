/**
 * Peer Insights Routes
 * API endpoints for peer insights (cross-user anonymized learning)
 *
 * Endpoints:
 * - GET /api/v2/peer-insights/node/:nodeId - Get peer insights for a work track
 */

import { Router } from 'express';

import { CONTAINER_TOKENS } from '../core/container-tokens.js';
import { requireAuth, containerMiddleware } from '../middleware/index.js';
import type { PeerInsightsService } from '../services/peer-insights.service.js';

const router = Router();

router.use(requireAuth);

/**
 * @route GET /api/v2/peer-insights/node/:nodeId
 * @summary Get peer insights for a work track
 * @description Finds anonymized peer sessions similar to the user's sessions in this track,
 *   using 3-signal fusion (pgvector+BM25, GraphRAG), and generates learning points via Gemini.
 */
router.get(
  '/node/:nodeId',
  containerMiddleware,
  async (req: any, res: any, next: any) => {
    try {
      const service: PeerInsightsService = req.scope.resolve(
        CONTAINER_TOKENS.PEER_INSIGHTS_SERVICE
      );
      const results = await service.findPeerInsightsForNode(
        req.user.id,
        req.params.nodeId
      );
      res.json(results);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
