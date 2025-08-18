/**
 * NodePermissionController
 * API endpoints for node permission management
 */

import type { Request, Response } from 'express';
import type { Logger } from '../core/logger';
import { NodePermissionService } from '../services/node-permission.service';
import {
  VisibilityLevel,
  PermissionAction,
  SubjectType,
  setNodePermissionsSchema,
  nodePolicyUpdateSchema
} from '@shared/schema';
import { z } from 'zod';

// Request schemas for validation
const nodePermissionParamsSchema = z.object({
  nodeId: z.string().uuid('Invalid node ID format')
});

const policyParamsSchema = z.object({
  nodeId: z.string().uuid('Invalid node ID format'),
  policyId: z.string().uuid('Invalid policy ID format')
});

const accessCheckQuerySchema = z.object({
  action: z.nativeEnum(PermissionAction).optional().default(PermissionAction.View),
  level: z.nativeEnum(VisibilityLevel).optional().default(VisibilityLevel.Overview)
});

const accessibleNodesQuerySchema = z.object({
  action: z.nativeEnum(PermissionAction).optional().default(PermissionAction.View),
  minLevel: z.nativeEnum(VisibilityLevel).optional().default(VisibilityLevel.Overview),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0)
});

const batchCheckSchema = z.object({
  nodeIds: z.array(z.string().uuid()).min(1).max(100),
  action: z.nativeEnum(PermissionAction).optional().default(PermissionAction.View),
  level: z.nativeEnum(VisibilityLevel).optional().default(VisibilityLevel.Overview)
});

export class NodePermissionController {
  constructor({
    nodePermissionService,
    logger
  }: {
    nodePermissionService: NodePermissionService;
    logger: Logger;
  }) {
    this.nodePermissionService = nodePermissionService;
    this.logger = logger;
  }

  private readonly nodePermissionService: NodePermissionService;
  private readonly logger: Logger;

