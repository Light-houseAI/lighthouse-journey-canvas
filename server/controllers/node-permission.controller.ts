/**
 * NodePermissionController
 * API endpoints for node permission management
 */

import type { Request, Response } from 'express';
import type { Logger } from '../core/logger';
import { NodePermissionService } from '../services/node-permission.service';
import { BaseController } from './base-controller';
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
   * Set permissions for a node
   * POST /api/v2/nodes/:nodeId/permissions
   */
  async setPermissions(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = nodePermissionParamsSchema.parse(req.params);
      const permissionsData = setNodePermissionsSchema.parse(req.body);
      const user = this.getAuthenticatedUser(req);

      await this.nodePermissionService.setNodePermissions(
        nodeId,
        user.id,
        permissionsData
      );

      // Use direct response for backward compatibility
      res.json({
        message: 'Permissions updated successfully',
        nodeId,
        policyCount: permissionsData.policies.length
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

      // Use direct response for backward compatibility
      res.json({ policies });
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

      // Use direct response for backward compatibility
      res.json({
        message: 'Policy deleted successfully',
        policyId
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
   * Handle permission-specific errors with backward-compatible response format
   */
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
        error: hasBodyValidation ? 'Invalid request data' : 'Invalid request parameters',
        details: zodError.errors
      });
    }
    
    // Handle ValidationError from BaseService 
    if (error.name === 'ValidationError' && error.message.includes('Authentication required')) {
      return res.status(401).json({
        error: 'Authentication required'
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
          error: error.message
        });
      }
      
      // Handle authorization errors
      if (error.message.includes('Only node owner')) {
        return res.status(403).json({
          error: error.message
        });
      }
      
      // Handle not found errors
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: error.message
        });
      }
      
      // Handle membership errors (400 - client error)
      if (error.message.includes('not a member')) {
        return res.status(400).json({
          error: error.message
        });
      }
    }
    
    // Default error responses based on context
    const errorMessages = {
      setPermissions: 'Failed to set permissions',
      getPermissions: 'Failed to get permissions', 
      deletePolicy: 'Failed to delete policy'
    };
    
    const defaultMessage = method && errorMessages[method as keyof typeof errorMessages] 
      ? errorMessages[method as keyof typeof errorMessages]
      : 'Failed to process request';
    
    return res.status(500).json({
      error: defaultMessage
    });
  }

}