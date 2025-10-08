/**
 * NodePermissionController
 * API endpoints for node permission management
 */

import {
  nodePolicyUpdateSchema,
  setNodePermissionsSchema,
} from '@journey/schema';
import type { Request, Response } from 'express';
import { z } from 'zod';

import type { Logger } from '../core/logger';
import { NodePermissionService } from '../services/node-permission.service';
import { UserService } from '../services/user-service';
import { BaseController } from './base-controller.js';

// Request schemas for validation
const nodePermissionParamsSchema = z.object({
  nodeId: z.string().uuid('Invalid node ID format'),
});

const policyParamsSchema = z.object({
  nodeId: z.string().uuid('Invalid node ID format'),
  policyId: z.string().uuid('Invalid policy ID format'),
});

const updatePolicyParamsSchema = z.object({
  policyId: z.string().uuid('Invalid policy ID format'),
});

const bulkUpdatePoliciesSchema = z.object({
  updates: z
    .array(
      z.object({
        policyId: z.string().uuid('Invalid policy ID format'),
        updates: nodePolicyUpdateSchema,
      })
    )
    .min(1, 'At least one policy update required')
    .max(100, 'Maximum 100 policy updates per request'),
});

export class NodePermissionController extends BaseController {
  private readonly nodePermissionService: NodePermissionService;
  private readonly userService: UserService;
  private readonly logger: Logger;

  constructor({
    nodePermissionService,
    userService,
    logger,
  }: {
    nodePermissionService: NodePermissionService;
    userService: UserService;
    logger: Logger;
  }) {
    super();
    this.nodePermissionService = nodePermissionService;
    this.userService = userService;
    this.logger = logger;
  }

