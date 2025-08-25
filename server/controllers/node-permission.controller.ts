/**
 * NodePermissionController
 * API endpoints for node permission management
 */

import type { Request, Response } from 'express';
import type { Logger } from '../core/logger';
import { NodePermissionService } from '../services/node-permission.service';
import { BaseController } from './base-controller';
import {
  setNodePermissionsSchema,
  nodePolicyUpdateSchema
} from '@shared/types';
import { z } from 'zod';

// Request schemas for validation
const nodePermissionParamsSchema = z.object({
  nodeId: z.string().uuid('Invalid node ID format')
});

const policyParamsSchema = z.object({
  nodeId: z.string().uuid('Invalid node ID format'),
  policyId: z.string().uuid('Invalid policy ID format')
});

const updatePolicyParamsSchema = z.object({
  policyId: z.string().uuid('Invalid policy ID format')
});

const bulkUpdatePoliciesSchema = z.object({
  updates: z.array(z.object({
    policyId: z.string().uuid('Invalid policy ID format'),
    updates: nodePolicyUpdateSchema
  })).min(1, 'At least one policy update required').max(100, 'Maximum 100 policy updates per request')
});


export class NodePermissionController extends BaseController {
  private readonly nodePermissionService: NodePermissionService;
  private readonly logger: Logger;

  constructor({
    nodePermissionService,
    logger
  }: {
    nodePermissionService: NodePermissionService;
    logger: Logger;
  }) {
    super();
    this.nodePermissionService = nodePermissionService;
    this.logger = logger;
  }


