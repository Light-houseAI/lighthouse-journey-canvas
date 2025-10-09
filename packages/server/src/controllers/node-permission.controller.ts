/**
 * NodePermissionController
 * API endpoints for node permission management
 */

import {
  AuthenticationError,
  type BulkPermissionsRequest,
  type BulkUpdatePoliciesRequest,
  type DeletePolicyRequest,
  type GetPermissionsRequest,
  HttpStatusCode,
  nodePolicyUpdateSchema,
  setNodePermissionsSchema,
  type SetPermissionsRequest,
  type UpdatePolicyRequest,
  ValidationError,
} from '@journey/schema';

import type { Logger } from '../core/logger';
import { NodePermissionService } from '../services/node-permission.service';
import { UserService } from '../services/user-service';

export class NodePermissionController {
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
    this.nodePermissionService = nodePermissionService;
    this.userService = userService;
    this.logger = logger;
  }

  /**
   * POST /api/v2/nodes/{nodeId}/permissions
   * @summary Set permissions for a node
   * @tags Node Permissions
   * @description Creates or updates permission policies for a specific timeline node. Requires authentication and node ownership. Supports setting multiple policies in a single request for batch operations. Policies can specify access levels (view, edit, admin) for different subjects (users, teams, organizations). Policies without a nodeId in the request body will automatically inherit the nodeId from the URL path parameter for convenience and backward compatibility.
   * @security BearerAuth
   * @param {string} nodeId.path.required - UUID of the node to set permissions for - example: 123e4567-e89b-12d3-a456-426614174000
   * @param {SetNodePermissionsInput} request.body.required - Permission policies configuration - application/json
   * @return {SetPermissionsSuccessResponse} 200 - Successfully set permissions with metadata
   * @return {ValidationErrorResponse} 400 - Validation error (invalid policy data)
   * @return {AuthenticationErrorResponse} 401 - Authentication required
   * @return {ForbiddenErrorResponse} 403 - Access denied (not node owner)
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async setPermissions(req: SetPermissionsRequest) {
    const res = req.res!;
    const { nodeId } = req.params;

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    // Validate permissions data - throws ValidationError on failure
    const validationResult = setNodePermissionsSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError('Invalid permissions data', validationResult.error.errors);
    }

    const permissionsData = validationResult.data;

    // If policies don't have nodeId, add it from URL param (backward compatibility)
    const policies = permissionsData.policies.map((policy) => ({
      ...policy,
      nodeId: policy.nodeId || nodeId,
    }));

    await this.nodePermissionService.setNodePermissions(nodeId, { policies }, user.id);

    // Send success response
    const response = {
      success: true,
      data: null
    };

    res.status(HttpStatusCode.OK).json(response);
    return res;
  }

  /**
   * GET /api/v2/nodes/{nodeId}/permissions
   * @summary Get all permission policies for a node
   * @tags Node Permissions
   * @description Retrieves all permission policies associated with a specific timeline node. Only accessible by the node owner for security. Returns an array of policies including subject information (user/team/organization), permission levels (view/edit/admin), expiration dates, and other policy metadata. Each policy includes details about who has access and what level of access they have.
   * @security BearerAuth
   * @param {string} nodeId.path.required - UUID of the node to get permissions for - example: 123e4567-e89b-12d3-a456-426614174000
   * @return {GetPermissionsSuccessResponse} 200 - Success response with array of policies
   * @return {ValidationErrorResponse} 400 - Invalid node ID format
   * @return {AuthenticationErrorResponse} 401 - Authentication required
   * @return {ForbiddenErrorResponse} 403 - Access denied (not node owner)
   * @return {NotFoundErrorResponse} 404 - Node not found
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async getPermissions(req: GetPermissionsRequest) {
    const res = req.res!;
    const { nodeId } = req.params;

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    const policies = await this.nodePermissionService.getNodePolicies(nodeId, user.id);

    // Send success response
    const response = {
      success: true,
      data: policies
    };

    res.status(HttpStatusCode.OK).json(response);
    return res;
  }

  /**
   * DELETE /api/v2/nodes/{nodeId}/permissions/{policyId}
   * @summary Delete a specific permission policy
   * @tags Node Permissions
   * @description Permanently removes a permission policy from a timeline node. Requires authentication and node ownership. The policy and all its associated permissions will be deleted immediately and cannot be recovered. This revokes access for the subject specified in the deleted policy. The nodeId parameter is used for route matching and validation but the policy is deleted by its policyId.
   * @security BearerAuth
   * @param {string} nodeId.path.required - UUID of the node (used for route matching) - example: 123e4567-e89b-12d3-a456-426614174000
   * @param {string} policyId.path.required - UUID of the policy to delete - example: 234e5678-e89b-12d3-a456-426614174001
   * @return {DeletePolicySuccessResponse} 200 - Policy successfully deleted
   * @return {ValidationErrorResponse} 400 - Invalid UUID format
   * @return {AuthenticationErrorResponse} 401 - Authentication required
   * @return {ForbiddenErrorResponse} 403 - Access denied (not node owner)
   * @return {NotFoundErrorResponse} 404 - Policy not found
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async deletePolicy(req: DeletePolicyRequest) {
    const res = req.res!;
    const { policyId } = req.params;

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    await this.nodePermissionService.deletePolicy(policyId, user.id);

    // Send success response
    const response = {
      success: true,
      data: null
    };

    res.status(HttpStatusCode.OK).json(response);
    return res;
  }

  /**
   * PUT /api/v2/permissions/{policyId}
   * @summary Update a specific permission policy
   * @tags Node Permissions
   * @description Updates an existing permission policy with new values. Allows modification of permission level (view/edit/admin), expiration date, and other policy attributes. Requires authentication and node ownership. Only the fields provided in the request body will be updated - omitted fields remain unchanged. This enables partial updates without requiring the full policy object.
   * @security BearerAuth
   * @param {string} policyId.path.required - UUID of the policy to update - example: 234e5678-e89b-12d3-a456-426614174001
   * @param {NodePolicyUpdateInput} request.body.required - Policy update data (level, expiresAt, etc.) - application/json
   * @return {UpdatePolicySuccessResponse} 200 - Policy successfully updated
   * @return {ValidationErrorResponse} 400 - Validation error (invalid data or parameters)
   * @return {AuthenticationErrorResponse} 401 - Authentication required
   * @return {ForbiddenErrorResponse} 403 - Access denied (not node owner)
   * @return {NotFoundErrorResponse} 404 - Policy not found
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async updatePolicy(req: UpdatePolicyRequest) {
    const res = req.res!;
    const { policyId } = req.params;

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    // Validate policy update data - throws ValidationError on failure
    const validationResult = nodePolicyUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError('Invalid policy update data', validationResult.error.errors);
    }

    const updates = validationResult.data;

    await this.nodePermissionService.updatePolicy(policyId, updates, user.id);

    // Send success response
    const response = {
      success: true,
      data: null
    };

    res.status(HttpStatusCode.OK).json(response);
    return res;
  }

  /**
   * PUT /api/v2/permissions/bulk
   * @summary Update multiple permission policies in bulk
   * @tags Node Permissions
   * @description Updates multiple permission policies in a single atomic request. All policy updates are processed in parallel for performance. Requires authentication and ownership of all affected nodes. Each update can modify different policy attributes independently. Maximum 100 policy updates per request to prevent excessive load. If any update fails, the entire operation may be rolled back depending on the specific failure.
   * @security BearerAuth
   * @param {BulkUpdatePoliciesInput} request.body.required - Array of policy updates with policyId and update data - application/json
   * @return {BulkUpdatePoliciesSuccessResponse} 200 - All policies successfully updated with count
   * @return {ValidationErrorResponse} 400 - Validation error (invalid data, min 1 max 100 updates)
   * @return {AuthenticationErrorResponse} 401 - Authentication required
   * @return {ForbiddenErrorResponse} 403 - Access denied (not owner of one or more nodes)
   * @return {NotFoundErrorResponse} 404 - One or more policies not found
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async updateBulkPolicies(req: BulkUpdatePoliciesRequest) {
    const res = req.res!;
    const { updates } = req.body;

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    // Update all policies in parallel
    await Promise.all(
      updates.map(({ policyId, updates: policyUpdates }) =>
        this.nodePermissionService.updatePolicy(policyId, policyUpdates, user.id)
      )
    );

    // Send success response
    const response = {
      success: true,
      data: null
    };

    res.status(HttpStatusCode.OK).json(response);
    return res;
  }

  /**
   * POST /api/v2/nodes/permissions/bulk
   * @summary Get permissions for multiple nodes in bulk
   * @tags Node Permissions
   * @description Retrieves permission policies for multiple timeline nodes in a single efficient request. Each node's policies are automatically enriched with user information (name, email, avatar, etc.) for user-type subjects to enable UI display. Requires authentication and ownership of all requested nodes for security. Failed individual node permission retrievals return empty policy arrays rather than failing the entire request, allowing partial success. This is useful for loading permission data for timeline views or bulk permission management interfaces.
   * @security BearerAuth
   * @param {BulkPermissionsInput} request.body.required - Array of node UUIDs to retrieve permissions for - application/json
   * @return {BulkPermissionsSuccessResponse} 200 - Success response with permissions grouped by nodeId
   * @return {ValidationErrorResponse} 400 - Validation error (invalid node IDs, minimum 1 required)
   * @return {AuthenticationErrorResponse} 401 - Authentication required
   * @return {InternalErrorResponse} 500 - Internal server error
   */
  async getBulkPermissions(req: BulkPermissionsRequest) {
    const res = req.res!;

    // Get authenticated user - throws AuthenticationError if not authenticated
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new AuthenticationError('User authentication required');
    }

    // Validate request body - throws ValidationError on failure
    if (!req.body.nodeIds || !Array.isArray(req.body.nodeIds) || req.body.nodeIds.length === 0) {
      throw new ValidationError('At least one node ID required');
    }

    const { nodeIds } = req.body;

    // Validate each nodeId is a UUID
    for (const nodeId of nodeIds) {
      if (typeof nodeId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nodeId)) {
        throw new ValidationError('Invalid node ID format');
      }
    }

    // Get permissions for all nodes at once
    const allPolicies = await Promise.all(
      nodeIds.map(async (nodeId) => {
        try {
          const policies = await this.nodePermissionService.getNodePolicies(nodeId, user.id);

          // Enrich policies with user information for user-type subjects
          const enrichedPolicies = await Promise.all(
            policies.map(async (policy) => {
              if (policy.subjectType === 'user' && policy.subjectId) {
                try {
                  const userInfo = await this.userService.getUserByIdWithExperience(policy.subjectId);
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

    // Send success response
    const response = {
      success: true,
      data: allPolicies
    };

    res.status(HttpStatusCode.OK).json(response);
    return res;
  }
}
