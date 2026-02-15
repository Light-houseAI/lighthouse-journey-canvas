/**
 * Group Routes
 * API endpoints for group management (CRUD + context resolution)
 *
 * Endpoints:
 * - POST   /api/v2/groups                       - Create a group
 * - GET    /api/v2/groups                       - List user's groups
 * - GET    /api/v2/groups/:groupId              - Get group with items
 * - PATCH  /api/v2/groups/:groupId              - Update group
 * - DELETE /api/v2/groups/:groupId              - Delete group
 * - POST   /api/v2/groups/:groupId/items        - Add items to group
 * - DELETE /api/v2/groups/:groupId/items/:itemId - Remove item from group
 * - GET    /api/v2/groups/:groupId/context       - Resolve group sessions for Insight Assistant
 */

import { Router } from 'express';

import { CONTAINER_TOKENS } from '../core/container-tokens.js';
import { requireAuth, containerMiddleware } from '../middleware/index.js';

const router = Router();

// All group routes require authentication
router.use(requireAuth);

/**
 * POST /api/v2/groups
 * Create a new group
 */
router.post('/', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.GROUP_CONTROLLER);
    await controller.createGroup(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v2/groups
 * List user's groups (optional ?nodeId= filter)
 */
router.get('/', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.GROUP_CONTROLLER);
    await controller.listGroups(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v2/groups/:groupId
 * Get group with items
 */
router.get('/:groupId', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.GROUP_CONTROLLER);
    await controller.getGroup(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v2/groups/:groupId
 * Update group name/description
 */
router.patch('/:groupId', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.GROUP_CONTROLLER);
    await controller.updateGroup(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v2/groups/:groupId
 * Delete a group
 */
router.delete('/:groupId', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.GROUP_CONTROLLER);
    await controller.deleteGroup(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v2/groups/:groupId/items
 * Add items to a group
 */
router.post('/:groupId/items', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.GROUP_CONTROLLER);
    await controller.addItems(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v2/groups/:groupId/items/:itemId
 * Remove an item from a group
 */
router.delete('/:groupId/items/:itemId', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.GROUP_CONTROLLER);
    await controller.removeItem(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v2/groups/:groupId/context
 * Resolve group → session_mappings data for Insight Assistant queries
 */
router.get('/:groupId/context', containerMiddleware, async (req: any, res: any, next: any) => {
  try {
    const controller = req.scope.resolve(CONTAINER_TOKENS.GROUP_CONTROLLER);
    await controller.getGroupContext(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