  /**
   * Set permissions for nodes
   * POST /api/v2/nodes/:nodeId/permissions
   */
  async setPermissions(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = nodePermissionParamsSchema.parse(req.params);
      const permissionsData = setNodePermissionsSchema.parse(req.body);
      const user = this.getAuthenticatedUser(req);

      // If policies don't have nodeId, add it from URL param (backward compatibility)
      const policies = permissionsData.policies.map(policy => ({
        ...policy,
        nodeId: policy.nodeId || nodeId
      }));

      await this.nodePermissionService.setNodePermissions(
        user.id,
        { policies }
      );

      // Calculate unique nodes for response
      const uniqueNodeIds = new Set(policies.map(p => p.nodeId));

      // Use standard Lighthouse API response format
      res.json({
        success: true,
        data: null,
        meta: {
          timestamp: new Date().toISOString(),
          nodeCount: uniqueNodeIds.size,
          policyCount: policies.length
        }
      });
    } catch (error) {
      this.logger.error('Error setting node permissions', {
        nodeId: req.params.nodeId,
        userId: (req as any).user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      // Use custom error handling for backward compatibility
      this.handlePermissionError(res, error as Error, 'setPermissions');
    }
  }

  /**
   * Get all policies for a node (owner only)
   * GET /api/v2/nodes/:nodeId/permissions
   */
  async getPermissions(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = nodePermissionParamsSchema.parse(req.params);
      const user = this.getAuthenticatedUser(req);

      const policies = await this.nodePermissionService.getNodePolicies(nodeId, user.id);

      // Use standard Lighthouse API response format
      res.json({
        success: true,
        data: policies,
        meta: {
          timestamp: new Date().toISOString(),
          count: policies.length
        }
      });
    } catch (error) {
      this.logger.error('Error getting node permissions', {
        nodeId: req.params.nodeId,
        userId: (req as any).user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      // Use custom error handling for backward compatibility
      this.handlePermissionError(res, error as Error, 'getPermissions');
    }
  }

  /**
   * Delete a specific policy
   * DELETE /api/v2/nodes/:nodeId/permissions/:policyId
   */
  async deletePolicy(req: Request, res: Response): Promise<void> {
    try {
      const { policyId } = policyParamsSchema.parse(req.params);
      const user = this.getAuthenticatedUser(req);

      await this.nodePermissionService.deletePolicy(policyId, user.id);

      // Use standard Lighthouse API response format
      res.json({
        success: true,
        data: null,
        meta: {
          timestamp: new Date().toISOString(),
          policyId
        }
      });
    } catch (error) {
      this.logger.error('Error deleting policy', {
        policyId: req.params.policyId,
        userId: (req as any).user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      // Use custom error handling for backward compatibility
      this.handlePermissionError(res, error as Error, 'deletePolicy');
    }
  }

  /**
   * Update a specific policy
   * PUT /api/v2/permissions/:policyId
   */
  async updatePolicy(req: Request, res: Response): Promise<void> {
    try {
      const { policyId } = updatePolicyParamsSchema.parse(req.params);
      const updates = nodePolicyUpdateSchema.parse(req.body);
      const user = this.getAuthenticatedUser(req);

      await this.nodePermissionService.updatePolicy(policyId, updates, user.id);

      // Use standard Lighthouse API response format
      res.json({
        success: true,
        data: null,
        meta: {
          timestamp: new Date().toISOString(),
          policyId
        }
      });
    } catch (error) {
      this.logger.error('Error updating policy', {
        policyId: req.params.policyId,
        userId: (req as any).user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      // Use custom error handling for backward compatibility
      this.handlePermissionError(res, error as Error, 'updatePolicy');
    }
  }

  /**
   * Update multiple policies in bulk
   * PUT /api/v2/permissions/bulk
   */
  async updateBulkPolicies(req: Request, res: Response): Promise<void> {
    try {
      const { updates } = bulkUpdatePoliciesSchema.parse(req.body);
      const user = this.getAuthenticatedUser(req);

      // Update all policies in parallel
      await Promise.all(
        updates.map(({ policyId, updates: policyUpdates }) =>
          this.nodePermissionService.updatePolicy(policyId, policyUpdates, user.id)
        )
      );

      // Use standard Lighthouse API response format
      res.json({
        success: true,
        data: null,
        meta: {
          timestamp: new Date().toISOString(),
          updatedPolicies: updates.length
        }
      });
    } catch (error) {
      this.logger.error('Error updating bulk policies', {
        userId: (req as any).user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      // Use custom error handling for backward compatibility
      this.handlePermissionError(res, error as Error, 'updateBulkPolicies');
    }
  }

  /**
   * Get permissions for multiple nodes in bulk
   * POST /api/v2/nodes/permissions/bulk
   */
  async getBulkPermissions(req: Request, res: Response): Promise<void> {
    try {
      const nodeIdsSchema = z.object({
        nodeIds: z.array(z.string().uuid('Invalid node ID format')).min(1, 'At least one node ID required')
      });
      
      const { nodeIds } = nodeIdsSchema.parse(req.body);
      const user = this.getAuthenticatedUser(req);

      // Get permissions for all nodes at once
      const allPolicies = await Promise.all(
        nodeIds.map(async (nodeId) => {
          try {
            const policies = await this.nodePermissionService.getNodePolicies(nodeId, user.id);
            return { nodeId, policies };
          } catch (error) {
            this.logger.warn('Failed to get permissions for node', { nodeId, error });
            return { nodeId, policies: [] };
          }
        })
      );

      // Use standard Lighthouse API response format
      res.json({
        success: true,
        data: allPolicies,
        meta: {
          timestamp: new Date().toISOString(),
          nodeCount: nodeIds.length,
          totalPolicies: allPolicies.reduce((sum, { policies }) => sum + policies.length, 0)
        }
      });
    } catch (error) {
      this.logger.error('Error getting bulk node permissions', {
        userId: (req as any).user?.id,
        error: error instanceof Error ? error.message : String(error)
      });

      // Use custom error handling for backward compatibility
      this.handlePermissionError(res, error as Error, 'getBulkPermissions');
    }
  }

  private handlePermissionError(res: Response, error: Error, method?: string): Response {
    // Handle Zod validation errors (request schema validation)
    // Check both instanceof and constructor name for compatibility
    if (error instanceof z.ZodError || error.constructor.name === 'ZodError') {
      // Check if it's parameter validation or body validation based on error paths
      const zodError = error as z.ZodError;
      const hasBodyValidation = zodError.errors.some(err => 
        err.path.includes('policies') || err.path.includes('level') || err.path.includes('action')
      );
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: hasBodyValidation ? 'Invalid request data' : 'Invalid request parameters',
          details: zodError.errors
        }
      });
    }
    
    // Handle ValidationError from BaseService 
    if (error.name === 'ValidationError' && error.message.includes('Authentication required')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    }
    
    // Handle business logic validation errors (from service layer)
    if (error instanceof Error) {
      // Check for validation-related error messages that should return 400
      const validationKeywords = [
        'Invalid',
        'required',
        'cannot be empty',
        'must be',
        'exceed',
        'Maximum',
        'format',
        'Expiration date',
        'Edit permissions require'
      ];
      
      const isValidationError = validationKeywords.some(keyword => 
        error.message.includes(keyword)
      );
      
      if (isValidationError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message
          }
        });
      }
      
      // Handle authorization errors
      if (error.message.includes('Only node owner')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: error.message
          }
        });
      }
      
      // Handle not found errors
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message
          }
        });
      }
      
      // Handle membership errors (400 - client error)
      if (error.message.includes('not a member')) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message
          }
        });
      }
    }
    
    // Default error responses based on context
    const errorMessages = {
      setPermissions: 'Failed to set permissions',
      getPermissions: 'Failed to get permissions', 
      deletePolicy: 'Failed to delete policy',
      updatePolicy: 'Failed to update policy',
      updateBulkPolicies: 'Failed to update policies',
      getBulkPermissions: 'Failed to get bulk permissions'
    };
    
    const defaultMessage = method && errorMessages[method as keyof typeof errorMessages] 
      ? errorMessages[method as keyof typeof errorMessages]
      : 'Failed to process request';
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: defaultMessage
      }
    });
  }

}