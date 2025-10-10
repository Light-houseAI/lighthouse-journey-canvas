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

import { ErrorCode, HttpStatus, type ApiErrorResponse } from '../core';
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
   * POST /api/v2/nodes/:nodeId/permissions
   * @tags Node Permissions
   * @summary Set node permissions
   * @description Set or update permission policies for a timeline node (owner only)
   * @security BearerAuth
   * @param {string} nodeId.path.required - Node UUID
   * @param {object} request.body.required - Permission policies
   * @param {array} request.body.policies.required - Array of permission policies
   * @return {object} 200 - Permissions set successfully
   * @return {ApiErrorResponse} 400 - Validation error
   * @return {ApiErrorResponse} 401 - Authentication required
   * @return {ApiErrorResponse} 403 - Owner access required
   * @example request - Set permissions payload
   * {
   *   "policies": [
   *     {
   *       "nodeId": "uuid",
   *       "subjectType": "user",
   *       "subjectId": "user-uuid",
   *       "level": "view"
   *     }
   *   ]
   * }
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
   * GET /api/v2/nodes/:nodeId/permissions
   * @tags Node Permissions
   * @summary Get node permissions
   * @description Get all permission policies for a node (owner only)
   * @security BearerAuth
   * @param {string} nodeId.path.required - Node UUID
   * @return {object} 200 - List of permission policies
   * @return {ApiErrorResponse} 401 - Authentication required
   * @return {ApiErrorResponse} 403 - Owner access required
   * @return {ApiErrorResponse} 404 - Node not found
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
   * DELETE /api/v2/nodes/:nodeId/permissions/:policyId
   * @tags Node Permissions
   * @summary Delete permission policy
   * @description Delete a specific permission policy (owner only)
   * @security BearerAuth
   * @param {string} policyId.path.required - Policy UUID
   * @return {object} 200 - Policy deleted successfully
   * @return {ApiErrorResponse} 401 - Authentication required
   * @return {ApiErrorResponse} 403 - Owner access required
   * @return {ApiErrorResponse} 404 - Policy not found
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
   * PUT /api/v2/permissions/:policyId
   * @tags Node Permissions
   * @summary Update permission policy
   * @description Update an existing permission policy (owner only)
   * @security BearerAuth
   * @param {string} policyId.path.required - Policy UUID
   * @param {object} request.body.required - Policy updates
   * @param {string} request.body.level - Permission level (view, edit, admin)
   * @param {string} request.body.expiresAt - Expiration date (ISO 8601)
   * @return {object} 200 - Policy updated successfully
   * @return {ApiErrorResponse} 400 - Validation error
   * @return {ApiErrorResponse} 401 - Authentication required
   * @return {ApiErrorResponse} 403 - Owner access required
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
   * @tags Node Permissions
   * @summary Bulk update policies
   * @description Update multiple permission policies at once (max 100)
   * @security BearerAuth
   * @param {object} request.body.required - Bulk update data
   * @param {array} request.body.updates.required - Array of policy updates (max 100)
   * @return {object} 200 - Policies updated successfully
   * @return {ApiErrorResponse} 400 - Validation error
   * @return {ApiErrorResponse} 401 - Authentication required
   * @return {ApiErrorResponse} 403 - Owner access required
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
   * @tags Node Permissions
   * @summary Get bulk permissions
   * @description Get permissions for multiple nodes at once with user info
   * @security BearerAuth
   * @param {object} request.body.required - Node IDs
   * @param {array} request.body.nodeIds.required - Array of node UUIDs (min 1)
   * @return {object} 200 - Permissions for all requested nodes
   * @return {ApiErrorResponse} 400 - Validation error
   * @return {ApiErrorResponse} 401 - Authentication required
   * @example request - Bulk permissions request
   * {
   *   "nodeIds": ["uuid-1", "uuid-2", "uuid-3"]
   * }
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

      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: hasBodyValidation
            ? 'Invalid request data'
            : 'Invalid request parameters',
          details: zodError.errors,
        },
      };
      return res.status(HttpStatus.BAD_REQUEST).json(errorResponse);
    }

    // Handle AuthenticationError from BaseController
    if (error.name === 'AuthenticationError') {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION_REQUIRED,
          message: 'Authentication required',
        },
      };
      return res.status(HttpStatus.UNAUTHORIZED).json(errorResponse);
    }

    // Handle ValidationError from BaseService (keeping original logic as fallback)
    if (
      error.name === 'ValidationError' &&
      error.message.includes('Authentication required')
    ) {
      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: ErrorCode.AUTHENTICATION_REQUIRED,
          message: 'Authentication required',
        },
      };
      return res.status(HttpStatus.UNAUTHORIZED).json(errorResponse);
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
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: error.message,
          },
        };
        return res.status(HttpStatus.BAD_REQUEST).json(errorResponse);
      }

      // Handle authorization errors
      if (error.message.includes('Only node owner')) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.ACCESS_DENIED,
            message: error.message,
          },
        };
        return res.status(HttpStatus.FORBIDDEN).json(errorResponse);
      }

      // Handle not found errors
      if (error.message.includes('not found')) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.NOT_FOUND,
            message: error.message,
          },
        };
        return res.status(HttpStatus.NOT_FOUND).json(errorResponse);
      }

      // Handle membership errors (400 - client error)
      if (error.message.includes('not a member')) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: error.message,
          },
        };
        return res.status(HttpStatus.BAD_REQUEST).json(errorResponse);
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

    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: defaultMessage,
      },
    };
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(errorResponse);
  }
}
