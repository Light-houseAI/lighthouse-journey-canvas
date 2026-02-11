/**
 * Context Stitching Routes
 *
 * Endpoints for retrieving persisted context stitching results:
 * - Tier 1: Workstreams (outcome-based groupings)
 * - Tier 2: Tool Mastery (tool usage patterns)
 * - Tier 3: Process Patterns (repetitive cross-tool sequences)
 */

import { Router } from 'express';
import { CONTAINER_TOKENS } from '../core/container-tokens.js';
import { requireAuth, containerMiddleware } from '../middleware/index.js';

const router = Router();
router.use(requireAuth);

/**
 * @route GET /api/v2/context-stitching/workstreams
 * @summary Get user's workstream groupings (Tier 1)
 * @description Returns persisted Tier 1 context stitching results (outcome-based workstreams)
 * @query {number} [minConfidence=0.6] Minimum confidence threshold
 * @query {number} [limit=50] Maximum results to return
 * @response {200} {Workstream[]} List of workstreams
 * @security BearerAuth
 */
router.get('/workstreams', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const persistenceService = req.scope.resolve(CONTAINER_TOKENS.CONTEXT_STITCHING_PERSISTENCE_SERVICE);
    const userId = req.user!.id;
    const minConfidence = req.query.minConfidence
      ? parseFloat(req.query.minConfidence as string)
      : 0.6;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 50;

    const workstreams = await persistenceService.getWorkstreamsByUser(userId, {
      minConfidence,
      limit,
    });

    res.json({
      data: workstreams,
      meta: {
        count: workstreams.length,
        minConfidence,
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v2/context-stitching/tool-mastery
 * @summary Get user's tool mastery analysis (Tier 2)
 * @description Returns persisted Tier 2 context stitching results (tool usage patterns)
 * @query {string} [tool] Filter by specific tool name
 * @response {200} {ToolMasteryGroup[]} List of tool mastery groups
 * @security BearerAuth
 */
router.get('/tool-mastery', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const persistenceService = req.scope.resolve(CONTAINER_TOKENS.CONTEXT_STITCHING_PERSISTENCE_SERVICE);
    const userId = req.user!.id;
    const toolName = req.query.tool as string | undefined;

    const groups = await persistenceService.getToolMasteryByUser(userId, toolName);

    res.json({
      data: groups,
      meta: {
        count: groups.length,
        filteredTool: toolName,
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v2/context-stitching/process-patterns
 * @summary Get user's repetitive workflow patterns (Tier 3)
 * @description Returns persisted Tier 3 context stitching results (process patterns)
 * @query {number} [minFrequency=3] Minimum pattern frequency
 * @query {number} [limit=50] Maximum results to return
 * @response {200} {ProcessPattern[]} List of process patterns
 * @security BearerAuth
 */
router.get('/process-patterns', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const persistenceService = req.scope.resolve(CONTAINER_TOKENS.CONTEXT_STITCHING_PERSISTENCE_SERVICE);
    const userId = req.user!.id;
    const minFrequency = req.query.minFrequency
      ? parseInt(req.query.minFrequency as string, 10)
      : 3;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 50;

    const patterns = await persistenceService.getProcessPatternsByUser(userId, {
      minFrequency,
      limit,
    });

    res.json({
      data: patterns,
      meta: {
        count: patterns.length,
        minFrequency,
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
