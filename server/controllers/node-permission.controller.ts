/**
 * NodePermissionController
 * API endpoints for node permission management
 */

import type { Request, Response } from 'express';
import type { Logger } from '../core/logger';
import { NodePermissionService } from '../services/node-permission.service';
import {
  setNodePermissionsSchema
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

      const policies = await this.nodePermissionService.getNodePolicies(nodeId, userId);

      res.json({
        policies
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

}