/**
 * GroupController
 * HTTP request handlers for group management APIs.
 */

import { type Request, type Response } from 'express';
import { z, ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';

import type { Logger } from '../core/logger.js';
import type { GroupService } from '../services/group.service.js';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createGroupSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  nodeId: z.string().uuid().optional(),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

const addItemsSchema = z.object({
  items: z.array(
    z.object({
      itemType: z.enum(['session', 'workflow', 'step']),
      sessionMappingId: z.string().uuid(),
      workflowId: z.string().max(100).optional(),
      stepId: z.string().max(100).optional(),
      metadata: z.record(z.unknown()).optional(),
    })
  ).min(1),
});

// ============================================================================
// CONTROLLER
// ============================================================================

export class GroupController {
  private readonly groupService: GroupService;
  private readonly logger: Logger;

  constructor({
    groupService,
    logger,
  }: {
    groupService: GroupService;
    logger: Logger;
  }) {
    this.groupService = groupService;
    this.logger = logger;
  }

  /**
   * POST /api/v2/groups
   * Create a new group
   */
  createGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const data = createGroupSchema.parse(req.body);
      const group = await this.groupService.createGroup(userId, data);

      res.status(201).json({ success: true, data: group });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * GET /api/v2/groups
   * List user's groups (optional ?nodeId= filter)
   */
  listGroups = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const nodeId = req.query.nodeId as string | undefined;
      const groups = await this.groupService.getUserGroups(userId, nodeId);

      res.status(200).json({ success: true, data: groups });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * GET /api/v2/groups/:groupId
   * Get group with items
   */
  getGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const { groupId } = req.params;
      const result = await this.groupService.getGroup(groupId, userId);

      if (!result) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Group not found' },
        });
        return;
      }

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * PATCH /api/v2/groups/:groupId
   * Update group name/description
   */
  updateGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const { groupId } = req.params;
      const data = updateGroupSchema.parse(req.body);
      const group = await this.groupService.updateGroup(groupId, userId, data);

      res.status(200).json({ success: true, data: group });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * DELETE /api/v2/groups/:groupId
   * Delete a group
   */
  deleteGroup = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const { groupId } = req.params;
      await this.groupService.deleteGroup(groupId, userId);

      res.status(200).json({ success: true });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * POST /api/v2/groups/:groupId/items
   * Add items to a group
   */
  addItems = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const { groupId } = req.params;
      const { items } = addItemsSchema.parse(req.body);
      const created = await this.groupService.addItemsToGroup(
        groupId,
        userId,
        items
      );

      res.status(201).json({ success: true, data: created });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * DELETE /api/v2/groups/:groupId/items/:itemId
   * Remove an item from a group
   */
  removeItem = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const { groupId, itemId } = req.params;
      await this.groupService.removeItemFromGroup(groupId, userId, itemId);

      res.status(200).json({ success: true });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * GET /api/v2/groups/:groupId/context
   * Resolve group → session_mappings data for Insight Assistant
   */
  getGroupContext = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const { groupId } = req.params;
      const sessions = await this.groupService.resolveGroupContext(
        groupId,
        userId
      );

      res.status(200).json({ success: true, data: sessions });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  /**
   * Centralized error handling
   */
  private handleError(error: unknown, res: Response): void {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validationError.toString(),
          details: error.issues,
        },
      });
      return;
    }

    if (error instanceof Error) {
      this.logger.warn(`Group controller error: ${error.message}`);

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: error.message },
        });
        return;
      }
    }

    this.logger.error('Unexpected group controller error', {
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
}