  /**
   * POST /api/v2/nodes/{nodeId}/permissions
   * @summary Set permissions for a node
   * @tags Node Permissions
   * @description Creates or updates permission policies for a specific node. Requires authentication and node ownership. Supports setting multiple policies in a single request. Policies without a nodeId will inherit the nodeId from the URL parameter.
   * @security BearerAuth
   * @param {string} nodeId.path.required - UUID of the node to set permissions for
   * @param {object} request.body.required - Permission policies configuration
   * @return {object} 200 - Success response with metadata
   * @return {object} 400 - Validation error
   * @return {object} 401 - Authentication required
   * @return {object} 403 - Access denied (not node owner)
   * @return {object} 500 - Internal server error
   */
  async setPermissions(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = nodePermissionParamsSchema.parse(req.params);
      const permissionsData = setNodePermissionsSchema.parse(req.body);
      const user = this.getAuthenticatedUser(req);

      // If policies don't have nodeId, add it from URL param (backward compatibility)
      const policies = permissionsData.policies.map((policy) => ({
        ...policy,
        nodeId: policy.nodeId || nodeId,
      }));

      await this.nodePermissionService.setNodePermissions(nodeId, { policies }, user.id);

      // Calculate unique nodes for response
      const uniqueNodeIds = new Set(policies.map((p) => p.nodeId));

      // Use standard Lighthouse API response format
      res.json({
        success: true,
        data: null,
        meta: {
          timestamp: new Date().toISOString(),
          nodeCount: uniqueNodeIds.size,
          policyCount: policies.length,
        },
      });
    } catch (error) {
      this.logger.error('Error setting node permissions', error instanceof Error ? error : new Error(String(error)));

      // Use custom error handling for backward compatibility
      this.handlePermissionError(res, error as Error, 'setPermissions');
    }
  }

  /**
   * GET /api/v2/nodes/{nodeId}/permissions
   * @summary Get all permission policies for a node
   * @tags Node Permissions
   * @description Retrieves all permission policies associated with a specific node. Only accessible by the node owner. Returns an array of policies with subject information and permission levels.
   * @security BearerAuth
   * @param {string} nodeId.path.required - UUID of the node to get permissions for
   * @return {object} 200 - Success response with array of policies
   * @return {object} 400 - Invalid node ID format
   * @return {object} 401 - Authentication required
   * @return {object} 403 - Access denied (not node owner)
   * @return {object} 404 - Node not found
   * @return {object} 500 - Internal server error
   */
  async getPermissions(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = nodePermissionParamsSchema.parse(req.params);
      const user = this.getAuthenticatedUser(req);

      const policies = await this.nodePermissionService.getNodePolicies(
        nodeId,
        user.id
      );

      // Use standard Lighthouse API response format
      res.json({
        success: true,
        data: policies,
        meta: {
          timestamp: new Date().toISOString(),
          count: policies.length,
        },
      });
    } catch (error) {
      this.logger.error('Error getting node permissions', error instanceof Error ? error : new Error(String(error)));

      // Use custom error handling for backward compatibility
      this.handlePermissionError(res, error as Error, 'getPermissions');
    }
  }

  /**
   * DELETE /api/v2/nodes/{nodeId}/permissions/{policyId}
   * @summary Delete a specific permission policy
   * @tags Node Permissions
   * @description Permanently removes a permission policy from a node. Requires authentication and node ownership. The policy and all its associated permissions will be deleted.
   * @security BearerAuth
   * @param {string} nodeId.path.required - UUID of the node (used for route matching)
   * @param {string} policyId.path.required - UUID of the policy to delete
   * @return {object} 200 - Policy successfully deleted
   * @return {object} 400 - Invalid UUID format
   * @return {object} 401 - Authentication required
   * @return {object} 403 - Access denied (not node owner)
   * @return {object} 404 - Policy not found
   * @return {object} 500 - Internal server error
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
          policyId,
        },
      });
    } catch (error) {
      this.logger.error('Error deleting policy', error instanceof Error ? error : new Error(String(error)));

      // Use custom error handling for backward compatibility
      this.handlePermissionError(res, error as Error, 'deletePolicy');
    }
  }

  /**
   * PUT /api/v2/permissions/{policyId}
   * @summary Update a specific permission policy
   * @tags Node Permissions
   * @description Updates an existing permission policy. Allows modification of permission level, expiration date, and other policy attributes. Requires authentication and node ownership.
   * @security BearerAuth
   * @param {string} policyId.path.required - UUID of the policy to update
   * @param {object} request.body.required - Policy update data (level, expiresAt, etc.)
   * @return {object} 200 - Policy successfully updated
   * @return {object} 400 - Validation error (invalid data or parameters)
   * @return {object} 401 - Authentication required
   * @return {object} 403 - Access denied (not node owner)
   * @return {object} 404 - Policy not found
   * @return {object} 500 - Internal server error
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
          policyId,
        },
      });
    } catch (error) {
      this.logger.error('Error updating policy', error instanceof Error ? error : new Error(String(error)));

      // Use custom error handling for backward compatibility
      this.handlePermissionError(res, error as Error, 'updatePolicy');
    }
  }

  /**
   * PUT /api/v2/permissions/bulk
   * @summary Update multiple permission policies in bulk
   * @tags Node Permissions
   * @description Updates multiple permission policies in a single request. All updates are processed in parallel. Requires authentication and ownership of all affected nodes. Maximum 100 policy updates per request.
   * @security BearerAuth
   * @param {object} request.body.required - Array of policy updates with policyId and update data
   * @return {object} 200 - All policies successfully updated with count
   * @return {object} 400 - Validation error (invalid data, min 1 max 100 updates)
   * @return {object} 401 - Authentication required
   * @return {object} 403 - Access denied (not owner of one or more nodes)
   * @return {object} 404 - One or more policies not found
   * @return {object} 500 - Internal server error
   */
  async updateBulkPolicies(req: Request, res: Response): Promise<void> {
    try {
      const { updates } = bulkUpdatePoliciesSchema.parse(req.body);
      const user = this.getAuthenticatedUser(req);

      // Update all policies in parallel
      await Promise.all(
        updates.map(({ policyId, updates: policyUpdates }) =>
          this.nodePermissionService.updatePolicy(
            policyId,
            policyUpdates,
            user.id
          )
        )
      );

      // Use standard Lighthouse API response format
      res.json({
        success: true,
        data: null,
        meta: {
          timestamp: new Date().toISOString(),
          updatedPolicies: updates.length,
        },
      });
    } catch (error) {
      this.logger.error('Error updating bulk policies', error instanceof Error ? error : new Error(String(error)));

      // Use custom error handling for backward compatibility
      this.handlePermissionError(res, error as Error, 'updateBulkPolicies');
    }
  }

  /**
   * POST /api/v2/nodes/permissions/bulk
   * @summary Get permissions for multiple nodes in bulk
   * @tags Node Permissions
   * @description Retrieves permission policies for multiple nodes in a single request. Each node's policies are enriched with user information for user-type subjects. Requires authentication and ownership of all requested nodes. Failed individual node retrievals return empty policy arrays.
   * @security BearerAuth
   * @param {object} request.body.required - Array of node UUIDs to retrieve permissions for
   * @return {object} 200 - Success response with permissions grouped by nodeId
   * @return {object} 400 - Validation error (invalid node IDs, minimum 1 required)
   * @return {object} 401 - Authentication required
   * @return {object} 500 - Internal server error
   */
  async getBulkPermissions(req: Request, res: Response): Promise<void> {
    try {
      const nodeIdsSchema = z.object({
        nodeIds: z
          .array(z.string().uuid('Invalid node ID format'))
          .min(1, 'At least one node ID required'),
      });

      const { nodeIds } = nodeIdsSchema.parse(req.body);
      const user = this.getAuthenticatedUser(req);

      // Get permissions for all nodes at once
      const allPolicies = await Promise.all(
        nodeIds.map(async (nodeId) => {
          try {
            const policies = await this.nodePermissionService.getNodePolicies(
              nodeId,
              user.id
            );

            // Enrich policies with user information for user-type subjects
            const enrichedPolicies = await Promise.all(
              policies.map(async (policy) => {
                if (policy.subjectType === 'user' && policy.subjectId) {
                  try {
                    const userInfo =
                      await this.userService.getUserByIdWithExperience(
                        policy.subjectId
                      );
                    if (userInfo) {
                      return {
                        ...policy,
                        userInfo: {
                          id: userInfo.id,
                          userName: userInfo.userName || '',
                          firstName: userInfo.firstName,
                          lastName: userInfo.lastName,
                          email: userInfo.email,
                          experienceLine: userInfo.experienceLine,
                          avatarUrl: (userInfo as any).avatarUrl || null,
                        },
                      };
                    }
                  } catch (err) {
                    this.logger.warn('Failed to get user info for policy', {
                      policyId: policy.id,
                      userId: policy.subjectId,
                      error: err instanceof Error ? err.message : String(err),
                    });
                  }
                }
                return policy;
              })
            );

            return { nodeId, policies: enrichedPolicies };
          } catch (error) {
            this.logger.warn('Failed to get permissions for node', {
              nodeId,
              error,
            });
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
          totalPolicies: allPolicies.reduce(
            (sum, { policies }) => sum + policies.length,
            0
          ),
        },
      });
    } catch (error) {
      this.logger.error('Error getting bulk node permissions', error instanceof Error ? error : new Error(String(error)));

      // Use custom error handling for backward compatibility
      this.handlePermissionError(res, error as Error, 'getBulkPermissions');
    }
  }

  private handlePermissionError(
    res: Response,
    error: Error,
    method?: string
  ): Response {
    // Handle Zod validation errors (request schema validation)
    // Check both instanceof and constructor name for compatibility
    if (error instanceof z.ZodError || error.constructor.name === 'ZodError') {
      // Check if it's parameter validation or body validation based on error paths
      const zodError = error as z.ZodError;
      const hasBodyValidation = zodError.errors.some(
        (err) =>
          err.path.includes('policies') ||
          err.path.includes('level') ||
          err.path.includes('action')
      );

      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: hasBodyValidation
            ? 'Invalid request data'
            : 'Invalid request parameters',
          details: zodError.errors,
        },
      });
    }

    // Handle AuthenticationError from BaseController
    if (error.name === 'AuthenticationError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
    }

    // Handle ValidationError from BaseService (keeping original logic as fallback)
    if (
      error.name === 'ValidationError' &&
      error.message.includes('Authentication required')
    ) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
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
        'Edit permissions require',
      ];

      const isValidationError = validationKeywords.some((keyword) =>
        error.message.includes(keyword)
      );

      if (isValidationError) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
          },
        });
      }

      // Handle authorization errors
      if (error.message.includes('Only node owner')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: error.message,
          },
        });
      }

      // Handle not found errors
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
        });
      }

      // Handle membership errors (400 - client error)
      if (error.message.includes('not a member')) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
          },
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
      getBulkPermissions: 'Failed to get bulk permissions',
    };

    const defaultMessage =
      method && errorMessages[method as keyof typeof errorMessages]
        ? errorMessages[method as keyof typeof errorMessages]
        : 'Failed to process request';

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: defaultMessage,
      },
    });
  }
}