  /**
   * Check if user can access a specific node
   * GET /api/v2/nodes/:nodeId/access
   */
  async checkAccess(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = nodePermissionParamsSchema.parse(req.params);
      const { action, level } = accessCheckQuerySchema.parse(req.query);
      const userId = req.user?.id || null;

      const canAccess = await this.nodePermissionService.canAccess(
        userId,
        nodeId,
        action,
        level
      );

      const accessLevel = canAccess 
        ? await this.nodePermissionService.getAccessLevel(userId, nodeId)
        : null;

      res.json({
        canAccess,
        accessLevel,
        action,
        level
      });
    } catch (error) {
      this.logger.error('Error checking node access', {
        nodeId: req.params.nodeId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request parameters',
          details: error.errors
        });
      } else {
        res.status(500).json({
          error: 'Failed to check node access'
        });
      }
    }
  }

  /**
   * Get comprehensive access information for a node
   * GET /api/v2/nodes/:nodeId/access-level
   */
  async getAccessLevel(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = nodePermissionParamsSchema.parse(req.params);
      const userId = req.user?.id || null;

      const accessInfo = await this.nodePermissionService.getNodeAccessLevel(userId, nodeId);

      res.json(accessInfo);
    } catch (error) {
      this.logger.error('Error getting node access level', {
        nodeId: req.params.nodeId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request parameters',
          details: error.errors
        });
      } else {
        res.status(500).json({
          error: 'Failed to get access level'
        });
      }
    }
  }

  /**
   * Set permissions for a node
   * POST /api/v2/nodes/:nodeId/permissions
   */
  async setPermissions(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = nodePermissionParamsSchema.parse(req.params);
      const permissionsData = setNodePermissionsSchema.parse(req.body);
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      await this.nodePermissionService.setNodePermissions(
        nodeId,
        userId,
        permissionsData
      );

      res.json({
        message: 'Permissions updated successfully',
        nodeId,
        policyCount: permissionsData.policies.length
      });
    } catch (error) {
      this.logger.error('Error setting node permissions', {
        nodeId: req.params.nodeId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request data',
          details: error.errors
        });
      } else if (error instanceof Error && error.message.includes('Only node owner')) {
        res.status(403).json({
          error: error.message
        });
      } else if (error instanceof Error && error.message.includes('not a member')) {
        res.status(400).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to set permissions'
        });
      }
    }
  }

  /**
   * Get all policies for a node (owner only)
   * GET /api/v2/nodes/:nodeId/permissions
   */
  async getPermissions(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = nodePermissionParamsSchema.parse(req.params);
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const [policies, effectivePermissions] = await Promise.all([
        this.nodePermissionService.getNodePolicies(nodeId, userId),
        this.nodePermissionService.getEffectivePermissions(nodeId, userId)
      ]);

      res.json({
        policies,
        effectivePermissions
      });
    } catch (error) {
      this.logger.error('Error getting node permissions', {
        nodeId: req.params.nodeId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request parameters',
          details: error.errors
        });
      } else if (error instanceof Error && error.message.includes('Only node owner')) {
        res.status(403).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to get permissions'
        });
      }
    }
  }

  /**
   * Delete a specific policy
   * DELETE /api/v2/nodes/:nodeId/permissions/:policyId
   */
  async deletePolicy(req: Request, res: Response): Promise<void> {
    try {
      const { policyId } = policyParamsSchema.parse(req.params);
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      await this.nodePermissionService.deletePolicy(policyId, userId);

      res.json({
        message: 'Policy deleted successfully',
        policyId
      });
    } catch (error) {
      this.logger.error('Error deleting policy', {
        policyId: req.params.policyId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request parameters',
          details: error.errors
        });
      } else if (error instanceof Error && error.message.includes('Only node owner')) {
        res.status(403).json({
          error: error.message
        });
      } else if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to delete policy'
        });
      }
    }
  }

  /**
   * Get accessible nodes for current user
   * GET /api/v2/nodes/accessible
   */
  async getAccessibleNodes(req: Request, res: Response): Promise<void> {
    try {
      const { action, minLevel, limit, offset } = accessibleNodesQuerySchema.parse(req.query);
      const userId = req.user?.id || null;

      const accessibleNodes = await this.nodePermissionService.getAccessibleNodes(
        userId,
        action,
        minLevel
      );

      // Apply pagination
      const paginatedNodes = accessibleNodes.slice(offset, offset + limit);
      const hasMore = offset + limit < accessibleNodes.length;

      res.json({
        nodes: paginatedNodes,
        total: accessibleNodes.length,
        limit,
        offset,
        hasMore
      });
    } catch (error) {
      this.logger.error('Error getting accessible nodes', {
        userId: req.user?.id,
        query: req.query,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid query parameters',
          details: error.errors
        });
      } else {
        res.status(500).json({
          error: 'Failed to get accessible nodes'
        });
      }
    }
  }

  /**
   * Batch check access for multiple nodes
   * POST /api/v2/nodes/batch-check
   */
  async batchCheckAccess(req: Request, res: Response): Promise<void> {
    try {
      const { nodeIds, action, level } = batchCheckSchema.parse(req.body);
      const userId = req.user?.id || null;

      const results = await this.nodePermissionService.batchCheckAccess(
        userId,
        nodeIds,
        action,
        level
      );

      res.json({
        results,
        total: results.length,
        action,
        level
      });
    } catch (error) {
      this.logger.error('Error in batch access check', {
        userId: req.user?.id,
        nodeCount: req.body?.nodeIds?.length,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request data',
          details: error.errors
        });
      } else {
        res.status(500).json({
          error: 'Failed to check access'
        });
      }
    }
  }

  /**
   * Check if user is owner of a node
   * GET /api/v2/nodes/:nodeId/ownership
   */
  async checkOwnership(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = nodePermissionParamsSchema.parse(req.params);
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const isOwner = await this.nodePermissionService.isNodeOwner(userId, nodeId);

      res.json({
        isOwner,
        nodeId,
        userId
      });
    } catch (error) {
      this.logger.error('Error checking node ownership', {
        nodeId: req.params.nodeId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid request parameters',
          details: error.errors
        });
      } else {
        res.status(500).json({
          error: 'Failed to check ownership'
        });
      }
    }
  }

  /**
   * Cleanup expired policies (admin endpoint)
   * POST /api/v2/admin/cleanup-expired-policies
   */
  async cleanupExpiredPolicies(req: Request, res: Response): Promise<void> {
    try {
      // In a real application, you'd check for admin privileges here
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const deletedCount = await this.nodePermissionService.cleanupExpiredPolicies();

      res.json({
        message: 'Cleanup completed',
        deletedPolicies: deletedCount
      });
    } catch (error) {
      this.logger.error('Error cleaning up expired policies', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({
        error: 'Failed to cleanup expired policies'
      });
    }
  }
}